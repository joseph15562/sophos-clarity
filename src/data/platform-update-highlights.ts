/**
 * “Platform updates” summary card on `/changelog` (top of Updates page).
 *
 * When you ship user-visible work, update the month + highlights here in the same
 * commit as new bullets in `ChangelogPage.tsx` so the card stays in sync.
 */
export type PlatformHighlightTag = "new" | "improved" | "fixed";

export type PlatformHighlightLine = {
  tag: PlatformHighlightTag;
  text: string;
};

export const PLATFORM_UPDATE_CARD = {
  /** Optional marketing or release label (omit when not versioning the app this way). */
  versionLabel: null as string | null,
  /** Must match the newest `<section>` month heading in ChangelogPage (`YYYY-MM`). */
  monthKey: "2026-04",
  /** Human-readable month for the card (keep aligned with `monthKey`). */
  monthLabel: "April 2026",
  /** 1–4 short lines; mirror the themes of the latest month’s shipped work. */
  highlights: [
    {
      tag: "improved" as const,
      text: "Production hardening: CSP + HSTS + security headers on Vercel; Redis-backed API rate limiting; /healthz ops endpoint; ESLint burn-down (227 → 31 warnings, no-unused-vars escalated to error); Sentry, coverage, semver versioning from v1.0.0.",
    },
    {
      tag: "new" as const,
      text: "Re-run First-Time Setup wizard from Workspace Controls → Settings on any page (Fleet, Customers, Central, etc.); previously only available on Assess.",
    },
    {
      tag: "fixed" as const,
      text: "PDF report firewall rules table trimmed from 23 to 16 columns — no more off-page overflow; AI prompt whitelists exact columns; compliance heading arrow glyph fixed for PDF fonts.",
    },
    {
      tag: "new" as const,
      text: "Global Tours/Shortcuts + route-aware AI on every page; Mission Control plus Central Alerts/MDR prefetch; Central Groups + MDR merged on Edge; Central tenant sync fixes for inventory.",
    },
    {
      tag: "improved" as const,
      text: "Workspace header (Central popover), unified hub chrome, Central Alerts/MDR merged requests + mission-alerts browser snapshot for faster return visits, API Explorer live keys, changelog threats from Sophos advisories RSS, signed-in firmware table from Central inventory, Insights: Central threat charts by raised time with stacks mapped from product/Event type (not all Other), score-history trends, report/assess activity, recommendations when signed in; report PDF: primary server-rendered PDF via headless Chromium with Zalando Sans fonts, rounded table corners, theme colours, and guaranteed A4 landscape — direct .pdf download with no print dialog; pdfmake kept as fallback, then HTML print tab as last resort; shared markdown pass repairs broken Label|(data:…) and Alt](data:…) logos (flexible spacing, line-wrapped base64, fullwidth parens) for pdfmake, Word, and buildReportHtml preview; pdfmake renders line-start and table-cell data-URI PNG/JPEG/GIF; CRLF-safe cover images; large data-URI logos (>450 K chars) are split out before the char-budget truncation so the closing ) is never sliced off and the image actually renders; Word: embed data:image PNG/JPEG/GIF/BMP as real images (not raw base64 text), WebP called out; Word caps Company Logo (and similar alt) embedded PNGs to a small header-sized box so huge rasters do not dominate the page; Word strips saved-report HTML jump divs so they are not printed as text; Word wide tables: if the first column is a row index (# / No / Index), it stays narrow so rule names and other columns get more width; HTML print refinements (dense tables, code in cells, branding); SE Health Check snapshot copy; document preview caps MSP logo + markdown images; buildReportHtml strips img sizing attrs and report-body-html uses strong CSS caps; AI report streams: keep-alive on metadata-only SSE chunks, longer report idle window, parse-config higher default max_tokens, clear message on model output-length cap, Edge stream budget + partial warning before host wall-clock cut-off; trim incomplete rows in the last markdown table block on preview (when not streaming) and exports, plus Evidence note when narrative rows are fewer than parsed counts; individual reports append full parsed firewall table when narrative table is short; parse-config: optional FireComply per-minute caps (env); default off so paid Gemini quotas are the only gate; clearer 429 vs Google when caps enabled; no client instant 429 retry; lighter Gemini 429 backoff on Edge; 429 → fallback model try; report reasoning low by default; Retry cooldown after Gemini limit.",
    },
    {
      tag: "improved" as const,
      text: "Visual polish: ambient mesh + motion-safe pulse, glass panels, gradient title, primary button glow, nav shimmer, richer assist bar; Assess footer: View Findings + Generate Reports on the same strip as Tours/Shortcuts; Save Reports + save errors at the top of the report preview toolbar; Help docs: wider mocks (max-w-6xl), optional zoom on larger breakpoints, taller frame cap; Fleet Map: per-firewall pins, pan/zoom, optional MSP lat/long, Central geo fallback, then country centroid; daily server presence rows keep Assess fleet Agent Status (7-day) green without opening the connector; SE Health Check: data purge per customer or full-SE wipe from the Management drawer.",
    },
    {
      tag: "fixed" as const,
      text: "Fleet map: sharp landmasses (no SVG blur); pan clamped; min zoom 1×; pin hover shows customer + Sophos tenant when known; portaled from getBoundingClientRect at deep zoom; max 12×. Org/MSP header opens workspace controls in place; Central alerts pagination + merge fixes; cache v5 + dev no-rehydrate; tenant-type whoAmI; richer timestamps. Sign out returns to the login gate (hub routes go to /; stale Skip cleared after session ends). Report library: quick-send email + Resend API; Report Centre archives on saved_reports.archived_at with an Archives section; portal omits archived saves; portal firewall overview merges HA pairs with both serials; Customers Add/Onboard saves manual directory rows (no redirect to Assess). Report Centre row actions use wider spacing and larger icon targets; Eye preview loads full saved report HTML; saved report deep link waits for auth before showing not found (no false flash); signed-in orgs see an empty library until reports are saved (no fake demo rows); library refetch on route/tab focus, Refresh list, Supabase load errors surfaced. Saved reports + portal: normalised customer_name on cloud save, org-wide portal lists saves, multi portal_config rows + signed-in UUID portal use tenant_name / ?customer=, shorter portal cache.",
    },
  ] satisfies PlatformHighlightLine[],
};
