/**
 * Risk register CSV export for FireComply findings.
 * Maps analysis findings to standard risk register columns.
 */

import type { AnalysisResult, Severity } from "./analyse-config";

const SEVERITY_MAP: Record<Severity, string> = {
  critical: "Very High",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

const LIKELIHOOD_MAP: Record<Severity, string> = {
  critical: "Almost Certain",
  high: "Likely",
  medium: "Possible",
  low: "Unlikely",
  info: "Rare",
};

const IMPACT_MAP: Record<Severity, string> = {
  critical: "Severe",
  high: "Major",
  medium: "Moderate",
  low: "Minor",
  info: "Negligible",
};

function escCsv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + "...";
}

/**
 * Generates a risk register CSV from analysis results.
 * @param analysisResults - Record of firewall label → analysis result
 * @param customerName - Customer/organisation name for context
 * @returns CSV string with risk register columns
 */
export function generateRiskRegisterCSV(
  analysisResults: Record<string, AnalysisResult>,
  _customerName: string
): string {
  const headers = [
    "Risk ID",
    "Description",
    "Severity",
    "Likelihood",
    "Impact",
    "Current Controls",
    "Recommended Controls",
    "Owner",
    "Due Date",
    "Status",
  ];
  const rows: string[] = [headers.join(",")];

  let riskId = 1;
  for (const [_label, result] of Object.entries(analysisResults)) {
    for (const finding of result.findings) {
      const description = `${finding.title}${finding.detail ? ` — ${finding.detail}` : ""}`.trim();
      const severity = SEVERITY_MAP[finding.severity] ?? finding.severity;
      const likelihood = LIKELIHOOD_MAP[finding.severity] ?? "Possible";
      const impact = IMPACT_MAP[finding.severity] ?? "Moderate";
      const currentControls = finding.section ?? "";
      const recommendedControls = truncate(finding.remediation ?? "", 200);

      rows.push(
        [
          escCsv(`RISK-${String(riskId).padStart(4, "0")}`),
          escCsv(description),
          escCsv(severity),
          escCsv(likelihood),
          escCsv(impact),
          escCsv(currentControls),
          escCsv(recommendedControls),
          "", // Owner (blank)
          "", // Due Date (blank)
          escCsv("Open"), // Status
        ].join(",")
      );
      riskId++;
    }
  }

  return rows.join("\n");
}

/**
 * Downloads the risk register as a CSV file.
 */
export function downloadRiskRegisterCSV(
  analysisResults: Record<string, AnalysisResult>,
  customerName: string
): void {
  const csv = generateRiskRegisterCSV(analysisResults, customerName);
  const slug = (customerName || "risk-register").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `risk-register-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generates a risk register as an HTML table for Excel (.xls) export.
 * Excel opens HTML tables with .xls extension correctly.
 */
function generateRiskRegisterHtml(
  analysisResults: Record<string, AnalysisResult>,
  _customerName: string
): string {
  const headers = [
    "Risk ID",
    "Description",
    "Severity",
    "Likelihood",
    "Impact",
    "Current Controls",
    "Recommended Controls",
    "Owner",
    "Due Date",
    "Status",
  ];
  const headerRow = headers.map((h) => `<th>${escHtml(h)}</th>`).join("");
  const rows: string[] = [`<tr>${headerRow}</tr>`];

  let riskId = 1;
  for (const [_label, result] of Object.entries(analysisResults)) {
    for (const finding of result.findings) {
      const description = `${finding.title}${finding.detail ? ` — ${finding.detail}` : ""}`.trim();
      const severity = SEVERITY_MAP[finding.severity] ?? finding.severity;
      const likelihood = LIKELIHOOD_MAP[finding.severity] ?? "Possible";
      const impact = IMPACT_MAP[finding.severity] ?? "Moderate";
      const currentControls = finding.section ?? "";
      const recommendedControls = truncate(finding.remediation ?? "", 200);

      const cells = [
        escHtml(`RISK-${String(riskId).padStart(4, "0")}`),
        escHtml(description),
        escHtml(severity),
        escHtml(likelihood),
        escHtml(impact),
        escHtml(currentControls),
        escHtml(recommendedControls),
        "",
        "",
        escHtml("Open"),
      ];
      rows.push(`<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`);
      riskId++;
    }
  }

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body>
<table border="1">
${rows.join("\n")}
</table>
</body>
</html>`;
}

/**
 * Downloads the risk register as an Excel (.xls) file.
 * Uses HTML table format which Excel opens correctly without the xlsx package.
 */
export function downloadRiskRegisterExcel(
  analysisResults: Record<string, AnalysisResult>,
  customerName: string
): void {
  const html = generateRiskRegisterHtml(analysisResults, customerName);
  const slug = (customerName || "risk-register").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
  const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `risk-register-${slug}-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
