import type { AnalysisResult, Finding, Severity } from "./analyse-config";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 12,
  high: 8,
  medium: 4,
  low: 2,
  info: 0,
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugifyFirewallId(key: string): string {
  const base = key
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "firewall";
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

function sumSeverityCounts(
  a: Record<Severity, number>,
  b: Record<Severity, number>,
): Record<Severity, number> {
  return {
    critical: a.critical + b.critical,
    high: a.high + b.high,
    medium: a.medium + b.medium,
    low: a.low + b.low,
    info: a.info + b.info,
  };
}

function firewallRiskScore(findings: Finding[]): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);
  return Math.max(0, Math.min(100, Math.round(100 - Math.min(penalty, 100))));
}

function aggregateScoreAndGrade(
  analysisResults: Record<string, AnalysisResult>,
): { overall: number; grade: "A" | "B" | "C" | "D" | "F" } {
  const list = Object.values(analysisResults);
  if (list.length === 0) {
    return { overall: 100, grade: "A" };
  }
  const sum = list.reduce((s, r) => s + firewallRiskScore(r.findings), 0);
  const overall = Math.round(sum / list.length);
  const grade: "A" | "B" | "C" | "D" | "F" =
    overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";
  return { overall, grade };
}

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const oa = SEVERITY_ORDER[a.severity];
    const ob = SEVERITY_ORDER[b.severity];
    if (oa !== ob) return oa - ob;
    return a.title.localeCompare(b.title);
  });
}

function renderFindingRow(f: Finding, fwIndex: number, fIndex: number): string {
  const id = `fw-${fwIndex}-finding-${fIndex}`;
  const sev = escapeHtml(f.severity);
  return `
    <div class="finding" data-severity="${sev}" id="${escapeHtml(id)}">
      <div class="finding-header" role="button" tabindex="0" aria-expanded="false" aria-controls="${escapeHtml(id)}-panel">
        <span class="sev-badge sev-${sev}">${sev}</span>
        <span class="finding-title">${escapeHtml(f.title)}</span>
        <span class="finding-chevron" aria-hidden="true"></span>
      </div>
      <div class="finding-body" id="${escapeHtml(id)}-panel" hidden>
        <div class="finding-meta"><span class="meta-label">Section</span> ${escapeHtml(f.section)}</div>
        <div class="finding-block">
          <div class="block-label">Detail</div>
          <div class="block-text">${escapeHtml(f.detail)}</div>
        </div>
        ${
          f.remediation
            ? `<div class="finding-block">
          <div class="block-label">Remediation</div>
          <div class="block-text">${escapeHtml(f.remediation)}</div>
        </div>`
            : ""
        }
        ${
          f.evidence
            ? `<div class="finding-block">
          <div class="block-label">Evidence</div>
          <pre class="block-pre">${escapeHtml(f.evidence)}</pre>
        </div>`
            : ""
        }
      </div>
      <span class="finding-search-text" hidden>${escapeHtml(
        `${f.title} ${f.detail} ${f.remediation ?? ""}`,
      )}</span>
    </div>`;
}

function renderFirewallSection(
  firewallKey: string,
  result: AnalysisResult,
  index: number,
): string {
  const displayName = result.hostname?.trim() || firewallKey;
  const slug = `${index}-${slugifyFirewallId(firewallKey)}`;
  const sorted = sortFindings(result.findings);
  const rows = sorted.map((f, i) => renderFindingRow(f, index, i)).join("\n");
  const local = firewallRiskScore(result.findings);
  const localGrade: "A" | "B" | "C" | "D" | "F" =
    local >= 90 ? "A" : local >= 75 ? "B" : local >= 60 ? "C" : local >= 40 ? "D" : "F";

  return `
    <section class="firewall-section" id="fw-${escapeHtml(slug)}" data-fw-index="${index}">
      <div class="section-head">
        <h2 class="section-title">${escapeHtml(displayName)}</h2>
        <p class="section-sub">${escapeHtml(firewallKey !== displayName ? `Config key: ${firewallKey}` : "")}</p>
        <div class="section-score">
          <span class="score-pill">${local}</span>
          <span class="grade-pill grade-${localGrade}">${localGrade}</span>
          <span class="finding-count-label">${sorted.length} finding${sorted.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div class="findings-list">
        ${sorted.length ? rows : '<p class="empty-msg">No findings for this firewall.</p>'}
      </div>
    </section>`;
}

/**
 * Builds a self-contained interactive HTML report (inlined CSS + JS) from analysis results.
 */
export function buildInteractiveAnalysisHtml(
  analysisResults: Record<string, AnalysisResult>,
  branding?: { customerName?: string; mspName?: string; logoUrl?: string },
): string {
  const customer = branding?.customerName?.trim() || "";
  const msp = branding?.mspName?.trim() || "";
  const logoUrl = branding?.logoUrl?.trim();
  const safeLogo = logoUrl && isSafeHttpUrl(logoUrl) ? logoUrl : "";

  const fwKeys = Object.keys(analysisResults).sort((a, b) => a.localeCompare(b));
  const firewallCount = fwKeys.length;

  let totals: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const k of fwKeys) {
    totals = sumSeverityCounts(totals, countBySeverity(analysisResults[k].findings));
  }
  const totalFindings =
    totals.critical + totals.high + totals.medium + totals.low + totals.info;

  const { overall, grade } = aggregateScoreAndGrade(analysisResults);
  const generated = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const docTitle = customer ? `${customer} - Firewall Security Analysis` : "Firewall Security Analysis";

  const tocItems = fwKeys
    .map((k, i) => {
      const slug = `${i}-${slugifyFirewallId(k)}`;
      const r = analysisResults[k];
      const label = r.hostname?.trim() || k;
      return `<li><a class="toc-link" href="#fw-${escapeHtml(slug)}">${escapeHtml(label)}</a></li>`;
    })
    .join("\n");

  const sections = fwKeys
    .map((k, i) => renderFirewallSection(k, analysisResults[k], i))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    :root {
      --sophos-blue: #2006F7;
      --critical: #EA0022;
      --high: #F29400;
      --medium: #F8E300;
      --low: #009CFB;
      --info: #888888;
      --bg: #f4f6fb;
      --card: #ffffff;
      --text: #1a1d26;
      --muted: #5c6478;
      --border: #e2e6ef;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .cover {
      background: linear-gradient(135deg, #1201a8 0%, var(--sophos-blue) 55%, #4b3dff 100%);
      color: #fff;
      padding: 2.25rem 1.5rem 2.5rem;
    }
    .cover-inner { max-width: 960px; margin: 0 auto; }
    .cover-top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .logo {
      max-height: 48px;
      max-width: 200px;
      object-fit: contain;
      background: #fff;
      padding: 6px 10px;
      border-radius: 8px;
    }
    .cover h1 {
      margin: 0;
      font-size: clamp(1.35rem, 4vw, 2rem);
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .cover-meta {
      display: grid;
      gap: 0.35rem;
      font-size: 0.95rem;
      opacity: 0.92;
      margin-top: 0.75rem;
    }
    .cover-score-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1rem;
      margin-top: 1.5rem;
    }
    .big-score {
      font-size: 2.75rem;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.03em;
    }
    .big-grade {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border-radius: 12px;
      font-weight: 800;
      font-size: 1.35rem;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.35);
    }
    .cover.grade-A .big-grade { background: rgba(46, 204, 113, 0.35); }
    .cover.grade-B .big-grade { background: rgba(52, 152, 219, 0.35); }
    .cover.grade-C .big-grade { background: rgba(241, 196, 15, 0.35); color: #1a1a1a; }
    .cover.grade-D .big-grade { background: rgba(230, 126, 34, 0.4); }
    .cover.grade-F .big-grade { background: rgba(231, 76, 60, 0.45); }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .toolbar {
      max-width: 960px;
      margin: -1.25rem auto 0;
      padding: 0 1.25rem;
      position: relative;
      z-index: 2;
    }
    .toolbar-inner {
      background: var(--card);
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(32, 6, 247, 0.08);
      border: 1px solid var(--border);
      padding: 1rem 1.25rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }
    .toolbar-inner button {
      font: inherit;
      cursor: pointer;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: #fff;
      padding: 0.45rem 0.9rem;
      color: var(--text);
    }
    .toolbar-inner button:hover { border-color: #c8d0e4; background: #f8f9fd; }
    .toolbar-inner .primary {
      background: var(--sophos-blue);
      color: #fff;
      border-color: var(--sophos-blue);
    }
    .toolbar-inner .primary:hover { filter: brightness(1.08); }

    main { max-width: 960px; margin: 0 auto; padding: 1.75rem 1.25rem 3rem; }

    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.75rem;
    }
    .stat-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem;
      text-align: center;
    }
    .stat-card .n { font-size: 1.75rem; font-weight: 800; }
    .stat-card .lbl { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-top: 0.25rem; }
    .stat-critical .n { color: var(--critical); }
    .stat-high .n { color: var(--high); }
    .stat-medium .n { color: #9a8b00; }
    .stat-low .n { color: var(--low); }
    .stat-info .n { color: var(--info); }

    .toc {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.1rem 1.25rem;
      margin-bottom: 2rem;
    }
    .toc h2 { margin: 0 0 0.75rem; font-size: 1.1rem; }
    .toc ul { margin: 0; padding-left: 1.2rem; }
    .toc a { color: var(--sophos-blue); text-decoration: none; }
    .toc a:hover { text-decoration: underline; }

    .controls {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1rem 1.15rem;
      margin-bottom: 1.5rem;
    }
    .controls-row { display: flex; flex-wrap: wrap; gap: 0.65rem; align-items: center; margin-bottom: 0.75rem; }
    .controls-row:last-child { margin-bottom: 0; }
    .search-input {
      flex: 1 1 220px;
      min-width: 180px;
      font: inherit;
      padding: 0.55rem 0.85rem;
      border-radius: 10px;
      border: 1px solid var(--border);
    }
    .filter-group { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .filter-btn {
      font: inherit;
      font-size: 0.85rem;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: #fff;
      cursor: pointer;
      color: var(--text);
    }
    .filter-btn:hover { background: #f0f2f8; }
    .filter-btn.active {
      background: var(--sophos-blue);
      color: #fff;
      border-color: var(--sophos-blue);
    }

    .firewall-section {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.25rem 1.2rem 1.4rem;
      margin-bottom: 1.5rem;
      scroll-margin-top: 1rem;
    }
    .section-head { margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
    .section-title { margin: 0; font-size: 1.25rem; }
    .section-sub { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.9rem; min-height: 1.2em; }
    .section-score { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.65rem; }
    .score-pill, .grade-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.65rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.9rem;
      border: 1px solid var(--border);
    }
    .grade-A { background: #e8f8ef; color: #1e8449; border-color: #b8e6c8; }
    .grade-B { background: #e8f4fc; color: #1f6dad; border-color: #b8d4f0; }
    .grade-C { background: #fdf6e3; color: #8a6d1a; border-color: #f0e0a8; }
    .grade-D { background: #fdeee6; color: #b45309; border-color: #f5cdb0; }
    .grade-F { background: #fdecea; color: #c0392b; border-color: #f5b8b0; }
    .finding-count-label { font-size: 0.85rem; color: var(--muted); }

    .finding {
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 0.55rem;
      overflow: hidden;
      background: #fafbfd;
    }
    .finding.filtered-out { display: none !important; }
    .finding-header {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.65rem 0.85rem;
      cursor: pointer;
      user-select: none;
    }
    .finding-header:hover { background: #f0f2f8; }
    .finding-header:focus { outline: 2px solid var(--sophos-blue); outline-offset: -2px; }
    .finding-title { flex: 1; font-weight: 600; font-size: 0.95rem; }
    .sev-badge {
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 0.2rem 0.45rem;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .sev-critical { background: #fde7ea; color: var(--critical); }
    .sev-high { background: #fff0e0; color: var(--high); }
    .sev-medium { background: #fffbe8; color: #7a6a00; }
    .sev-low { background: #e6f5ff; color: var(--low); }
    .sev-info { background: #f0f0f0; color: var(--info); }
    .finding-chevron {
      width: 0.5rem;
      height: 0.5rem;
      border-right: 2px solid var(--muted);
      border-bottom: 2px solid var(--muted);
      transform: rotate(45deg);
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }
    .finding.is-open .finding-chevron { transform: rotate(-135deg); }
    .finding-body {
      padding: 0 0.85rem 0.9rem 0.85rem;
      border-top: 1px solid var(--border);
      background: #fff;
    }
    .finding-meta { font-size: 0.85rem; color: var(--muted); padding-top: 0.65rem; }
    .meta-label { font-weight: 700; color: var(--text); margin-right: 0.35rem; }
    .finding-block { margin-top: 0.75rem; }
    .block-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 0.25rem; }
    .block-text { font-size: 0.9rem; white-space: pre-wrap; }
    .block-pre {
      margin: 0;
      font-size: 0.8rem;
      white-space: pre-wrap;
      word-break: break-word;
      background: #f4f6fb;
      padding: 0.65rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .empty-msg { color: var(--muted); margin: 0.5rem 0; }

    footer {
      max-width: 960px;
      margin: 0 auto;
      padding: 0 1.25rem 2rem;
      font-size: 0.85rem;
      color: var(--muted);
      text-align: center;
    }

    @media print {
      body { background: #fff; }
      .cover { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .no-print { display: none !important; }
      .toolbar { display: none !important; }
      .finding { break-inside: avoid; }
      .finding-body {
        display: block !important;
        max-height: none !important;
      }
      .finding-chevron { display: none; }
      .finding-header { cursor: default; }
      .toc { break-inside: avoid; }
      .controls { display: none !important; }
    }

    @media (max-width: 520px) {
      .cover-score-row { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <header class="cover grade-${grade}">
    <div class="cover-inner">
      <div class="cover-top">
        ${safeLogo ? `<img class="logo" src="${escapeHtml(safeLogo)}" alt="Logo" />` : ""}
        <h1>${escapeHtml(docTitle)}</h1>
      </div>
      <div class="cover-meta">
        <div>Generated: ${escapeHtml(generated)}</div>
        <div>Firewalls analyzed: <strong>${firewallCount}</strong></div>
        ${msp ? `<div>Prepared by: ${escapeHtml(msp)}</div>` : ""}
      </div>
      <div class="cover-score-row">
        <span class="big-score">${overall}</span>
        <span class="big-grade" aria-label="Grade ${grade}">${grade}</span>
        <span style="opacity:.9">Aggregate risk score (0–100, higher is better)</span>
      </div>
    </div>
  </header>

  <div class="toolbar no-print">
    <div class="toolbar-inner">
      <button type="button" class="primary" id="btn-print">Print report</button>
      <button type="button" id="btn-expand-all">Expand all</button>
      <button type="button" id="btn-collapse-all">Collapse all</button>
    </div>
  </div>

  <main>
    <div class="summary">
      <div class="stat-card stat-critical"><div class="n">${totals.critical}</div><div class="lbl">Critical</div></div>
      <div class="stat-card stat-high"><div class="n">${totals.high}</div><div class="lbl">High</div></div>
      <div class="stat-card stat-medium"><div class="n">${totals.medium}</div><div class="lbl">Medium</div></div>
      <div class="stat-card stat-low"><div class="n">${totals.low}</div><div class="lbl">Low</div></div>
      <div class="stat-card stat-info"><div class="n">${totals.info}</div><div class="lbl">Info</div></div>
      <div class="stat-card"><div class="n">${totalFindings}</div><div class="lbl">Total findings</div></div>
    </div>

    ${
      firewallCount
        ? `<nav class="toc no-print" aria-label="Table of contents">
      <h2>Firewalls</h2>
      <ul>${tocItems}</ul>
    </nav>`
        : ""
    }

    <div class="controls no-print">
      <div class="controls-row">
        <label class="visually-hidden" for="finding-search">Search findings</label>
        <input type="search" id="finding-search" class="search-input" placeholder="Search title, detail, remediation…" autocomplete="off" />
      </div>
      <div class="controls-row filter-group" id="severity-filters" role="group" aria-label="Severity filter">
        <button type="button" class="filter-btn active" data-severity="all">All</button>
        <button type="button" class="filter-btn" data-severity="critical">Critical</button>
        <button type="button" class="filter-btn" data-severity="high">High</button>
        <button type="button" class="filter-btn" data-severity="medium">Medium</button>
        <button type="button" class="filter-btn" data-severity="low">Low</button>
        <button type="button" class="filter-btn" data-severity="info">Info</button>
      </div>
    </div>

    ${firewallCount ? sections : '<p class="empty-msg">No firewall analysis data to display.</p>'}
  </main>

  <footer>
    ${escapeHtml(customer || "Firewall")} security analysis · ${escapeHtml(generated)}
  </footer>

  <script>
(function () {
  var searchInput = document.getElementById("finding-search");
  var filterRoot = document.getElementById("severity-filters");
  var activeSeverity = "all";

  function normalize(s) {
    return (s || "").toLowerCase();
  }

  function eachFinding(fn) {
    var nodes = document.querySelectorAll(".finding");
    for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
  }

  function applyFilters() {
    var q = normalize(searchInput && searchInput.value);
    eachFinding(function (el) {
      var span = el.querySelector(".finding-search-text");
      var hay = normalize(span ? span.textContent : "");
      var sev = el.getAttribute("data-severity") || "";
      var matchQ = !q || hay.indexOf(q) !== -1;
      var matchS = activeSeverity === "all" || sev === activeSeverity;
      el.classList.toggle("filtered-out", !(matchQ && matchS));
    });
  }

  function setExpanded(el, open) {
    var body = el.querySelector(".finding-body");
    var hdr = el.querySelector(".finding-header");
    if (!body || !hdr) return;
    body.hidden = !open;
    hdr.setAttribute("aria-expanded", open ? "true" : "false");
    el.classList.toggle("is-open", open);
  }

  function toggleFinding(el) {
    var body = el.querySelector(".finding-body");
    if (!body) return;
    setExpanded(el, body.hidden);
  }

  document.getElementById("btn-print").addEventListener("click", function () {
    window.print();
  });

  document.getElementById("btn-expand-all").addEventListener("click", function () {
    eachFinding(function (el) {
      if (el.classList.contains("filtered-out")) return;
      setExpanded(el, true);
    });
  });

  document.getElementById("btn-collapse-all").addEventListener("click", function () {
    eachFinding(function (el) {
      setExpanded(el, false);
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  if (filterRoot) {
    filterRoot.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute || t.getAttribute("data-severity") == null) return;
      var sev = t.getAttribute("data-severity");
      activeSeverity = sev;
      var btns = filterRoot.querySelectorAll(".filter-btn");
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle("active", btns[i].getAttribute("data-severity") === sev);
      }
      applyFilters();
    });
  }

  document.addEventListener("click", function (e) {
    var hdr = e.target.closest && e.target.closest(".finding-header");
    if (!hdr) return;
    var finding = hdr.closest(".finding");
    if (!finding || finding.classList.contains("filtered-out")) return;
    toggleFinding(finding);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var hdr = e.target.closest && e.target.closest(".finding-header");
    if (!hdr || e.target !== hdr) return;
    var finding = hdr.closest(".finding");
    if (!finding || finding.classList.contains("filtered-out")) return;
    e.preventDefault();
    toggleFinding(finding);
  });

  document.querySelectorAll(".toc-link").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (!id || id.charAt(0) !== "#") return;
      var sec = document.getElementById(id.slice(1));
      if (sec) {
        e.preventDefault();
        sec.scrollIntoView({ behavior: "smooth", block: "start" });
        history.pushState(null, "", id);
      }
    });
  });
})();
  </script>
</body>
</html>`;
}

/**
 * Generates the interactive HTML and triggers a download in the browser.
 */
export function downloadInteractiveHtml(
  analysisResults: Record<string, AnalysisResult>,
  branding?: { customerName?: string; mspName?: string; logoUrl?: string },
  filename?: string,
): void {
  const html = buildInteractiveAnalysisHtml(analysisResults, branding);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeCustomer = branding?.customerName?.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "";
  const defaultName = safeCustomer
    ? `firewall-analysis-${safeCustomer}-${new Date().toISOString().slice(0, 10)}.html`
    : `firewall-analysis-${new Date().toISOString().slice(0, 10)}.html`;
  a.download = filename ?? defaultName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
