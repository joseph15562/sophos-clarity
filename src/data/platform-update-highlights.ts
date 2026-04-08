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
      tag: "new" as const,
      text: "Global Tours/Shortcuts + route-aware AI on every page; Mission Control plus Central Alerts/MDR prefetch; Central Groups + MDR merged on Edge; Central tenant sync fixes for inventory.",
    },
    {
      tag: "improved" as const,
      text: "Workspace header (Central popover), unified hub chrome, Central Alerts/MDR merged requests + mission-alerts browser snapshot for faster return visits, API Explorer live keys, changelog threats from Sophos advisories RSS, signed-in firmware table from Central inventory, Insights: Central threat charts by raised time with stacks mapped from product/Event type (not all Other), score-history trends, report/assess activity, recommendations when signed in; report PDF: primary A4 landscape .pdf via pdfmake from markdown (Assess, shared, saved viewer, portal) with HTML-print fallback; Word: embed data:image PNG/JPEG/GIF/BMP as real images (not raw base64 text), WebP called out; HTML print refinements (dense tables, code in cells, branding); SE Health Check snapshot copy; document preview caps MSP logo + markdown images; buildReportHtml strips img sizing attrs and report-body-html uses strong CSS caps; AI report streams: keep-alive on metadata-only SSE chunks, longer report idle window, parse-config higher default max_tokens, clear message on model output-length cap, Edge stream budget + partial warning before host wall-clock cut-off; trim incomplete trailing markdown table row on preview (when not streaming) and exports; parse-config: separate per-minute caps for chat vs reports + clearer 429 vs Google Gemini.",
    },
    {
      tag: "improved" as const,
      text: "Visual polish: ambient mesh + motion-safe pulse, glass panels, gradient title, primary button glow, nav shimmer, richer assist bar; Assess footer: View Findings + Generate Reports on the same strip as Tours/Shortcuts; Save Reports + save errors at the top of the report preview toolbar; Help docs: wider mocks (max-w-6xl), optional zoom on larger breakpoints, taller frame cap; Fleet Map: per-firewall pins, pan/zoom, optional MSP lat/long, Central geo fallback, then country centroid; daily server presence rows keep Assess fleet Agent Status (7-day) green without opening the connector.",
    },
    {
      tag: "fixed" as const,
      text: "Fleet map: sharp landmasses (no SVG blur); pan clamped; min zoom 1×; pin hover shows customer + Sophos tenant when known; portaled from getBoundingClientRect at deep zoom; max 12×. Org/MSP header opens workspace controls in place; Central alerts pagination + merge fixes; cache v5 + dev no-rehydrate; tenant-type whoAmI; richer timestamps. Sign out returns to the login gate (hub routes go to /; stale Skip cleared after session ends). Report library: quick-send email + Resend API; Report Centre archives on saved_reports.archived_at with an Archives section; portal omits archived saves; portal firewall overview merges HA pairs with both serials; Customers Add/Onboard saves manual directory rows (no redirect to Assess). Report Centre row actions use wider spacing and larger icon targets.",
    },
  ] satisfies PlatformHighlightLine[],
};
