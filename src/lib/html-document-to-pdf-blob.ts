/**
 * Client-side: render a full HTML document string (e.g. from buildPdfHtml) into a PDF Blob.
 *
 * jsPDF's `html()` + `autoPaging` is unreliable (blank pages, wrong slices). We use
 * html2canvas on the iframe `body`, then tile the bitmap across A4 pages with `addImage`.
 *
 * html2canvas does not reliably resolve CSS variables — we inject hex overrides first.
 * The iframe stays in-viewport at near-zero opacity so Chromium still paints (far off-screen
 * iframes often rasterize empty).
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  SE_HEALTH_CHECK_PDF_LAYOUT_CSS,
  SE_HEALTH_CHECK_PDF_PROFILE,
} from "@/lib/se-health-check-pdf-layout";
import { SE_PDF_SOPHOS_LOCKUP_SRC } from "@/lib/se-health-check-report-html";

const IFRAME_WIDTH_PX = 1024;

/** A4 height in CSS px at capture width (210×297 mm ⇒ one PDF page slice in html2canvas tiling). */
const SE_HC_COVER_PAGE_HEIGHT_CSS = `calc(${IFRAME_WIDTH_PX}px * 297 / 210)`;

/** Must mirror buildPdfHtml light theme; all `!important` to beat var()-based rules */
const PDF_HTML2CANVAS_FIX_CSS = `
html, body {
  background: #ffffff !important;
  color: #334155 !important;
}
.theme-toggle { display: none !important; }
.report-header {
  background: #10037C !important;
  color: #ffffff !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
.report-header .brand-sub,
.report-header .meta,
.report-header .meta div {
  color: rgba(255, 255, 255, 0.92) !important;
}
.report-header svg path,
.report-header svg polygon,
.report-header svg g {
  fill: #ffffff !important;
}
.print-content {
  background: #ffffff !important;
  color: #334155 !important;
}
.print-content h1,
.print-content h2,
.print-content h3,
.print-content h4,
.print-content h5,
.print-content h6,
.print-content strong {
  color: #001A47 !important;
}
.print-content h2 {
  border-bottom-color: #2006F7 !important;
}
.print-content p,
.print-content li,
.print-content td {
  color: #334155 !important;
}
/* Cover — Sophos Central PDF–style (wordmark, 4-line meta, centre mark, centred footer) */
.se-hc-cover-fullpage {
  background: #001A47 !important;
  color: #ffffff !important;
  /* Exactly one A4 page at ${IFRAME_WIDTH_PX}px width so overview starts on PDF page 2 */
  height: ${SE_HC_COVER_PAGE_HEIGHT_CSS} !important;
  min-height: ${SE_HC_COVER_PAGE_HEIGHT_CSS} !important;
  max-height: ${SE_HC_COVER_PAGE_HEIGHT_CSS} !important;
  box-sizing: border-box !important;
  padding: 48px 48px 40px !important;
  display: flex !important;
  flex-direction: column !important;
  width: 100% !important;
  margin: 0 !important;
  overflow: hidden !important;
}
.se-hc-cover-brand {
  flex-shrink: 0 !important;
  padding-top: 8px !important;
}
.se-hc-cover-wordmark {
  display: block !important;
  height: auto !important;
  width: auto !important;
  max-height: 36px !important;
  max-width: min(360px, 92%) !important;
  object-fit: contain !important;
  object-position: left center !important;
}
.se-hc-cover-body {
  flex: 1 !important;
  display: flex !important;
  flex-direction: column !important;
  min-height: 0 !important;
  background-color: #001A47 !important;
}
.se-hc-cover-text {
  margin-top: 56px !important;
  flex-shrink: 0 !important;
}
.se-hc-cover-fullpage h1 {
  font-size: 28pt !important;
  font-weight: 700 !important;
  line-height: 1.15 !important;
  margin: 0 0 28px !important;
  padding: 0 !important;
  border: none !important;
  color: #ffffff !important;
  font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif !important;
  text-align: left !important;
}
.se-hc-cover-meta-line {
  margin: 0 0 10px !important;
  font-size: 12pt !important;
  line-height: 1.45 !important;
  color: #ffffff !important;
  font-family: 'Zalando Sans', -apple-system, sans-serif !important;
  font-weight: 400 !important;
}
.se-hc-cover-label {
  font-weight: 700 !important;
}
.se-hc-cover-mark-wrap {
  flex: 1 1 auto !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 16px 0 20px !important;
  min-height: 0 !important;
  background-color: #001A47 !important;
}
.se-hc-cover-mark-img {
  display: block !important;
  width: 200px !important;
  max-width: min(220px, 72%) !important;
  height: auto !important;
  object-fit: contain !important;
}
.se-hc-cover-bottom {
  flex-shrink: 0 !important;
  text-align: center !important;
  padding-top: 8px !important;
}
.se-hc-cover-copy {
  font-size: 8.5pt !important;
  color: rgba(255, 255, 255, 0.92) !important;
  margin: 0 0 6px !important;
}
.se-hc-cover-confidential {
  font-size: 9pt !important;
  font-weight: 700 !important;
  letter-spacing: 0.12em !important;
  color: #ffffff !important;
  margin: 0 !important;
}
/* Win over .print-content h1 / p (same specificity + order was losing before) */
.print-content .se-hc-cover-fullpage h1,
.print-content .se-hc-cover-fullpage p,
.print-content .se-hc-cover-fullpage span.se-hc-cover-label {
  color: #ffffff !important;
}
.print-content .se-hc-cover-fullpage .se-hc-cover-copy {
  color: rgba(255, 255, 255, 0.92) !important;
}
.print-content .se-hc-cover-fullpage .se-hc-cover-confidential {
  color: #ffffff !important;
}
.print-content .se-hc-cover-fullpage strong {
  color: #ffffff !important;
}
/* Overview — navy top band, teal title, sans body (Central “Security Checkup Overview” layout) */
.se-hc-overview-sheet {
  background: #ffffff !important;
  page-break-before: always !important;
  break-before: page !important;
  page-break-after: always !important;
  break-after: page !important;
  padding: 0 !important;
  margin: 0 !important;
}
.se-hc-overview-header-navy {
  background: #001b44 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  padding: 40px 48px 48px !important;
  min-height: 280px !important;
  box-sizing: border-box !important;
}
.se-hc-overview-wordmark {
  display: block !important;
  height: auto !important;
  width: auto !important;
  max-height: 36px !important;
  max-width: min(360px, 92%) !important;
  object-fit: contain !important;
  object-position: left center !important;
  flex-shrink: 0 !important;
}
/* Solid teal — html2canvas does not paint background-clip: text (shows as a bar) */
.print-content h2.se-hc-overview-title {
  margin-top: auto !important;
  margin-bottom: 0 !important;
  padding: 0 !important;
  border: none !important;
  border-bottom: none !important;
  font-size: 22pt !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
  font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif !important;
  text-align: left !important;
  background-image: none !important;
  background-clip: border-box !important;
  -webkit-background-clip: border-box !important;
  color: #00d094 !important;
  -webkit-text-fill-color: #00d094 !important;
}
.se-hc-overview-body {
  padding: 32px 48px 40px !important;
  background: #ffffff !important;
}
.se-hc-overview-body p {
  font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  font-size: 11pt !important;
  line-height: 1.6 !important;
  color: #0f172a !important;
  margin: 0 0 14px !important;
}
.se-hc-overview-body strong {
  color: #001a47 !important;
  font-weight: 700 !important;
}
.se-hc-overview-copy-footer {
  margin-top: 28px !important;
  margin-bottom: 0 !important;
  font-size: 9pt !important;
  color: #94a3b8 !important;
  text-align: left !important;
  font-family: 'Zalando Sans', -apple-system, sans-serif !important;
}
.table-wrapper {
  border-color: #e2e8f0 !important;
  background: #ffffff !important;
}
table th {
  position: static !important;
  background: #10037C !important;
  color: #ffffff !important;
  border-color: #e2e8f0 !important;
}
table td {
  border-color: #e2e8f0 !important;
  color: #334155 !important;
}
tbody tr:nth-child(even) td {
  background: #f8fafc !important;
  color: #334155 !important;
}
tbody tr:nth-child(odd) td {
  background: #ffffff !important;
  color: #334155 !important;
}
.pdf-toc, .pdf-toc-title {
  color: #001A47 !important;
}
.pdf-toc a {
  color: #2006F7 !important;
}
.report-footer {
  color: #94a3b8 !important;
  background: #ffffff !important;
  border-top-color: #e2e8f0 !important;
}
blockquote {
  background: rgba(32, 6, 247, 0.06) !important;
  border-left-color: #2006F7 !important;
  color: #334155 !important;
}
code {
  background: #f1f5f9 !important;
  color: #2006F7 !important;
}
/* SE Health Check — body pages (mirrors se-health-check-pdf-layout for html2canvas) */
.se-hc-report-body-pages {
  background: #ffffff !important;
  padding-top: calc(1024px * 5 / 210) !important;
}
.se-hc-report-body-pages > h2:first-of-type {
  margin-top: 0 !important;
}
.se-hc-report-body-pages h2 {
  font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif !important;
  font-size: 20pt !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
  color: #001A47 !important;
  /* 1px: a 2px rule reads as a thick “black bar” when html2canvas slices across a page break */
  border-bottom: 1px solid #001A47 !important;
  border-bottom-color: #001A47 !important;
  padding-bottom: 10px !important;
  margin: 0 0 18px !important;
}
.se-hc-report-body-pages h3 {
  font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  font-size: 12.5pt !important;
  font-weight: 700 !important;
  color: #111827 !important;
  margin: 22px 0 10px !important;
}
.se-hc-report-body-pages h4 {
  font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  font-size: 11pt !important;
  font-weight: 700 !important;
  color: #0f172a !important;
}
.se-hc-report-body-pages p,
.se-hc-report-body-pages li {
  font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  font-size: 11pt !important;
  line-height: 1.55 !important;
  color: #0f172a !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
}
.se-hc-report-body-pages .table-wrapper {
  margin: 16px 0 22px !important;
  padding: 14px 16px 16px !important;
  background: #ffffff !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 6px !important;
  box-sizing: border-box !important;
  overflow: visible !important;
}
.se-hc-report-body-pages .table-wrapper table {
  min-width: 0 !important;
  border-collapse: collapse !important;
}
.se-hc-report-body-pages thead th {
  position: static !important;
  top: auto !important;
  background: #ffffff !important;
  color: #111827 !important;
  font-weight: 700 !important;
  font-size: 10pt !important;
  text-transform: none !important;
  border: none !important;
  border-bottom: 2px solid #e5e7eb !important;
  padding: 10px 12px 10px 0 !important;
}
.se-hc-report-body-pages tbody td {
  background: #ffffff !important;
  color: #1f2937 !important;
  border-color: #f3f4f6 !important;
  padding: 9px 12px 9px 0 !important;
  vertical-align: top !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
}
.se-hc-report-body-pages tbody tr:nth-child(even) td {
  background: #f9fafb !important;
  color: #1f2937 !important;
}
.se-hc-report-body-pages tbody tr:nth-child(odd) td {
  background: #ffffff !important;
}
.se-hc-report-body-pages ul {
  margin: 8px 0 14px !important;
  padding-left: 1.35em !important;
}
.se-hc-report-body-pages ul.se-hc-priority-steps {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}
.se-hc-report-body-pages ul li {
  margin: 0.35em 0 !important;
}
.se-hc-pdf-baseline-spacer {
  display: block !important;
  flex: none !important;
  box-sizing: border-box !important;
}
`;

function injectHtml2CanvasFixStyles(doc: Document, extraCss?: string) {
  const style = doc.createElement("style");
  style.setAttribute("data-pdf-html2canvas-fix", "true");
  style.textContent = PDF_HTML2CANVAS_FIX_CSS + (extraCss ?? "");
  doc.head.appendChild(style);
}

/** Safe fragment for download filenames */
export function sanitizePdfFilenamePart(raw: string): string {
  const t = raw.trim().replace(/[^\w\s-]+/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  return t.replace(/^-|-$/g, "").slice(0, 48) || "report";
}

/** First PDF page (1-based) that gets the Sophos body lockup — after cover (1) and overview (2). */
const SE_HEALTH_CHECK_LOCKUP_FIRST_PAGE_1_BASED = 3;

/** Headings that would start below this fraction of a PDF slice are nudged to the next slice (global SE rule). */
const SE_HEALTH_HEADING_CLEAR_PAGE_FRACTION = 0.65;

/** If less than this many px remain in the slice below the heading bottom, nudge (avoid orphan h2 + tiny tail). */
const SE_HEALTH_MIN_SLICE_TAIL_BELOW_HEADING_PX = 130;

/**
 * Entire heading box must fit between its top and the slice end (incl. h2 border). Otherwise html2canvas
 * splits it across PDF tiles (“Entities.xml — Baseline…” half on each page).
 */
const SE_HEALTH_HEADING_SLICE_FIT_MARGIN_PX = 10;

/**
 * Per-firewall “… — Baseline and findings” h2: insert a non-collapsing spacer if it starts past this
 * fraction of the slice. (margin-top on h2 can collapse with the preceding `ul` and fail to move the paint.)
 */
const SE_HEALTH_BASELINE_H2_SLICE_FRAC_SPACER = 0.35;

/** White band at top of PDF slices that start mid-table (continuation pages). */
const SE_HEALTH_TABLE_CONTINUATION_TOP_PAD_MM = 8;

/**
 * Top padding on body PDF slices that get the Sophos lockup stamp, so the first line of content
 * clears the stamped logo. Mid-table slices skip the stamp and use only
 * {@link SE_HEALTH_TABLE_CONTINUATION_TOP_PAD_MM}.
 */
const SE_HEALTH_LOCKUP_TOP_CLEARANCE_MM = 10;

type SeHealthTilePagePlan = {
  consumedStartMm: number;
  topPadMm: number;
  contentMm: number;
  sliceTopPx: number;
};

function buildSeHealthPdfTilePlan(
  imgH_mm: number,
  usableH_mm: number,
  scrollH: number,
  tableSlices: { topPx: number; bottomPx: number }[],
): SeHealthTilePagePlan[] {
  const firstBodyPage0 = SE_HEALTH_CHECK_LOCKUP_FIRST_PAGE_1_BASED - 1;
  const plan: SeHealthTilePagePlan[] = [];
  let consumedMm = 0;
  let pageIdx = 0;

  while (consumedMm < imgH_mm - 0.01) {
    const sliceTopPx = (consumedMm / imgH_mm) * scrollH;
    const midTable =
      pageIdx >= firstBodyPage0 && pdfSliceTopStartsInsideTable(sliceTopPx, tableSlices);
    const topPadMm =
      pageIdx < firstBodyPage0
        ? 0
        : midTable
          ? SE_HEALTH_TABLE_CONTINUATION_TOP_PAD_MM
          : SE_HEALTH_LOCKUP_TOP_CLEARANCE_MM;
    const remaining = imgH_mm - consumedMm;
    const contentMm = Math.min(usableH_mm - topPadMm, remaining);
    if (contentMm <= 0.01) break;
    plan.push({
      consumedStartMm: consumedMm,
      topPadMm,
      contentMm,
      sliceTopPx,
    });
    consumedMm += contentMm;
    pageIdx += 1;
  }

  return plan;
}

function elementTopRelativeToBody(el: Element, body: HTMLElement): number {
  const br = body.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  return er.top - br.top + body.scrollTop;
}

function collectSeHealthBodyTableSlices(body: HTMLElement): { topPx: number; bottomPx: number }[] {
  const root = body.querySelector(".se-hc-report-body-pages");
  if (!root) return [];
  const slices: { topPx: number; bottomPx: number }[] = [];
  root.querySelectorAll(".table-wrapper").forEach((wrap) => {
    const topPx = elementTopRelativeToBody(wrap, body);
    const rect = wrap.getBoundingClientRect();
    slices.push({ topPx, bottomPx: topPx + rect.height });
  });
  return slices;
}

/** Map SE tile plan to document-Y bounds (must match addCanvasToPdf variable slice heights). */
function seHealthSliceBoundsPxFromPlan(
  plan: SeHealthTilePagePlan[],
  scrollH: number,
  imgH_mm: number,
): { startPx: number; heightPx: number }[] {
  return plan.map((row) => ({
    startPx: (row.consumedStartMm / imgH_mm) * scrollH,
    heightPx: (row.contentMm / imgH_mm) * scrollH,
  }));
}

function locateHeadingInSeSlices(
  yPx: number,
  bounds: { startPx: number; heightPx: number }[],
  fallbackSlicePx: number,
): { posInSlicePx: number; sliceHeightPx: number; sliceIndex: number } {
  let bestIdx = -1;
  for (let i = 0; i < bounds.length; i++) {
    const { startPx, heightPx } = bounds[i];
    const endPx = startPx + heightPx;
    /* Loose bounds fix subpixel drops to sliceIndex −1; if two slices match (boundary), take the later slice. */
    if (yPx >= startPx - 1.5 && yPx < endPx + 1.5) {
      bestIdx = i;
    }
  }
  if (bestIdx >= 0) {
    const { startPx, heightPx } = bounds[bestIdx];
    const posInSlicePx = Math.max(0, Math.min(yPx - startPx, heightPx));
    return { posInSlicePx, sliceHeightPx: heightPx, sliceIndex: bestIdx };
  }
  const posInSlicePx = ((yPx % fallbackSlicePx) + fallbackSlicePx) % fallbackSlicePx;
  return { posInSlicePx, sliceHeightPx: fallbackSlicePx, sliceIndex: -1 };
}

/**
 * Nudge h2/h3 when they fall in the bottom (1 − fraction) of their **actual** PDF slice.
 * Uses the same variable-height tile plan as PDF tiling — `yMm % 297` is wrong after 8mm table pads.
 */
function nudgeSeHealthHeadingsClearOfPageEnd(
  idoc: Document,
  scrollH: number,
  imgH_mm: number,
  clearBelowFraction: number,
  tilePlan: SeHealthTilePagePlan[] | null,
): void {
  const body = idoc.body;
  const fallbackSlicePx = (IFRAME_WIDTH_PX * 297) / 210;
  const bounds =
    tilePlan && tilePlan.length > 0 ? seHealthSliceBoundsPxFromPlan(tilePlan, scrollH, imgH_mm) : null;
  const heads = [
    ...body.querySelectorAll<HTMLElement>(".se-hc-report-body-pages h2, .se-hc-report-body-pages h3"),
  ];
  // #region agent log
  fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
    body: JSON.stringify({
      sessionId: "360061",
      runId: "post-fix",
      hypothesisId: "B",
      location: "html-document-to-pdf-blob.ts:nudgeSeHealthHeadingsClearOfPageEnd:entry",
      message: "nudge entry",
      data: {
        headCount: heads.length,
        scrollH,
        imgH_mm,
        planPages: tilePlan?.length ?? 0,
        usingPlanBounds: !!bounds?.length,
        previews: heads.slice(0, 12).map((h) => (h.textContent || "").trim().slice(0, 80)),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  heads.sort((a, b) => elementTopRelativeToBody(a, body) - elementTopRelativeToBody(b, body));
  for (const el of heads) {
    const isBaselineFindingsH2 =
      el.tagName === "H2" &&
      (el.classList.contains("se-hc-h2-baseline-findings") || /^firewall-\d+$/.test(el.id || ""));
    const yPx = elementTopRelativeToBody(el, body);
    const elH = Math.ceil(
      Math.max(el.getBoundingClientRect().height, (el as HTMLElement).offsetHeight || 0),
    );
    const yBot = yPx + elH;
    const { posInSlicePx, sliceHeightPx, sliceIndex } = bounds?.length
      ? locateHeadingInSeSlices(yPx, bounds, fallbackSlicePx)
      : {
          posInSlicePx: ((yPx % fallbackSlicePx) + fallbackSlicePx) % fallbackSlicePx,
          sliceHeightPx: fallbackSlicePx,
          sliceIndex: -1,
        };
    const sh = Math.max(sliceHeightPx, 1);
    const frac = posInSlicePx / sh;
    /** Heading bottom extends into bottom (1 − fraction) band, or crosses slice → border/h2 splits across pages. */
    let needNudge = frac > clearBelowFraction + 0.002;
    if (bounds?.length && sliceIndex >= 0) {
      const sliceStart = bounds[sliceIndex].startPx;
      const sliceEnd = sliceStart + sh;
      const safeEnd = sliceStart + clearBelowFraction * sh;
      const edgeEps = 3;
      if (yBot > safeEnd - edgeEps || yBot > sliceEnd - edgeEps) {
        needNudge = true;
      }
      const tailBelow = sliceEnd - yBot;
      if (tailBelow >= -edgeEps && tailBelow < SE_HEALTH_MIN_SLICE_TAIL_BELOW_HEADING_PX) {
        needNudge = true;
      }
      /* Must fit whole heading in this slice (multi-line h2 + border was straddling tiles). */
      const roomFromTopInSlice = sh - posInSlicePx;
      if (elH > roomFromTopInSlice - SE_HEALTH_HEADING_SLICE_FIT_MARGIN_PX) {
        needNudge = true;
      }
      /* Top and bottom edge land in different PDF slices (rounding / subpixel). */
      const sliceForBottom = locateHeadingInSeSlices(yBot - 2, bounds, fallbackSlicePx).sliceIndex;
      if (sliceForBottom >= 0 && sliceForBottom !== sliceIndex) {
        needNudge = true;
      }
    }
    // #region agent log
    fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
      body: JSON.stringify({
        sessionId: "360061",
        runId: "post-fix",
        hypothesisId: "A",
        location: "html-document-to-pdf-blob.ts:nudgeSeHealthHeadingsClearOfPageEnd:heading",
        message: "heading slice math (plan-aware)",
        data: {
          tag: el.tagName,
          text: (el.textContent || "").trim().slice(0, 100),
          yPx,
          sliceIndex,
          posInSlicePx: Math.round(posInSlicePx * 10) / 10,
          sliceHeightPx: Math.round(sliceHeightPx * 10) / 10,
          frac: Math.round(frac * 1000) / 1000,
          needNudge,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    /* Baseline/findings h2 uses block spacers (see applySeHealthBaselineH2SliceSpacers) — not margin-top (collapses with ul). */
    if (needNudge && !isBaselineFindingsH2) {
      const deltaPx = sh - posInSlicePx + 20;
      const cur = parseFloat(idoc.defaultView?.getComputedStyle(el).marginTop || "0") || 0;
      el.style.marginTop = `${cur + deltaPx}px`;
    }
    void body.offsetHeight;
  }
}

/**
 * `margin-top` on h2 after a list often **collapses** with the `ul`’s margin, so PDF slice nudges don’t move the
 * painted heading. Insert a real block before `.se-hc-h2-baseline-findings` to force the next tile.
 */
function applySeHealthBaselineH2SliceSpacers(
  idoc: Document,
  body: HTMLElement,
  scrollH: number,
  imgH_mm: number,
  tilePlan: SeHealthTilePagePlan[] | null,
): void {
  if (!tilePlan?.length) return;
  body.querySelectorAll(".se-hc-pdf-baseline-spacer").forEach((n) => n.remove());

  const bounds = seHealthSliceBoundsPxFromPlan(tilePlan, scrollH, imgH_mm);
  const fallbackSlicePx = (IFRAME_WIDTH_PX * 297) / 210;
  const h2s = body.querySelectorAll<HTMLElement>(".se-hc-h2-baseline-findings");

  for (const h2 of h2s) {
    h2.style.marginTop = "";
    const yPx = elementTopRelativeToBody(h2, body);
    const elH = Math.ceil(Math.max(h2.getBoundingClientRect().height, h2.offsetHeight || 0));
    const { posInSlicePx, sliceHeightPx, sliceIndex } = locateHeadingInSeSlices(yPx, bounds, fallbackSlicePx);
    if (sliceIndex < 0) continue;
    const sh = Math.max(sliceHeightPx, 1);
    const frac = posInSlicePx / sh;
    const room = sh - posInSlicePx;
    const sliceEnd = bounds[sliceIndex].startPx + sh;
    const sliceForBottom = locateHeadingInSeSlices(yPx + Math.max(0, elH - 3), bounds, fallbackSlicePx).sliceIndex;

    const needsSpacer =
      frac > SE_HEALTH_BASELINE_H2_SLICE_FRAC_SPACER ||
      elH > room - SE_HEALTH_HEADING_SLICE_FIT_MARGIN_PX ||
      yPx + elH > sliceEnd - 6 ||
      (sliceForBottom >= 0 && sliceForBottom !== sliceIndex);

    if (!needsSpacer) continue;

    const pushPx = Math.ceil(Math.max(sh - posInSlicePx + 36, elH + 64));
    const spacer = idoc.createElement("div");
    spacer.className = "se-hc-pdf-baseline-spacer";
    spacer.setAttribute("aria-hidden", "true");
    spacer.style.cssText = `display:block;height:${pushPx}px;width:100%;margin:0;padding:0;border:0;clear:both;overflow:hidden;line-height:0;`;
    h2.parentNode?.insertBefore(spacer, h2);
  }
  void body.offsetHeight;
}

/** True when the top of a PDF slice is inside table content (continuation) — skip lockup. Slice aligned with table top still gets a stamp. */
function pdfSliceTopStartsInsideTable(
  sliceTopPx: number,
  tables: { topPx: number; bottomPx: number }[],
): boolean {
  for (const t of tables) {
    if (sliceTopPx > t.topPx + 1 && sliceTopPx < t.bottomPx - 1) {
      return true;
    }
  }
  return false;
}

async function fetchPathAsDataUrl(path: string): Promise<string | null> {
  try {
    const href =
      path.startsWith("http:") || path.startsWith("https:")
        ? path
        : new URL(path, window.location.origin).href;
    const res = await fetch(href);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function naturalSizeFromDataUrl(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not decode PDF lockup image"));
    img.src = dataUrl;
  });
}

/**
 * Overlay compact Sophos lockup on body PDF pages (page 3+), skipping slices that start mid-table.
 */
async function stampSeHealthCheckLockupOnPdf(
  pdf: jsPDF,
  ctx: {
    scrollH: number;
    imgH_mm: number;
    usableH_mm: number;
    tableSlices: { topPx: number; bottomPx: number }[];
    tilePlan: SeHealthTilePagePlan[] | null;
  },
): Promise<void> {
  const dataUrl = await fetchPathAsDataUrl(SE_PDF_SOPHOS_LOCKUP_SRC);
  if (!dataUrl) return;
  let dims: { w: number; h: number };
  try {
    dims = await naturalSizeFromDataUrl(dataUrl);
  } catch {
    return;
  }
  if (dims.w < 1 || dims.h < 1) return;

  const marginLeftMm = 14;
  const marginTopMm = 3;
  const heightMm = 3;
  const widthMm = Math.min(heightMm * (dims.w / dims.h), 24);
  const total = pdf.getNumberOfPages();
  for (let p = SE_HEALTH_CHECK_LOCKUP_FIRST_PAGE_1_BASED; p <= total; p++) {
    const idx = p - 1;
    const sliceTopPx =
      ctx.tilePlan && ctx.tilePlan[idx] !== undefined
        ? ctx.tilePlan[idx].sliceTopPx
        : (((p - 1) * ctx.usableH_mm) / ctx.imgH_mm) * ctx.scrollH;
    if (pdfSliceTopStartsInsideTable(sliceTopPx, ctx.tableSlices)) {
      continue;
    }
    pdf.setPage(p);
    pdf.addImage(dataUrl, "PNG", marginLeftMm, marginTopMm, widthMm, heightMm);
  }
}

/**
 * Tile one tall image across A4 portrait pages (mm units).
 * Optional SE Health plan: extra top padding on slices that start mid-table (table continuation).
 */
function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  marginMm: number,
  seHealthTilePlan?: SeHealthTilePagePlan[] | null,
): { imgH_mm: number; usableH_mm: number; pageCount: number; seHealthTilePlan: SeHealthTilePagePlan[] | null } {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const usableW = pageW - 2 * marginMm;
  const usableH = pageH - 2 * marginMm;

  const imgW = usableW;
  const imgH = (canvas.height * imgW) / canvas.width;
  /* Max quality for SE: reduces JPEG block edges that read as dark lines between tiles */
  const jpegQuality = seHealthTilePlan && seHealthTilePlan.length > 0 ? 1 : 0.92;
  const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);

  if (seHealthTilePlan && seHealthTilePlan.length > 0) {
    for (let i = 0; i < seHealthTilePlan.length; i++) {
      if (i > 0) pdf.addPage();
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageW, pageH, "F");
      const { consumedStartMm, topPadMm } = seHealthTilePlan[i];
      /*
       * Image is placed at y = margin + topPad - consumedStart so that document mm `consumedStart`
       * aligns with y = margin + topPad. That also paints document [consumedStart - topPad, consumedStart)
       * into PDF y ∈ [margin, margin + topPad) — a repeat of the previous page’s tail. Mask it white;
       * Sophos lockup is stamped afterward in that band.
       */
      pdf.addImage(dataUrl, "JPEG", marginMm, marginMm + topPadMm - consumedStartMm, imgW, imgH);
      if (topPadMm > 0.01) {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageW, marginMm + topPadMm, "F");
      }
    }
    return {
      imgH_mm: imgH,
      usableH_mm: usableH,
      pageCount: seHealthTilePlan.length,
      seHealthTilePlan,
    };
  }

  let consumed = 0;
  let first = true;
  let pageCount = 0;
  while (consumed < imgH - 0.01) {
    if (!first) pdf.addPage();
    first = false;
    pdf.addImage(dataUrl, "JPEG", marginMm, marginMm - consumed, imgW, imgH);
    consumed += usableH;
    pageCount++;
  }
  return { imgH_mm: imgH, usableH_mm: usableH, pageCount, seHealthTilePlan: null };
}

/**
 * @param fullHtml - Complete HTML document (`<!DOCTYPE html>...`) from buildPdfHtml or similar
 */
export async function htmlDocumentStringToPdfBlob(fullHtml: string): Promise<Blob> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "pdf-generation");
  iframe.setAttribute("aria-hidden", "true");
  /* In-viewport but invisible — off-screen / opacity-0 parent iframes often capture blank in Chromium */
  Object.assign(iframe.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${IFRAME_WIDTH_PX}px`,
    height: "100px",
    border: "0",
    opacity: "0.02",
    pointerEvents: "none",
    zIndex: "2147483646",
    overflow: "hidden",
  });
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const idoc = iframe.contentDocument;
  if (!win || !idoc) {
    document.body.removeChild(iframe);
    throw new Error("Could not create iframe for PDF generation");
  }

  idoc.open();
  idoc.write(fullHtml);
  idoc.close();

  await new Promise((r) => setTimeout(r, 700));
  try {
    await idoc.fonts?.ready;
  } catch {
    /* ignore */
  }

  const pdfProfile = idoc.documentElement.getAttribute("data-pdf-profile");
  const isSeHealthPdf = pdfProfile === SE_HEALTH_CHECK_PDF_PROFILE;
  const pageMarginMm = isSeHealthPdf ? 0 : 10;
  injectHtml2CanvasFixStyles(idoc, isSeHealthPdf ? SE_HEALTH_CHECK_PDF_LAYOUT_CSS : "");

  idoc.documentElement.setAttribute("data-theme", "light");

  idoc.querySelectorAll("script").forEach((s) => s.remove());
  idoc.querySelectorAll(".theme-toggle, #themeBtn").forEach((el) => el.remove());

  void idoc.body.offsetHeight;

  let scrollH = Math.min(
    Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight, 400),
    32000,
  );
  iframe.style.height = `${Math.min(scrollH + 32, 32000)}px`;

  void idoc.body.offsetHeight;

  const body = idoc.body;

  let tableSlices: { topPx: number; bottomPx: number }[] = [];

  if (isSeHealthPdf) {
    const usableW_mm = 210 - 2 * pageMarginMm;
    /* Two passes: nudge changes scrollHeight; rebuild tile plan + bounds each pass or slice math lags → orphan headings. */
    for (let pass = 0; pass < 3; pass++) {
      scrollH = Math.min(
        Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight, 400),
        32000,
      );
      iframe.style.height = `${Math.min(scrollH + 32, 32000)}px`;
      void body.offsetHeight;
      tableSlices = collectSeHealthBodyTableSlices(body);
      const imgH_mm_est = (scrollH * usableW_mm) / IFRAME_WIDTH_PX;
      const nudgeTilePlan = buildSeHealthPdfTilePlan(imgH_mm_est, 297, scrollH, tableSlices);
      nudgeSeHealthHeadingsClearOfPageEnd(
        idoc,
        scrollH,
        imgH_mm_est,
        SE_HEALTH_HEADING_CLEAR_PAGE_FRACTION,
        nudgeTilePlan,
      );
      void body.offsetHeight;
    }
    for (let spPass = 0; spPass < 2; spPass++) {
      scrollH = Math.min(
        Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight, 400),
        32000,
      );
      iframe.style.height = `${Math.min(scrollH + 32, 32000)}px`;
      void body.offsetHeight;
      tableSlices = collectSeHealthBodyTableSlices(body);
      const imgH_mm_est = (scrollH * usableW_mm) / IFRAME_WIDTH_PX;
      const spacerPlan = buildSeHealthPdfTilePlan(imgH_mm_est, 297, scrollH, tableSlices);
      applySeHealthBaselineH2SliceSpacers(idoc, body, scrollH, imgH_mm_est, spacerPlan);
    }
    scrollH = Math.min(
      Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight, 400),
      32000,
    );
    iframe.style.height = `${Math.min(scrollH + 32, 32000)}px`;
    void body.offsetHeight;
    tableSlices = collectSeHealthBodyTableSlices(body);
  }

  const scale = scrollH > 9000 ? 1.15 : scrollH > 6000 ? 1.35 : 1.65;

  try {
    const canvas = await html2canvas(body, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: IFRAME_WIDTH_PX,
      height: scrollH,
      windowWidth: IFRAME_WIDTH_PX,
      windowHeight: scrollH,
      scrollX: 0,
      scrollY: 0,
      foreignObjectRendering: false,
      onclone: (_clonedDoc, clonedBody) => {
        clonedBody.style.overflow = "visible";
      },
    });

    if (canvas.width < 2 || canvas.height < 2) {
      throw new Error("PDF capture produced an empty image — try again.");
    }

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const usableW = pageW - 2 * pageMarginMm;
    const usableH = pageH - 2 * pageMarginMm;
    const imgH_pre = (canvas.height * usableW) / canvas.width;

    // #region agent log
    if (isSeHealthPdf) {
      fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
        body: JSON.stringify({
          sessionId: "360061",
          runId: "pre-fix",
          hypothesisId: "C",
          location: "html-document-to-pdf-blob.ts:htmlDocumentStringToPdfBlob:post-canvas",
          message: "capture dimensions",
          data: {
            scrollH,
            canvasH: canvas.height,
            canvasW: canvas.width,
            imgH_pre_mm: Math.round(imgH_pre * 100) / 100,
            usableW_mm: Math.round(usableW * 100) / 100,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion

    const seTilePlan = isSeHealthPdf
      ? buildSeHealthPdfTilePlan(imgH_pre, usableH, scrollH, tableSlices)
      : null;

    const tile = addCanvasToPdf(pdf, canvas, pageMarginMm, seTilePlan);
    if (isSeHealthPdf) {
      await stampSeHealthCheckLockupOnPdf(pdf, {
        scrollH,
        imgH_mm: tile.imgH_mm,
        usableH_mm: tile.usableH_mm,
        tableSlices,
        tilePlan: tile.seHealthTilePlan,
      });
    }
    return pdf.output("blob");
  } finally {
    document.body.removeChild(iframe);
  }
}
