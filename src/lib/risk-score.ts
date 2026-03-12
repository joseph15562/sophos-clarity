import type { AnalysisResult, InspectionPosture } from "./analyse-config";

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

  // 1. Web Filtering (0-100)
  const wfPct = pctScore(ip.withWebFilter, ip.totalWanRules);
  categories.push({
    label: "Web Filtering",
    score: wfPct,
    maxScore: 100,
    pct: wfPct,
    details: ip.totalWanRules > 0
      ? `${ip.withWebFilter}/${ip.totalWanRules} WAN rules have web filtering`
      : "No WAN rules detected",
  });

  // 2. Intrusion Prevention (0-100)
  const ipsPct = pctScore(ip.withIps, ip.totalWanRules);
  categories.push({
    label: "Intrusion Prevention",
    score: ipsPct,
    maxScore: 100,
    pct: ipsPct,
    details: ip.totalWanRules > 0
      ? `${ip.withIps}/${ip.totalWanRules} WAN rules have IPS enabled`
      : "No WAN rules detected",
  });

  // 3. Application Control (0-100)
  const acPct = pctScore(ip.withAppControl, ip.totalWanRules);
  categories.push({
    label: "Application Control",
    score: acPct,
    maxScore: 100,
    pct: acPct,
    details: ip.totalWanRules > 0
      ? `${ip.withAppControl}/${ip.totalWanRules} WAN rules have app control`
      : "No WAN rules detected",
  });

  // 4. Authentication & MFA (0-100)
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

  // 5. Logging & Visibility (0-100)
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

  // 6. Network Segmentation (0-100) — penalize broad any-to-any rules and duplicates
  const broadFindings = findings.filter((f) => f.title.includes("broad source"));
  const dupeFindings = findings.filter((f) => f.title.includes("overlapping"));
  const anyServiceFindings = findings.filter((f) => f.title.includes('"ANY" service'));
  let segScore = 100;
  if (broadFindings.length > 0) segScore -= 30;
  if (anyServiceFindings.length > 0) {
    const anyCount = parseInt(anyServiceFindings[0].title.match(/\d+/)?.[0] ?? "0");
    segScore -= Math.min(30, anyCount * 5);
  }
  if (dupeFindings.length > 0) segScore -= 15;
  if (ip.withSslInspection === 0 && ip.totalWanRules > 0) segScore -= 10;
  segScore = clamp(segScore);
  categories.push({
    label: "Segmentation",
    score: segScore,
    maxScore: 100,
    pct: segScore,
    details: segScore >= 80
      ? "Good network segmentation practices"
      : "Broad rules or poor segmentation detected",
  });

  const overall = Math.round(categories.reduce((sum, c) => sum + c.pct, 0) / categories.length);
  const grade: RiskScoreResult["grade"] =
    overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";

  return { overall, grade, categories };
}
