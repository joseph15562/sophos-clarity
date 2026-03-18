/** Analysis tab identifiers — use these instead of string literals. */
export const ANALYSIS_TAB = {
  OVERVIEW: "overview",
  REMEDIATION: "remediation",
  COMPARE: "compare",
} as const;

export type AnalysisTabId = (typeof ANALYSIS_TAB)[keyof typeof ANALYSIS_TAB];

/** Report identifiers for special report types. Per-firewall reports use `reportIdForFile(fileId)`. */
export const REPORT_ID = {
  EXECUTIVE: "report-executive",
  EXECUTIVE_ONE_PAGER: "report-executive-one-pager",
  COMPLIANCE: "report-compliance",
} as const;

export function reportIdForFile(fileId: string): string {
  return `report-${fileId}`;
}
