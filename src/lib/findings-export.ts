import type { AnalysisResult, Finding } from "./analyse-config";

function escCsv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportFindingsCsv(analysisResults: Record<string, AnalysisResult>): string {
  const rows: string[] = ["Firewall,Severity,Title,Section,Detail,Remediation"];
  for (const [label, result] of Object.entries(analysisResults)) {
    for (const f of result.findings) {
      rows.push([
        escCsv(label),
        escCsv(f.severity),
        escCsv(f.title),
        escCsv(f.section),
        escCsv(f.detail),
        escCsv(f.remediation ?? ""),
      ].join(","));
    }
  }
  return rows.join("\n");
}

export function downloadCsv(analysisResults: Record<string, AnalysisResult>) {
  const csv = exportFindingsCsv(analysisResults);
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
      case "critical": return "#EA0022";
      case "high": return "#F29400";
      case "medium": return "#F8E300";
      case "low": return "#00995a";
      default: return "#009CFB";
    }
  };

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>FireComply Findings</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 2rem; color: #1a1a1a; font-size: 11px; }
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
<table><thead><tr><th>Severity</th><th>Finding</th><th>Section</th><th>Firewall</th><th>Detail</th><th>Remediation</th></tr></thead><tbody>
${allFindings.map((f) => `<tr>
  <td><span class="sev" style="background:${sevColor(f.severity)}">${f.severity}</span></td>
  <td style="font-weight:600">${esc(f.title)}</td>
  <td>${esc(f.section)}</td>
  <td>${esc(f.firewall)}</td>
  <td class="detail">${esc(f.detail)}</td>
  <td class="rem">${esc(f.remediation ?? "—")}</td>
</tr>`).join("\n")}
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
