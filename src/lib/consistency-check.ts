import type { AnalysisResult, InspectionPosture } from "./analyse-config";
import { computeRiskScore } from "./risk-score";

export interface ConsistencyGap {
  metric: string;
  category: string;
  severity: "critical" | "high" | "medium" | "info";
  firewalls: { label: string; value: string }[];
  recommendation: string;
}

export function checkConsistency(
  analysisResults: Record<string, AnalysisResult>,
): ConsistencyGap[] {
  const labels = Object.keys(analysisResults);
  if (labels.length < 2) return [];

  const gaps: ConsistencyGap[] = [];

  const postures = labels.map((l) => ({ label: l, ip: analysisResults[l].inspectionPosture }));
  const scores = labels.map((l) => ({ label: l, score: computeRiskScore(analysisResults[l]) }));

  // 1. SSL/TLS Inspection consistency
  const withDpi = postures.filter((p) => p.ip.dpiEngineEnabled);
  const withoutDpi = postures.filter((p) => !p.ip.dpiEngineEnabled && p.ip.totalWanRules > 0);
  if (withDpi.length > 0 && withoutDpi.length > 0) {
    gaps.push({
      metric: "SSL/TLS Inspection (DPI)",
      category: "Traffic Inspection",
      severity: "critical",
      firewalls: [
        ...withDpi.map((p) => ({ label: p.label, value: `Active (${p.ip.sslDecryptRules} Decrypt rules)` })),
        ...withoutDpi.map((p) => ({ label: p.label, value: "Inactive — no Decrypt rules" })),
      ],
      recommendation: "Enable SSL/TLS Decrypt rules on all firewalls to ensure consistent encrypted traffic inspection across the estate.",
    });
  }

  // 2. Web Filtering coverage
  checkPctConsistency(postures, "Web Filtering", (ip) => ip.webFilterableRules > 0 ? Math.round((ip.withWebFilter / ip.webFilterableRules) * 100) : -1, gaps);

  // 3. IPS coverage
  checkPctConsistency(postures, "IPS Coverage", (ip) => ip.enabledWanRules > 0 ? Math.round((ip.withIps / ip.enabledWanRules) * 100) : -1, gaps);

  // 4. Application Control
  checkPctConsistency(postures, "Application Control", (ip) => ip.enabledWanRules > 0 ? Math.round((ip.withAppControl / ip.enabledWanRules) * 100) : -1, gaps);

  // 5. Overall score spread
  const scoreValues = scores.map((s) => s.score.overall);
  const maxScore = Math.max(...scoreValues);
  const minScore = Math.min(...scoreValues);
  if (maxScore - minScore >= 20) {
    gaps.push({
      metric: "Overall Risk Score Spread",
      category: "Risk Posture",
      severity: maxScore - minScore >= 35 ? "high" : "medium",
      firewalls: scores.map((s) => ({ label: s.label, value: `${s.score.overall} (Grade ${s.score.grade})` })),
      recommendation: `There is a ${maxScore - minScore}-point spread in risk scores. Align the lowest-scoring firewalls with the security policies of the highest-scoring ones.`,
    });
  }

  // 6. Grade consistency
  const grades = new Set(scores.map((s) => s.score.grade));
  if (grades.size > 1) {
    gaps.push({
      metric: "Grade Inconsistency",
      category: "Risk Posture",
      severity: "medium",
      firewalls: scores.map((s) => ({ label: s.label, value: `Grade ${s.score.grade}` })),
      recommendation: "Standardise security policies to achieve a consistent grade across all firewalls.",
    });
  }

  // 7. Admin access exposure
  for (const label of labels) {
    const adminFindings = analysisResults[label].findings.filter((f) =>
      /admin console|ssh accessible|snmp exposed/i.test(f.title)
    );
    if (adminFindings.length > 0) {
      const othersClean = labels.filter((l) => l !== label).every((l) =>
        !analysisResults[l].findings.some((f) => /admin console|ssh accessible|snmp exposed/i.test(f.title))
      );
      if (othersClean) {
        gaps.push({
          metric: "Admin Access Exposure",
          category: "Access Control",
          severity: "high",
          firewalls: [
            { label, value: `${adminFindings.length} admin exposure issue${adminFindings.length > 1 ? "s" : ""}` },
            ...labels.filter((l) => l !== label).map((l) => ({ label: l, value: "No admin exposure" })),
          ],
          recommendation: `${label} has management services exposed that are secured on other firewalls. Align the Device access configuration.`,
        });
      }
    }
  }

  return gaps;
}

function checkPctConsistency(
  postures: Array<{ label: string; ip: InspectionPosture }>,
  metric: string,
  getPct: (ip: InspectionPosture) => number,
  gaps: ConsistencyGap[],
) {
  const values = postures.map((p) => ({ label: p.label, pct: getPct(p.ip) })).filter((v) => v.pct >= 0);
  if (values.length < 2) return;

  const max = Math.max(...values.map((v) => v.pct));
  const min = Math.min(...values.map((v) => v.pct));
  if (max - min < 30) return;

  gaps.push({
    metric,
    category: "Traffic Inspection",
    severity: max - min >= 60 ? "high" : "medium",
    firewalls: values.map((v) => ({ label: v.label, value: `${v.pct}%` })),
    recommendation: `${metric} coverage varies by ${max - min}% across the estate. Standardise policies on the weaker firewalls.`,
  });
}
