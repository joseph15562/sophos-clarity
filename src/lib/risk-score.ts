import type { AnalysisResult } from "./analyse-config";

export interface CategoryScore {
  label: string;
  score: number;
  maxScore: number;
  pct: number;
  details: string;
}

export interface RiskScoreResult {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  categories: CategoryScore[];
}

function pctScore(have: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((have / total) * 100);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function computeRiskScore(result: AnalysisResult): RiskScoreResult {
  const { stats, findings, inspectionPosture: ip } = result;
  const categories: CategoryScore[] = [];

  // Use enabled WAN rules as the baseline — disabled rules don't provide protection
  const activeWan = ip.enabledWanRules;

  // 1. Web Filtering — scored against enabled WAN rules with HTTP/HTTPS/ANY service
  const wfPct = pctScore(ip.withWebFilter, ip.webFilterableRules);
  categories.push({
    label: "Web Filtering",
    score: wfPct,
    maxScore: 100,
    pct: wfPct,
    details:
      ip.webFilterableRules > 0
        ? `${ip.withWebFilter}/${ip.webFilterableRules} enabled WAN rules (HTTP/HTTPS/ANY) have web filtering${ip.disabledWanRules > 0 ? ` (${ip.disabledWanRules} disabled)` : ""}`
        : "No enabled WAN rules with HTTP/HTTPS/ANY service",
  });

  // 2. Intrusion Prevention — scored against enabled WAN rules
  const ipsPct = pctScore(ip.withIps, activeWan);
  categories.push({
    label: "Intrusion Prevention",
    score: ipsPct,
    maxScore: 100,
    pct: ipsPct,
    details:
      activeWan > 0
        ? `${ip.withIps}/${activeWan} enabled WAN rules have IPS`
        : "No enabled WAN rules detected",
  });

  // 3. Application Control — scored against enabled WAN rules
  const acPct = pctScore(ip.withAppControl, activeWan);
  categories.push({
    label: "Application Control",
    score: acPct,
    maxScore: 100,
    pct: acPct,
    details:
      activeWan > 0
        ? `${ip.withAppControl}/${activeWan} enabled WAN rules have app control`
        : "No enabled WAN rules detected",
  });

  // 4. Authentication & MFA
  const mfaFindings = findings.filter((f) => f.section === "Authentication & OTP");
  const mfaScore = mfaFindings.length === 0 ? 100 : clamp(100 - mfaFindings.length * 25);
  categories.push({
    label: "Authentication",
    score: mfaScore,
    maxScore: 100,
    pct: mfaScore,
    details:
      mfaFindings.length === 0
        ? "MFA/OTP enabled across all detected areas"
        : `${mfaFindings.length} MFA/OTP issue${mfaFindings.length > 1 ? "s" : ""} detected`,
  });

  // 5. Logging & Visibility
  const loggingFindings = findings.filter((f) => f.title.includes("logging disabled"));
  const loggingDisabledCount =
    loggingFindings.length > 0 ? parseInt(loggingFindings[0].title.match(/\d+/)?.[0] ?? "0") : 0;
  const loggingPct =
    stats.totalRules > 0
      ? clamp(Math.round(((stats.totalRules - loggingDisabledCount) / stats.totalRules) * 100))
      : 100;
  categories.push({
    label: "Logging",
    score: loggingPct,
    maxScore: 100,
    pct: loggingPct,
    details:
      loggingDisabledCount === 0
        ? "Logging enabled on all rules"
        : `${loggingDisabledCount} rule${loggingDisabledCount > 1 ? "s" : ""} with logging disabled`,
  });

  // 6. Rule Hygiene & SSL/TLS Inspection — penalise broad rules, duplicates, disabled rules, missing SSL/TLS
  const broadFindings = findings.filter((f) => f.title.includes("broad source"));
  const _dupeFindings = findings.filter((f) => f.title.includes("overlapping"));
  const anyServiceFindings = findings.filter((f) => f.title.includes('"ANY" service'));
  const fullyOpenFindings = findings.filter((f) => f.title.includes("fully open rule"));
  let segScore = 100;
  const segDetails: string[] = [];

  if (broadFindings.length > 0) {
    segScore -= 20;
    segDetails.push("broad rules (-20)");
  }
  if (fullyOpenFindings.length > 0) {
    const openCount = parseInt(fullyOpenFindings[0].title.match(/\d+/)?.[0] ?? "0");
    const penalty = Math.min(25, openCount * 3);
    segScore -= penalty;
    segDetails.push(`${openCount} fully open rules (-${penalty})`);
  }
  if (anyServiceFindings.length > 0) {
    const anyCount = parseInt(anyServiceFindings[0].title.match(/\d+/)?.[0] ?? "0");
    const penalty = Math.min(25, anyCount * 5);
    segScore -= penalty;
    segDetails.push(`${anyCount} ANY service rules (-${penalty})`);
  }
  // Overlapping detection removed — unreliable across HTML/API data sources
  if (!ip.dpiEngineEnabled && ip.totalWanRules > 0) {
    segScore -= 25;
    segDetails.push("no SSL/TLS Decrypt (DPI inactive) (-25)");
  }
  if (ip.sslUncoveredZones.length > 0) {
    const penalty = Math.min(15, ip.sslUncoveredZones.length * 5);
    segScore -= penalty;
    segDetails.push(
      `zone gaps: ${ip.sslUncoveredZones.map((z) => z.toUpperCase()).join(", ")} (-${penalty})`,
    );
  }
  if (ip.disabledWanRules > 0 && ip.totalWanRules > 0) {
    const disabledPct = ip.disabledWanRules / ip.totalWanRules;
    const penalty = Math.round(disabledPct * 15);
    segScore -= penalty;
    segDetails.push(`${ip.disabledWanRules} disabled WAN rules (-${penalty})`);
  }

  segScore = clamp(segScore);

  categories.push({
    label: "Rule Hygiene",
    score: segScore,
    maxScore: 100,
    pct: segScore,
    details:
      segDetails.length === 0
        ? "Good rule hygiene and SSL/TLS inspection active"
        : segDetails.join(", "),
  });

  // 7. Admin Access Exposure
  const adminFindings = findings.filter((f) =>
    /admin console|ssh accessible|snmp exposed|management service.*exposed/i.test(f.title),
  );
  const adminScore =
    adminFindings.length === 0
      ? 100
      : clamp(
          100 -
            adminFindings.reduce(
              (s, f) => s + (f.severity === "critical" ? 40 : f.severity === "high" ? 25 : 10),
              0,
            ),
        );
  categories.push({
    label: "Admin Access",
    score: adminScore,
    maxScore: 100,
    pct: adminScore,
    details:
      adminFindings.length === 0
        ? "No management services exposed to untrusted zones"
        : `${adminFindings.length} admin exposure issue${adminFindings.length > 1 ? "s" : ""} detected`,
  });

  // 8. Anti-Malware
  const avFindings = findings.filter((f) => /virus scanning|sandboxing|zero-day/i.test(f.title));
  const avScore =
    avFindings.length === 0
      ? 100
      : clamp(100 - avFindings.reduce((s, f) => s + (f.severity === "high" ? 30 : 15), 0));
  categories.push({
    label: "Anti-Malware",
    score: avScore,
    maxScore: 100,
    pct: avScore,
    details:
      avFindings.length === 0
        ? "Anti-malware scanning active across protocols"
        : `${avFindings.length} malware scanning gap${avFindings.length > 1 ? "s" : ""} detected`,
  });

  // 9. Network Security — VPN, DoS, wireless, SNMP, syslog
  const netFindings = findings.filter((f) =>
    /vpn.*weak|perfect forward|pre-shared key|dos|spoof|syn flood|wireless.*encryption|snmp communit|syslog|external.*log/i.test(
      f.title,
    ),
  );
  let netScore = 100;
  for (const f of netFindings) {
    if (f.severity === "critical") netScore -= 30;
    else if (f.severity === "high") netScore -= 20;
    else if (f.severity === "medium") netScore -= 10;
    else if (f.severity === "low") netScore -= 5;
  }
  netScore = clamp(netScore);
  categories.push({
    label: "Network Security",
    score: netScore,
    maxScore: 100,
    pct: netScore,
    details:
      netFindings.length === 0
        ? "VPN, DoS protection, wireless, and SNMP properly configured"
        : `${netFindings.length} network security issue${netFindings.length > 1 ? "s" : ""} detected`,
  });

  const overall = Math.round(categories.reduce((sum, c) => sum + c.pct, 0) / categories.length);
  const grade: RiskScoreResult["grade"] =
    overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";

  return { overall, grade, categories };
}
