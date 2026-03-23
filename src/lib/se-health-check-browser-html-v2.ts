/**
 * Standalone HTML document for SE Health Check with dark/light mode toggle
 * (not the PDF/print pipeline).
 */

import {
  buildSEHealthCheckReportHtml,
  type SEHealthCheckReportParams,
} from "@/lib/se-health-check-report-html-v2";

const BROWSER_BASE_CSS = `
  /* ── Dark theme (default) ── */
  :root {
    --bg: #001A47;
    --card: #10037C;
    --border: #223E4C;
    --text: #EDF2F9;
    --muted: #6A889B;
    --accent: #00EDFF;
    --accent-dim: #2006F7;
    --pass: #00F2B3;
    --fail: #EA0022;
    --warn: #F29400;
    --na: #6A889B;
    --th-bg: rgba(30, 41, 59, 0.8);
    --lic-card-bg: rgba(15, 23, 42, 0.6);
    --lic-sel-border: rgba(0, 237, 255, 0.45);
    --lic-sel-shadow: rgba(0, 237, 255, 0.2);
    --mod-pill-border: rgba(0, 237, 255, 0.25);
    --badge-pass-bg: rgba(0, 242, 179, 0.12);
    --badge-fail-bg: rgba(248, 113, 113, 0.12);
    --badge-warn-bg: rgba(251, 191, 36, 0.12);
    --badge-na-bg: rgba(100, 116, 139, 0.15);
  }

  /* ── Light theme ── */
  :root[data-theme="light"] {
    --bg: #ffffff;
    --card: #f9fafb;
    --border: #e5e7eb;
    --text: #0f172a;
    --muted: #6A889B;
    --accent: #001A47;
    --accent-dim: #2006F7;
    --pass: #047857;
    --fail: #EA0022;
    --warn: #F29400;
    --na: #6A889B;
    --th-bg: #f3f4f6;
    --lic-card-bg: #f3f4f6;
    --lic-sel-border: rgba(0, 27, 68, 0.4);
    --lic-sel-shadow: rgba(0, 27, 68, 0.12);
    --mod-pill-border: rgba(0, 27, 68, 0.2);
    --badge-pass-bg: rgba(4, 120, 87, 0.08);
    --badge-fail-bg: rgba(220, 38, 38, 0.08);
    --badge-warn-bg: rgba(180, 83, 9, 0.08);
    --badge-na-bg: rgba(107, 114, 128, 0.1);
  }

  /* ── Print always uses light ── */
  @media print {
    :root, :root[data-theme="dark"] {
      --bg: #ffffff;
      --card: #f9fafb;
      --border: #e5e7eb;
      --text: #0f172a;
      --muted: #6A889B;
      --accent: #001A47;
      --accent-dim: #2006F7;
      --pass: #047857;
      --fail: #EA0022;
      --warn: #F29400;
      --na: #6A889B;
      --th-bg: #f3f4f6;
      --lic-card-bg: #f3f4f6;
      --lic-sel-border: rgba(0, 27, 68, 0.4);
      --lic-sel-shadow: rgba(0, 27, 68, 0.12);
      --mod-pill-border: rgba(0, 27, 68, 0.2);
      --badge-pass-bg: rgba(4, 120, 87, 0.08);
      --badge-fail-bg: rgba(220, 38, 38, 0.08);
      --badge-warn-bg: rgba(180, 83, 9, 0.08);
      --badge-na-bg: rgba(107, 114, 128, 0.1);
    }
    #theme-toggle { display: none !important; }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    color: var(--text);
    background: var(--bg);
    -webkit-font-smoothing: antialiased;
    transition: background 0.25s, color 0.25s;
  }
  .se-hc-browser-root {
    max-width: 56rem;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
  }

  /* ── Theme toggle button ── */
  #theme-toggle {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 9999;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.15rem;
    line-height: 1;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }
  #theme-toggle:hover {
    border-color: var(--accent);
  }

  .se-hc-browser-hero {
    margin-bottom: 2rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--border);
  }
  .se-hc-browser-h1 {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .se-hc-browser-meta {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .se-hc-browser-section {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 1.25rem 1.25rem 1.5rem;
    margin-bottom: 1.25rem;
    transition: background 0.25s, border-color 0.25s;
  }
  .se-hc-browser-h2 {
    margin: 0 0 0.35rem;
    font-size: 1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .se-hc-browser-h2-mark {
    width: 0.5rem;
    height: 0.5rem;
    background: linear-gradient(135deg, var(--accent-dim), var(--accent));
    border-radius: 2px;
    flex-shrink: 0;
  }
  .se-hc-browser-sub {
    margin: 0 0 1rem;
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .se-hc-lic-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .se-hc-lic-card {
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.75rem 0.85rem;
    background: var(--lic-card-bg);
  }
  .se-hc-lic-card-selected {
    border-color: var(--lic-sel-border);
    box-shadow: 0 0 0 1px var(--lic-sel-shadow);
  }
  .se-hc-lic-card-title {
    margin: 0 0 0.35rem;
    font-size: 0.8125rem;
    font-weight: 700;
  }
  .se-hc-lic-card-blurb {
    margin: 0;
    font-size: 0.6875rem;
    color: var(--muted);
    line-height: 1.4;
  }
  .se-hc-mod-label {
    margin: 0 0 0.35rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .se-hc-mod-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .se-hc-mod-pill {
    font-size: 0.6875rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--mod-pill-border);
    color: var(--accent);
  }
  .se-hc-bp-dash-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 1.25rem;
  }
  .se-hc-bp-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(5rem, 1fr));
    gap: 0.75rem 1.25rem;
  }
  @media (min-width: 480px) {
    .se-hc-bp-stats { grid-template-columns: repeat(4, 1fr); }
  }
  .se-hc-bp-stat { text-align: center; }
  .se-hc-bp-stat-n {
    display: block;
    font-size: 1.75rem;
    font-weight: 800;
    line-height: 1.1;
  }
  .se-hc-n-pass { color: var(--pass); }
  .se-hc-n-fail { color: var(--fail); }
  .se-hc-n-warn { color: var(--warn); }
  .se-hc-n-na { color: var(--na); }
  .se-hc-bp-stat-l {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .se-hc-bp-fw-label {
    font-weight: 600;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .se-hc-bp-cat { margin-top: 1rem; }
  .se-hc-bp-cat-title {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .se-hc-bp-checklist {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .se-hc-bp-check-li {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
    font-size: 0.8125rem;
  }
  .se-hc-bp-check-li:last-child { border-bottom: none; }
  .se-hc-bp-badge {
    flex-shrink: 0;
    font-size: 0.5625rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
  }
  .se-hc-bp-badge-pass { background: var(--badge-pass-bg); color: var(--pass); }
  .se-hc-bp-badge-fail { background: var(--badge-fail-bg); color: var(--fail); }
  .se-hc-bp-badge-warn { background: var(--badge-warn-bg); color: var(--warn); }
  .se-hc-bp-badge-na { background: var(--badge-na-bg); color: var(--na); }
  .se-hc-bp-check-body { min-width: 0; }
  .se-hc-bp-check-title { display: block; font-weight: 600; margin-bottom: 0.15rem; }
  .se-hc-bp-check-detail { display: block; color: var(--muted); font-size: 0.75rem; line-height: 1.4; }

  /* Shared report body (provenance, tables, findings) */
  .se-hc-report-body-pages {
    margin-top: 2rem;
  }
  .se-hc-report-body-pages h2 {
    margin: 2rem 0 0.75rem;
    font-size: 1.125rem;
    font-weight: 700;
    padding-bottom: 0.35rem;
    border-bottom: 1px solid var(--border);
  }
  .se-hc-report-body-pages h2:first-child { margin-top: 0; }
  .se-hc-report-body-pages h3 { margin: 1.25rem 0 0.5rem; font-size: 1rem; font-weight: 600; }
  .se-hc-report-body-pages h4 { margin: 1rem 0 0.35rem; font-size: 0.875rem; font-weight: 600; }
  .se-hc-report-body-pages p { margin: 0.5rem 0; color: var(--muted); font-size: 0.875rem; }
  .se-hc-report-body-pages p strong { color: var(--text); }
  .se-hc-report-body-pages .table-wrapper {
    overflow-x: auto;
    margin: 0.75rem 0 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
  }
  .se-hc-report-body-pages table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  .se-hc-report-body-pages th,
  .se-hc-report-body-pages td {
    padding: 0.5rem 0.65rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  .se-hc-report-body-pages th {
    background: var(--th-bg);
    font-weight: 600;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .se-hc-report-body-pages tr:last-child td { border-bottom: none; }
  .se-hc-report-body-pages ul { margin: 0.5rem 0; padding-left: 1.25rem; color: var(--muted); font-size: 0.875rem; }
  .se-hc-priority-steps li { margin: 0.25rem 0; }
`;

const THEME_TOGGLE_SCRIPT = `
<script>
(function(){
  var btn = document.getElementById('theme-toggle');
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    btn.textContent = t === 'dark' ? '\\u2600' : '\\u263E';
    btn.title = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
  btn.addEventListener('click', function() {
    var cur = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(cur === 'dark' ? 'light' : 'dark');
  });
  setTheme('dark');
})();
</script>`;

export function buildSeHealthCheckBrowserHtmlDocument(p: SEHealthCheckReportParams): string {
  const inner = buildSEHealthCheckReportHtml(p, { variant: "browser" });
  const title = "Sophos Firewall Health Check";
  const company = "Sophos FireComply";
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <title>${title} — ${company}</title>
  <style>${BROWSER_BASE_CSS}</style>
</head>
<body>
  <button id="theme-toggle" type="button" aria-label="Toggle theme">&#9728;</button>
  <div class="se-hc-browser-root">
    ${inner}
  </div>
  ${THEME_TOGGLE_SCRIPT}
</body>
</html>`;
}
