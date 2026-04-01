import type { AnalysisResult, Finding } from "./analyse-config";
import type { AssessmentSnapshot } from "./assessment-history";
import { ALL_FRAMEWORK_NAMES, controlIdsForFindingExport } from "./compliance-map";
import { validateFindingExportMetadata } from "./report-export-validation";

export type FindingsCsvReviewerSignoff = {
  signedBy: string;
  signedAt: string;
  notes?: string | null;
};

/** Maps a cloud assessment snapshot to CSV sign-off metadata (requires both signatory and timestamp). */
export function signoffFromAssessmentSnapshot(
  snap: AssessmentSnapshot | null | undefined,
): FindingsCsvReviewerSignoff | null {
  const by = snap?.reviewerSignedBy?.trim();
  const at = snap?.reviewerSignedAt;
  if (!by || !at) return null;
  const signedAt = typeof at === "string" ? at : String(at);
  return {
    signedBy: by,
    signedAt,
    notes: snap?.reviewerSignoffNotes ?? null,
  };
}

function escCsv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportFindingsCsv(
  analysisResults: Record<string, AnalysisResult>,
  frameworks: string[] = ALL_FRAMEWORK_NAMES,
  reviewerSignoff?: FindingsCsvReviewerSignoff | null,
): string {
  const rows: string[] = ["Firewall,Severity,Title,Section,Control IDs,Detail,Remediation"];
  for (const [label, result] of Object.entries(analysisResults)) {
    for (const f of result.findings) {
      const controlIds = controlIdsForFindingExport(f.title, frameworks);
      void validateFindingExportMetadata({
        severity: f.severity,
        controlIds,
        title: f.title,
        detail: f.detail,
      });
      rows.push(
        [
          escCsv(label),
          escCsv(f.severity),
          escCsv(f.title),
          escCsv(f.section),
          escCsv(controlIds),
          escCsv(f.detail),
          escCsv(f.remediation ?? ""),
        ].join(","),
      );
    }
  }
  if (reviewerSignoff?.signedBy && reviewerSignoff.signedAt) {
    rows.push("");
    rows.push(`# Reviewer sign-off`);
    rows.push(`# Signed by,${escCsv(reviewerSignoff.signedBy)}`);
    rows.push(`# Signed at (UTC),${escCsv(reviewerSignoff.signedAt)}`);
    if (reviewerSignoff.notes?.trim()) {
      rows.push(`# Notes,${escCsv(reviewerSignoff.notes.trim())}`);
    }
  }
  return rows.join("\n");
}

export function downloadCsv(
  analysisResults: Record<string, AnalysisResult>,
  opts?: {
    frameworks?: string[];
    reviewerSignoff?: FindingsCsvReviewerSignoff | null;
  },
) {
  const fw = opts?.frameworks?.length ? opts.frameworks : ALL_FRAMEWORK_NAMES;
  const csv = exportFindingsCsv(analysisResults, fw, opts?.reviewerSignoff);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `firecomply-findings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export function downloadFindingsPdf(analysisResults: Record<string, AnalysisResult>) {
  const allFindings: (Finding & { firewall: string })[] = [];
  for (const [label, result] of Object.entries(analysisResults)) {
    for (const f of result.findings) {
      allFindings.push({ ...f, firewall: label });
    }
  }
  allFindings.sort((a, b) => (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5));

  const sevColor = (s: string) => {
    switch (s) {
      case "critical":
        return "#EA0022";
      case "high":
        return "#F29400";
      case "medium":
        return "#a16207";
      case "low":
        return "#00F2B3";
      default:
        return "#009CFB";
    }
  };

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Zalando+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
<title>FireComply Findings</title>
<style>
  body { font-family: 'Zalando Sans', system-ui, sans-serif; margin: 2rem; color: #1a1a1a; font-size: 11px; }
  h1 { font-size: 18px; color: #10037C; margin-bottom: 4px; }
  .meta { color: #666; font-size: 10px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #f4f4f5; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e4e4e7; }
  td { padding: 6px 8px; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
  .sev { font-weight: 700; font-size: 10px; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; color: white; display: inline-block; }
  .detail { color: #555; font-size: 10px; }
  .rem { color: #10037C; font-size: 10px; font-style: italic; }
  @media print { body { margin: 1cm; } }
</style></head><body>
<h1>Sophos FireComply — Security Findings</h1>
<p class="meta">Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · ${allFindings.length} findings across ${Object.keys(analysisResults).length} firewall${Object.keys(analysisResults).length !== 1 ? "s" : ""}</p>
<table><thead><tr><th>Severity</th><th>Finding</th><th>Section</th><th>Firewall</th><th>Control IDs</th><th>Detail</th><th>Remediation</th></tr></thead><tbody>
${allFindings
  .map((f) => {
    const cids = controlIdsForFindingExport(f.title, ALL_FRAMEWORK_NAMES);
    return `<tr>
  <td><span class="sev" style="background:${sevColor(f.severity)}">${f.severity}</span></td>
  <td style="font-weight:600">${esc(f.title)}</td>
  <td>${esc(f.section)}</td>
  <td>${esc(f.firewall)}</td>
  <td style="font-size:9px">${esc(cids || "—")}</td>
  <td class="detail">${esc(f.detail)}</td>
  <td class="rem">${esc(f.remediation ?? "—")}</td>
</tr>`;
  })
  .join("\n")}
</tbody></table></body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (w) {
    w.addEventListener("load", () => {
      w.print();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
