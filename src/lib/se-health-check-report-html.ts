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
  const coverPrepared = preparedBy.trim() || "—";

  const parts: string[] = [];

  parts.push(`<div class="se-hc-cover" style="margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:2px solid var(--accent,#2006F7);">`);
  parts.push(`<h1 id="cover-title">Sophos Firewall Health Check</h1>`);
  parts.push(`<p style="font-size:11pt;color:var(--text-secondary,#334155);margin-bottom:1rem;">Sales Engineer configuration assessment (Sophos FireComply)</p>`);
  parts.push(`<table style="width:100%;max-width:420px;font-size:10pt;border-collapse:collapse;">`);
  parts.push(`<tr><td style="padding:4px 8px 4px 0;font-weight:600;color:var(--text);">Customer name</td><td style="padding:4px 0;">${escapeHtml(coverCustomer)}</td></tr>`);
  parts.push(`<tr><td style="padding:4px 8px 4px 0;font-weight:600;color:var(--text);">Prepared by</td><td style="padding:4px 0;">${escapeHtml(coverPrepared)}</td></tr>`);
  parts.push(`<tr><td style="padding:4px 8px 4px 0;font-weight:600;color:var(--text);">Report date</td><td style="padding:4px 0;">${escapeHtml(dateLocal)}</td></tr>`);
  parts.push(`</table>`);
  parts.push(`<p style="margin-top:12px;font-size:9pt;font-weight:700;letter-spacing:0.05em;">CONFIDENTIAL</p>`);
  parts.push(`</div>`);

  parts.push(`<h2 id="report-overview">Report overview</h2>`);
  parts.push(
    `<p>This report summarises a <strong>Sophos Firewall Health Check</strong> performed in <strong>Sophos FireComply</strong> using uploaded firewall configuration exports (HTML or entities XML). Deterministic analysis and Sophos best-practice scoring are applied; it is <strong>not</strong> a compliance framework assessment unless separately engaged.</p>`,
  );
  parts.push(
    `<p><strong>Licence assumption for scoring:</strong> ${escapeHtml(licenceAssumptionLabel(licence))}.</p>`,
  );
  parts.push(
    `<p><strong>Sophos Central data in this report:</strong> ${centralValidated ? "Central API was used for optional discovery only — findings are based on configuration exports, not Central Security Checkup data." : "Not used — report content is derived from configuration exports only."}</p>`,
  );

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
