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

/**
 * `buildPdfHtml(..., { tocAfterMarker })` inserts the auto-generated Table of Contents after
 * cover + overview so the PDF order is: cover → overview → TOC → body sections.
 */
export const SE_HEALTH_CHECK_PDF_TOC_AFTER_MARKER = "<!-- firecomply:se-health-check:pdf-toc -->";

/** Centre mark on PDF cover (white Sophos “S” on transparent — place file in /public). */
export const SE_HEALTH_CHECK_COVER_MARK_SRC = "/se-health-check-sophos-mark.png";

/** Top-left wordmark on PDF cover (wide white artwork for navy background). */
export const SE_HEALTH_CHECK_WORDMARK_SRC = "/se-health-check-wordmark.png";

/** Sophos lockup (blue shield + navy wordmark) — stamped on PDF pages after cover + overview via jsPDF. */
export const SE_PDF_SOPHOS_LOCKUP_SRC = "/se-pdf-sophos-lockup.png";

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

  /* Page 1 — Sophos Central Security Checkup–style cover (wordmark, 4-line meta, shield, centred footer) */
  parts.push(`<div class="se-hc-cover-fullpage">`);
  parts.push(`<div class="se-hc-cover-brand">`);
  parts.push(
    `<img src="${SE_HEALTH_CHECK_WORDMARK_SRC}" alt="" class="se-hc-cover-wordmark" width="280" height="32" />`,
  );
  parts.push(`</div>`);
  parts.push(`<div class="se-hc-cover-body">`);
  parts.push(`<div class="se-hc-cover-text">`);
  parts.push(`<h1 id="cover-title">Sophos Firewall Health Check</h1>`);
  parts.push(
    `<p class="se-hc-cover-meta-line"><span class="se-hc-cover-label">Customer Name:</span> ${escapeHtml(coverCustomer)}</p>`,
  );
  parts.push(
    `<p class="se-hc-cover-meta-line"><span class="se-hc-cover-label">Prepared For:</span> ${escapeHtml(coverPreparedFor)}</p>`,
  );
  parts.push(
    `<p class="se-hc-cover-meta-line"><span class="se-hc-cover-label">Prepared By:</span> ${escapeHtml(coverPrepared)}</p>`,
  );
  parts.push(
    `<p class="se-hc-cover-meta-line"><span class="se-hc-cover-label">Date:</span> ${escapeHtml(dateLocal)}</p>`,
  );
  parts.push(`</div>`);
  parts.push(
    `<div class="se-hc-cover-mark-wrap"><img src="${SE_HEALTH_CHECK_COVER_MARK_SRC}" alt="" class="se-hc-cover-mark-img" width="200" height="200" /></div>`,
  );
  parts.push(`</div>`);
  parts.push(`<div class="se-hc-cover-bottom">`);
  parts.push(
    `<p class="se-hc-cover-copy">© Copyright ${escapeHtml(copyYear)}, Sophos Ltd. All Rights Reserved</p>`,
  );
  parts.push(`<p class="se-hc-cover-confidential">CONFIDENTIAL</p>`);
  parts.push(`</div>`);
  parts.push(`</div>`);

  /* Page 2 — navy header band + teal title + white body (sans), like Central “Security Checkup Overview” */
  parts.push(`<div class="se-hc-overview-sheet">`);
  parts.push(`<div class="se-hc-overview-header-navy">`);
  parts.push(
    `<img src="${SE_HEALTH_CHECK_WORDMARK_SRC}" alt="" class="se-hc-overview-wordmark" width="280" height="32" />`,
  );
  parts.push(
    `<h2 id="firewall-health-check-overview" class="se-hc-overview-title">Firewall health check overview</h2>`,
  );
  parts.push(`</div>`);
  parts.push(`<div class="se-hc-overview-body">`);
  parts.push(
    `<p>The <strong>Sophos Firewall Health Check</strong> in <strong>Sophos FireComply</strong> provides a structured, repeatable review of uploaded Sophos XGS / SFOS configuration exports (HTML or entities XML). The tool parses exported objects and rules, runs deterministic checks aligned with Sophos hardening guidance, and scores posture against a selectable licence tier. Outputs are designed for Sales Engineers and customers to prioritise remediation conversations — not as a pass/fail certification.</p>`,
  );
  parts.push(
    `<p><strong>How analysis works.</strong> Each file is normalised into structured sections (firewall rules, NAT, interfaces, security features, and related objects). Findings are produced by rule-based logic with explicit evidence references into the export. <strong>Sophos best practice</strong> scoring weights official guidance categories; <strong>baseline</strong> alignment reflects your chosen template (e.g. Sophos best-practice checklist). Where the export omits or obscures data, the tool may under-report — always corroborate on the live appliance.</p>`,
  );
  parts.push(
    `<p><strong>What this report is not.</strong> This is <strong>not</strong> a Sophos Central Security Checkup, a formal compliance audit, or traffic/log-driven validation. It does not observe live sessions, threat telemetry, or Central policy sync state. It is <strong>not</strong> a substitute for reviewing configuration in the live Sophos XGS / SFOS console, change windows, or your organisation&apos;s own risk acceptance process.</p>`,
  );
  parts.push(
    `<p><strong>How to read the following pages.</strong> The sections below mirror how the PDF is organised after this overview. You can skim the <strong>Executive summary</strong> first for scores and top actions, then use <strong>Provenance and limitations</strong> and <strong>Assessment scope and exclusions</strong> to qualify the results. The <strong>Configuration file manifest</strong> ties each finding set to source files and optional Central serial linkage. <strong>Baseline and findings</strong> contain the detailed checklist and full finding list per firewall.</p>`,
  );
  parts.push(`<p><strong>Section guide</strong> — each part of the report contains the following:</p>`);
  parts.push(
    `<p><strong>Executive Summary:</strong> For every analysed firewall, you will see the Sophos best-practice score and letter grade, baseline template score, counts of findings by severity (critical through info), and a short list of priority next steps derived from the highest-severity items. Use this view for stakeholder conversations and workshop planning.</p>`,
  );
  parts.push(
    `<p><strong>Provenance and limitations:</strong> Timestamps, tool identity, and explicit limits of offline file analysis. This grounds the report in time and reminds readers that exports may be incomplete, redacted, or from non-production appliances.</p>`,
  );
  parts.push(
    `<p><strong>Assessment scope and exclusions:</strong> Documents which zones or networks were excluded from DPI (SSL/TLS) gap checks, the web-filter compliance mode (informational vs strict), and any rule names excluded from missing-web-filter detection. These choices materially affect findings — keep them aligned with how the customer actually enforces policy.</p>`,
  );
  parts.push(
    `<p><strong>Configuration file manifest:</strong> Lists each source file, its display label, export type (HTML vs entities XML), and Sophos Central serial number when you linked discovery to an upload. This supports audit trails and multi-firewall estates.</p>`,
  );
  parts.push(
    `<p><strong>Baseline and findings:</strong> Per-device baseline requirements with pass/fail detail, followed by the complete findings table (severity, title, configuration section, and truncated detail with remediation hints where available). This is the working depth behind the executive summary.</p>`,
  );
  parts.push(
    `<p><strong>Licence assumption for scoring:</strong> ${escapeHtml(licenceAssumptionLabel(licence))}. Module-level scoring uses this assumption; if the customer&apos;s entitlement differs, reinterpret scores accordingly. <strong>Sophos Central data in this report:</strong> ${centralValidated ? "The Central API was used only for optional firewall discovery in this session. All findings are derived from uploaded configuration exports — not from Central Security Checkup or live telemetry." : "Not used. All content is derived from configuration exports only."}</p>`,
  );
  parts.push(
    `<p><strong>Severity labels.</strong> <strong>Critical</strong> and <strong>high</strong> items typically indicate exposure or misconfiguration that should be addressed urgently. <strong>Medium</strong> and <strong>low</strong> reflect hardening gaps or policy drift. <strong>Info</strong> highlights context or verification steps. Titles and remediation text are indicative — validate impact for the customer&apos;s topology and change controls.</p>`,
  );
  parts.push(
    `<p>Use this report together with operational review in <strong>Sophos Central</strong> and on-appliance consoles, release notes, and Sophos documentation. Treat it as a structured starting point for posture improvement, not an exhaustive security assessment of the environment.</p>`,
  );
  parts.push(
    `<p class="se-hc-overview-copy-footer">Copyright © ${escapeHtml(copyYear)}, Sophos Ltd. | CONFIDENTIAL</p>`,
  );
  parts.push(`</div>`);
  parts.push(`</div>`);

  parts.push(SE_HEALTH_CHECK_PDF_TOC_AFTER_MARKER);

  parts.push(`<div class="se-hc-report-body-pages">`);

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

  parts.push(`<h2 id="executive-summary">Executive Summary</h2>`);
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
      parts.push(
        `<p><strong>Priority next steps (top ${top.length} critical/high):</strong></p><ul class="se-hc-priority-steps">`,
      );
      for (const f of top) {
        parts.push(
          `<li>${escapeHtml(f.title)}${f.remediation ? ` — ${escapeHtml(f.remediation)}` : ""}</li>`,
        );
      }
      parts.push(`</ul>`);
    }
  }

  labels.forEach((label, fwIndex) => {
    const ar = analysisResults[label];
    const bl = baselineResults[label];
    if (!ar || !bl) return;

    parts.push(
      `<h2 id="firewall-${fwIndex}" class="se-hc-h2-baseline-findings">${escapeHtml(label)} — Baseline and findings</h2>`,
    );

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
        parts.push(
          `<tr><td>${escapeHtml(f.severity)}</td><td>${escapeHtml(f.title)}</td><td>${escapeHtml(f.section)}</td><td>${escapeHtml(f.detail)}</td></tr>`,
        );
      }
      parts.push(`</tbody></table></div>`);
    }
  });

  parts.push(`</div>`);

  parts.push(
    `<p class="se-hc-report-body-footer" style="margin-top:2rem;font-size:9pt;color:var(--text-muted);">Generated by Sophos FireComply. Sophos and related marks are trademarks of Sophos Limited.</p>`,
  );

  return parts.join("\n");
}
