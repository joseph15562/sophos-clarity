/** Lightweight checks for compliance-oriented exports (Phase 4 validation layer). */

import type { AnalysisResult } from "./analyse-config";
import { controlIdsForFindingExport } from "./compliance-map";

export type ExportValidationIssue = { message: string; findingTitle?: string };

export function validateFindingExportMetadata(opts: {
  severity: string;
  controlIds: string;
  title?: string;
  detail?: string;
}): ExportValidationIssue[] {
  const issues: ExportValidationIssue[] = [];
  const sev = opts.severity.toLowerCase();
  if ((sev === "critical" || sev === "high") && !opts.controlIds.trim()) {
    issues.push({
      message:
        "High or critical finding has no mapped control IDs — confirm framework mapping or document manually.",
      findingTitle: opts.title,
    });
  }
  if (
    opts.detail !== undefined &&
    !String(opts.detail).trim() &&
    (sev === "critical" || sev === "high")
  ) {
    issues.push({
      message: "High or critical finding has empty detail — add context for reviewers.",
      findingTitle: opts.title,
    });
  }
  return issues;
}

/** Deduplicated messages for export UI banners. */
export function collectFindingExportValidationIssues(
  analysisResults: Record<string, AnalysisResult>,
  frameworks: string[],
): ExportValidationIssue[] {
  const out: ExportValidationIssue[] = [];
  const seen = new Set<string>();
  for (const result of Object.values(analysisResults)) {
    for (const f of result.findings) {
      const controlIds = controlIdsForFindingExport(f.title, frameworks);
      const batch = validateFindingExportMetadata({
        severity: f.severity,
        controlIds,
        title: f.title,
        detail: f.detail,
      });
      for (const iss of batch) {
        const key = `${iss.message}@@${iss.findingTitle ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(iss);
      }
    }
  }
  return out;
}
