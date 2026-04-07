/**
 * Tab values for {@link AnalysisTabs} on Assess (`/`). Used for URL ?tab= deep links and help docs.
 */
export const ASSESS_ANALYSIS_TAB_VALUES = [
  "overview",
  "security",
  "compliance",
  "remediation",
  "optimisation",
  "tools",
  "insurance-readiness",
  "compare",
] as const;

export type AssessAnalysisTabValue = (typeof ASSESS_ANALYSIS_TAB_VALUES)[number];

export function isAssessAnalysisTabValue(v: string): v is AssessAnalysisTabValue {
  return (ASSESS_ANALYSIS_TAB_VALUES as readonly string[]).includes(v);
}
