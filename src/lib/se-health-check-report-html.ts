/**
 * HTML body for SE Sophos Firewall Health Check PDF export (wrapped by buildPdfHtml).
 * All user-controlled strings must pass through escapeHtml.
 */

import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import type { BaselineResult } from "@/lib/policy-baselines";
import type { SophosBPScore, LicenceSelection } from "@/lib/sophos-licence";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import type { ParsedFile } from "@/hooks/use-report-generation";

const SEVERITY_ORDER: Finding["severity"][] = ["critical", "high", "medium", "low", "info"];

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sortedFindings(result: AnalysisResult): Finding[] {
  return [...result.findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}

function countBySeverity(findings: Finding[]): Record<Finding["severity"], number> {
  const m: Record<Finding["severity"], number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const f of findings) {
    m[f.severity] = (m[f.severity] ?? 0) + 1;
  }
  return m;
}

function licenceAssumptionLabel(licence: LicenceSelection): string {
  if (licence.tier === "xstream") return "Xstream Protection";
  if (licence.tier === "standard") return "Standard Protection";
  return "Individual modules";
}

export interface SEHealthCheckReportParams {
  labels: string[];
  files: ParsedFile[];
  analysisResults: Record<string, AnalysisResult>;
  baselineResults: Record<string, BaselineResult>;
  bpByLabel: Record<string, SophosBPScore>;
  licence: LicenceSelection;
  customerName: string;
  /** Recipient organisation or contact (defaults to customer name when omitted) */
  preparedFor?: string;
  preparedBy: string;
  dpiExemptZones: string[];
  dpiExemptNetworks: string[];
  webFilterComplianceMode: WebFilterComplianceMode;
  webFilterExemptRuleNames: string[];
  centralValidated: boolean;
  generatedAt: Date;
  /** Optional build/version string for provenance */
  appVersion?: string;
}

function fileExportType(fileName: string): string {
  return /\.xml$/i.test(fileName) ? "Entities XML" : "HTML export";
}

/**
 * Build inner HTML only (no html/head). Consumed by buildPdfHtml().
 */
export function buildSEHealthCheckReportHtml(p: SEHealthCheckReportParams): string {
  const {
    labels,
    files,
    analysisResults,
    baselineResults,
    bpByLabel,
    licence,
    customerName,
    preparedFor: preparedForParam,
    preparedBy,
    dpiExemptZones,
    dpiExemptNetworks,
    webFilterComplianceMode,
    webFilterExemptRuleNames,
    centralValidated,
    generatedAt,
    appVersion,
  } = p;

  const dateLocal = generatedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dateUtc = generatedAt.toISOString();

  const coverCustomer = customerName.trim() || "—";
  const coverPreparedFor = (preparedForParam ?? customerName).trim() || "—";
  const coverPrepared = preparedBy.trim() || "—";
  const copyYear = String(generatedAt.getFullYear());

  const parts: string[] = [];

  /* Page 1 — Central-style dark cover (white type, single metadata band) */
  parts.push(`<div class="se-hc-cover-fullpage">`);
  parts.push(`<div class="se-hc-cover-top">`);
  parts.push(`<h1 id="cover-title">Sophos Firewall Health Check</h1>`);
  parts.push(
    `<p class="se-hc-cover-tagline">Sales Engineer configuration assessment · Sophos FireComply</p>`,
  );
  parts.push(`</div>`);
  parts.push(
    `<p class="se-hc-cover-meta">Customer name: ${escapeHtml(coverCustomer)} &nbsp;·&nbsp; Prepared for: ${escapeHtml(coverPreparedFor)} &nbsp;·&nbsp; Prepared by: ${escapeHtml(coverPrepared)} &nbsp;·&nbsp; Date: ${escapeHtml(dateLocal)}</p>`,
  );
  parts.push(`<div class="se-hc-cover-bottom">`);
  parts.push(
    `<p class="se-hc-cover-copy">© Copyright ${escapeHtml(copyYear)}, Sophos Ltd. All Rights Reserved</p>`,
  );
  parts.push(`<p class="se-hc-cover-confidential">CONFIDENTIAL</p>`);
  parts.push(`</div>`);
  parts.push(`</div>`);

  /* Page 2 — Central-style overview preamble (serif body, copyright rail) */
  parts.push(`<div class="se-hc-overview-sheet">`);
  parts.push(`<h2 id="firewall-health-check-overview">Firewall health check overview</h2>`);
  parts.push(
    `<p>The <strong>Sophos Firewall Health Check</strong> in <strong>Sophos FireComply</strong> provides a structured review of uploaded firewall configuration exports (HTML or entities XML). Deterministic analysis and Sophos best-practice scoring highlight configuration gaps and verification items. This report is <strong>not</strong> a Sophos Central Security Checkup, a compliance framework assessment, or a substitute for validation in the live Sophos XGS / SFOS console.</p>`,
  );
  parts.push(`<p>Here's a breakdown of the report's sections:</p>`);
  parts.push(`<ul class="se-hc-overview-list">`);
  parts.push(
    `<li><strong>Executive summary:</strong> Best-practice score, baseline alignment, finding counts by severity, and priority next steps for each firewall analysed.</li>`,
  );
  parts.push(
    `<li><strong>Provenance and limitations:</strong> How and when the report was generated, and scope limits of file-based analysis.</li>`,
  );
  parts.push(
    `<li><strong>Assessment scope and exclusions:</strong> DPI (SSL/TLS) and web-filter posture assumptions applied during analysis.</li>`,
  );
  parts.push(
    `<li><strong>Configuration file manifest:</strong> Source files, labels, export types, and Central serial linkage where provided.</li>`,
  );
  parts.push(
    `<li><strong>Baseline and findings:</strong> Per-device baseline checklist and the full findings table.</li>`,
  );
  parts.push(`</ul>`);
  parts.push(
    `<p><strong>Licence assumption for scoring:</strong> ${escapeHtml(licenceAssumptionLabel(licence))}. <strong>Sophos Central data in this report:</strong> ${centralValidated ? "Central API was used for optional discovery only — findings are based on configuration exports, not Central Security Checkup data." : "Not used — content is derived from configuration exports only."}</p>`,
  );
  parts.push(
    `<p>Each section is intended to help you understand and action the results. Use it alongside operational review in Sophos Central and on-appliance consoles to align posture with best practices.</p>`,
  );
  parts.push(
    `<p class="se-hc-overview-copy-footer">Copyright © ${escapeHtml(copyYear)}, Sophos Ltd. | CONFIDENTIAL</p>`,
  );
  parts.push(`</div>`);

  parts.push(`<h2 id="provenance-and-limitations">Provenance and limitations</h2>`);
  parts.push(`<p><strong>Generated:</strong> ${escapeHtml(dateUtc)} (UTC) / ${escapeHtml(dateLocal)} (local)</p>`);
  parts.push(
    `<p><strong>Tool:</strong> Sophos FireComply — SE Firewall Health Check${appVersion ? ` (${escapeHtml(appVersion)})` : ""}.</p>`,
  );
  parts.push(
    `<p>This assessment is <strong>point in time</strong> and based solely on the configuration files supplied. It is not a penetration test. Completeness depends on export quality and parser coverage. Validate critical items in the live Sophos XGS / SFOS console before making architectural or contractual commitments.</p>`,
  );

  parts.push(`<h2 id="scope-and-exclusions">Assessment scope and exclusions</h2>`);
  parts.push(`<h3>DPI (SSL/TLS inspection) exclusions</h3>`);
  if (dpiExemptZones.length === 0 && dpiExemptNetworks.length === 0) {
    parts.push(`<p>None selected.</p>`);
  } else {
    if (dpiExemptZones.length > 0) {
      parts.push(`<p><strong>Zones:</strong> ${escapeHtml(dpiExemptZones.join(", "))}</p>`);
    }
    if (dpiExemptNetworks.length > 0) {
      parts.push(`<p><strong>Source networks:</strong> ${escapeHtml(dpiExemptNetworks.join(", "))}</p>`);
    }
  }
  parts.push(`<h3>Web filter compliance</h3>`);
  parts.push(`<p><strong>Mode:</strong> ${escapeHtml(webFilterComplianceMode === "informational" ? "Informational" : "Strict")}</p>`);
  if (webFilterExemptRuleNames.length === 0) {
    parts.push(`<p><strong>Rule names excluded from missing-web-filter check:</strong> None.</p>`);
  } else {
    parts.push(
      `<p><strong>Rule names excluded from missing-web-filter check:</strong> ${escapeHtml(webFilterExemptRuleNames.join(", "))}</p>`,
    );
  }

  parts.push(`<h2 id="file-manifest">Configuration file manifest</h2>`);
  parts.push(`<div class="table-wrapper"><table><thead><tr><th>File name</th><th>Display label</th><th>Export type</th><th>Serial (if linked)</th></tr></thead><tbody>`);
  for (const f of files) {
    const lbl = f.label || f.fileName.replace(/\.(html|htm|xml)$/i, "");
    parts.push(
      `<tr><td>${escapeHtml(f.fileName)}</td><td>${escapeHtml(lbl)}</td><td>${escapeHtml(fileExportType(f.fileName))}</td><td>${escapeHtml(f.serialNumber?.trim() || "—")}</td></tr>`,
    );
  }
  parts.push(`</tbody></table></div>`);

  parts.push(`<h2 id="executive-summary">Executive summary</h2>`);
  for (const label of labels) {
    const ar = analysisResults[label];
    const bp = bpByLabel[label];
    const bl = baselineResults[label];
    if (!ar || !bp || !bl) continue;

    const host = ar.hostname?.trim();
    parts.push(`<h3>${escapeHtml(label)}${host ? ` — ${escapeHtml(host)}` : ""}</h3>`);
    parts.push(
      `<p><strong>Sophos best practices:</strong> score ${bp.overall}/100, grade ${bp.grade}. ${bp.passed} pass · ${bp.failed} fail · ${bp.warnings} verify.</p>`,
    );
    parts.push(`<p><strong>Baseline alignment (${escapeHtml(bl.template.name)}):</strong> ${bl.score}%</p>`);

    const counts = countBySeverity(ar.findings);
    parts.push(`<h4 style="font-size:10.5pt;margin-top:10px;">Finding counts by severity</h4>`);
    parts.push(`<div class="table-wrapper"><table><thead><tr>`);
    for (const sev of SEVERITY_ORDER) {
      parts.push(`<th>${escapeHtml(sev)}</th>`);
    }
    parts.push(`</tr></thead><tbody><tr>`);
    for (const sev of SEVERITY_ORDER) {
      parts.push(`<td>${counts[sev]}</td>`);
    }
    parts.push(`</tr></tbody></table></div>`);

    const top = sortedFindings(ar).filter((f) => f.severity === "critical" || f.severity === "high").slice(0, 5);
    if (top.length > 0) {
      parts.push(`<p><strong>Priority next steps (top ${top.length} critical/high):</strong></p><ul>`);
      for (const f of top) {
        parts.push(`<li>${escapeHtml(f.title)}${f.remediation ? ` — ${escapeHtml(f.remediation.slice(0, 200))}${f.remediation.length > 200 ? "…" : ""}` : ""}</li>`);
      }
      parts.push(`</ul>`);
    }
  }

  labels.forEach((label, fwIndex) => {
    const ar = analysisResults[label];
    const bl = baselineResults[label];
    if (!ar || !bl) return;

    parts.push(`<h2 id="firewall-${fwIndex}">${escapeHtml(label)} — Baseline and findings</h2>`);

    parts.push(`<h3>Baseline checklist</h3>`);
    parts.push(`<div class="table-wrapper"><table><thead><tr><th>Met</th><th>Requirement</th><th>Detail</th></tr></thead><tbody>`);
    for (const req of bl.requirements) {
      parts.push(
        `<tr><td>${req.met ? "Yes" : "No"}</td><td>${escapeHtml(req.label)}</td><td>${escapeHtml(req.detail)}</td></tr>`,
      );
    }
    parts.push(`</tbody></table></div>`);

    parts.push(`<h3>Findings (${ar.findings.length})</h3>`);
    if (ar.findings.length === 0) {
      parts.push(`<p>No findings recorded.</p>`);
    } else {
      parts.push(`<div class="table-wrapper"><table><thead><tr><th>Severity</th><th>Title</th><th>Section</th><th>Detail</th></tr></thead><tbody>`);
      for (const f of sortedFindings(ar)) {
        const detail = f.detail.length > 400 ? `${f.detail.slice(0, 400)}…` : f.detail;
        parts.push(
          `<tr><td>${escapeHtml(f.severity)}</td><td>${escapeHtml(f.title)}</td><td>${escapeHtml(f.section)}</td><td>${escapeHtml(detail)}</td></tr>`,
        );
      }
      parts.push(`</tbody></table></div>`);
    }
  });

  parts.push(
    `<p style="margin-top:2rem;font-size:9pt;color:var(--text-muted);">Generated by Sophos FireComply. Sophos and related marks are trademarks of Sophos Limited.</p>`,
  );

  return parts.join("\n");
}
