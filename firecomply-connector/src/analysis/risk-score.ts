/**
 * Risk score computation — ported from the FireComply web app.
 * Produces the same scoring model so agent and web app scores match.
 */

import type { AnalysisResult, RiskScoreResult, CategoryScore } from "./types";

function pctScore(have: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((have / total) * 100);
}

export function computeRiskScore(result: AnalysisResult): RiskScoreResult {
  const { findings, inspectionPosture: ip } = result;
  const categories: CategoryScore[] = [];

  // Web Filtering
  const wfPct = pctScore(ip.withWebFilter, ip.webFilterableRules);
  categories.push({
    label: "Web Filtering",
    score: wfPct, maxScore: 100, pct: wfPct,
    details: ip.webFilterableRules > 0
      ? `${ip.withWebFilter}/${ip.webFilterableRules} enabled WAN rules have web filtering`
      : "No enabled WAN rules with HTTP/HTTPS/ANY service",
  });

  // Intrusion Prevention
  const ipsPct = pctScore(ip.withIps, ip.enabledWanRules);
  categories.push({
    label: "Intrusion Prevention",
    score: ipsPct, maxScore: 100, pct: ipsPct,
    details: `${ip.withIps}/${ip.enabledWanRules} enabled WAN rules have IPS`,
  });

  // Encryption / SSL Inspection
  const sslPct = ip.enabledWanRules > 0 ? (ip.dpiEngineEnabled ? 80 : 20) : 100;
  categories.push({
    label: "Encryption",
    score: sslPct, maxScore: 100, pct: sslPct,
    details: ip.dpiEngineEnabled ? `${ip.sslDecryptRules} SSL/TLS decrypt rules active` : "No SSL/TLS inspection",
  });

  // Rule Hygiene
  const disabledPenalty = Math.min(ip.totalDisabledRules * 5, 50);
  const hygienePct = Math.max(0, 100 - disabledPenalty);
  categories.push({
    label: "Rule Hygiene",
    score: hygienePct, maxScore: 100, pct: hygienePct,
    details: `${ip.totalDisabledRules} disabled rules`,
  });

  // Threat Prevention (severity-weighted penalty from findings)
  const severityWeights: Record<string, number> = { critical: 20, high: 12, medium: 6, low: 2, info: 0 };
  const totalPenalty = findings.reduce((sum, f) => sum + (severityWeights[f.severity] ?? 0), 0);
  const threatPct = Math.max(0, 100 - totalPenalty);
  categories.push({
    label: "Threat Prevention",
    score: threatPct, maxScore: 100, pct: threatPct,
    details: `${findings.length} findings (penalty: ${totalPenalty})`,
  });

  // Logging & Visibility
  const loggedRules = ip.enabledWanRules; // Assume logged unless finding says otherwise
  const noLogFindings = findings.filter((f) => f.title.toLowerCase().includes("logging disabled")).length;
  const logPct = ip.enabledWanRules > 0
    ? pctScore(ip.enabledWanRules - noLogFindings, ip.enabledWanRules)
    : 100;
  categories.push({
    label: "Logging",
    score: logPct, maxScore: 100, pct: logPct,
    details: noLogFindings > 0 ? `${noLogFindings} rules without logging` : "All rules logged",
  });

  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.pct, 0) / categories.length
  );
  const grade: RiskScoreResult["grade"] =
    overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";

  return { overall, grade, categories };
}
