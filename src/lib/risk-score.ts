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
    details: ip.webFilterableRules > 0
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
    details: activeWan > 0
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
    details: activeWan > 0
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
    details: mfaFindings.length === 0
      ? "MFA/OTP enabled across all detected areas"
      : `${mfaFindings.length} MFA/OTP issue${mfaFindings.length > 1 ? "s" : ""} detected`,
  });

  // 5. Logging & Visibility
  const loggingFindings = findings.filter((f) => f.title.includes("logging disabled"));
  const loggingDisabledCount = loggingFindings.length > 0
    ? parseInt(loggingFindings[0].title.match(/\d+/)?.[0] ?? "0")
    : 0;
  const loggingPct = stats.totalRules > 0
    ? clamp(Math.round(((stats.totalRules - loggingDisabledCount) / stats.totalRules) * 100))
    : 100;
  categories.push({
    label: "Logging",
    score: loggingPct,
    maxScore: 100,
    pct: loggingPct,
    details: loggingDisabledCount === 0
      ? "Logging enabled on all rules"
      : `${loggingDisabledCount} rule${loggingDisabledCount > 1 ? "s" : ""} with logging disabled`,
  });

  // 6. Rule Hygiene & DPI — penalise broad rules, duplicates, disabled rules, DPI engine off
  const broadFindings = findings.filter((f) => f.title.includes("broad source"));
  const dupeFindings = findings.filter((f) => f.title.includes("overlapping"));
  const anyServiceFindings = findings.filter((f) => f.title.includes('"ANY" service'));
  let segScore = 100;

  // DPI engine off = catastrophic — no inspection works at all
  if (ip.dpiEngineEnabled === false) segScore -= 40;

  if (broadFindings.length > 0) segScore -= 20;
  if (anyServiceFindings.length > 0) {
    const anyCount = parseInt(anyServiceFindings[0].title.match(/\d+/)?.[0] ?? "0");
    segScore -= Math.min(25, anyCount * 5);
  }
  if (dupeFindings.length > 0) segScore -= 10;
  if (ip.withSslInspection === 0 && ip.totalWanRules > 0) segScore -= 10;

  // Penalise for disabled WAN rules — suggests abandoned or incomplete policy
  if (ip.disabledWanRules > 0 && ip.totalWanRules > 0) {
    const disabledPct = ip.disabledWanRules / ip.totalWanRules;
    segScore -= Math.round(disabledPct * 15);
  }

  segScore = clamp(segScore);
  const segDetails: string[] = [];
  if (ip.dpiEngineEnabled === false) segDetails.push("DPI engine disabled");
  if (ip.disabledWanRules > 0) segDetails.push(`${ip.disabledWanRules} disabled WAN rules`);
  if (broadFindings.length > 0) segDetails.push("broad rules detected");
  if (anyServiceFindings.length > 0) segDetails.push("ANY service rules");
  if (dupeFindings.length > 0) segDetails.push("overlapping rules");
  if (ip.withSslInspection === 0 && ip.totalWanRules > 0) segDetails.push("no SSL/TLS inspection");

  categories.push({
    label: "Rule Hygiene",
    score: segScore,
    maxScore: 100,
    pct: segScore,
    details: segDetails.length === 0
      ? "Good rule hygiene and DPI engine active"
      : segDetails.join(", "),
  });

  // If DPI engine is off, cap the inspection-dependent categories
  if (ip.dpiEngineEnabled === false) {
    for (const cat of categories) {
      if (["Web Filtering", "Intrusion Prevention", "Application Control"].includes(cat.label)) {
        cat.pct = 0;
        cat.score = 0;
        cat.details = `DPI engine disabled — ${cat.label.toLowerCase()} cannot function`;
      }
    }
  }

  const overall = Math.round(categories.reduce((sum, c) => sum + c.pct, 0) / categories.length);
  const grade: RiskScoreResult["grade"] =
    overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";

  return { overall, grade, categories };
}
