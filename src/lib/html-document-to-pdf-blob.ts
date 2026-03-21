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
  padding-top: calc(1024px * 24 / 210) !important;
}
.se-hc-report-body-pages > h2:first-of-type {
  margin-top: 10px !important;
}
.se-hc-report-body-pages h2 {
  font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif !important;
  font-size: 20pt !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
  color: #001A47 !important;
  border-bottom: 2px solid #001A47 !important;
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
.se-hc-report-body-pages ul li {
  margin: 0.35em 0 !important;
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
const SE_HEALTH_HEADING_CLEAR_PAGE_FRACTION = 0.75;

/** White band at top of PDF slices that start mid-table (continuation pages). */
const SE_HEALTH_TABLE_CONTINUATION_TOP_PAD_MM = 8;

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
    const topPadMm =
      pageIdx >= firstBodyPage0 && pdfSliceTopStartsInsideTable(sliceTopPx, tableSlices)
        ? SE_HEALTH_TABLE_CONTINUATION_TOP_PAD_MM
        : 0;
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

/**
 * If a heading would start in the bottom (1 − fraction) of a PDF slice, add margin-top so it moves
 * to the next slice (html2canvas tiling). SE Health Check uses 3/4 — keep titles out of the last quarter.
 */
function nudgeSeHealthHeadingsClearOfPageEnd(
  idoc: Document,
  scrollH: number,
  imgH_mm: number,
  clearBelowFraction: number,
): void {
  const body = idoc.body;
  const usableH_mm = 297;
  const thresholdMm = usableH_mm * clearBelowFraction;
  const slicePxCss = (IFRAME_WIDTH_PX * 297) / 210;
  const heads = [
    ...body.querySelectorAll<HTMLElement>(".se-hc-report-body-pages h2, .se-hc-report-body-pages h3"),
  ];
  // #region agent log
  fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
    body: JSON.stringify({
      sessionId: "360061",
      runId: "pre-fix",
      hypothesisId: "B",
      location: "html-document-to-pdf-blob.ts:nudgeSeHealthHeadingsClearOfPageEnd:entry",
      message: "nudge entry",
      data: {
        headCount: heads.length,
        scrollH,
        imgH_mm,
        thresholdMm,
        slicePxCss,
        previews: heads.slice(0, 12).map((h) => (h.textContent || "").trim().slice(0, 80)),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  heads.sort((a, b) => elementTopRelativeToBody(a, body) - elementTopRelativeToBody(b, body));
  for (const el of heads) {
    const yPx = elementTopRelativeToBody(el, body);
    const yMm = (yPx / scrollH) * imgH_mm;
    const posMm = yMm - Math.floor(yMm / usableH_mm) * usableH_mm;
    const posPxInSlice = yPx % slicePxCss;
    const fracPx = posPxInSlice / slicePxCss;
    const wouldNudgeMm = posMm > thresholdMm + 0.5;
    const wouldNudgePx = fracPx > clearBelowFraction + 0.002;
    // #region agent log
    fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
      body: JSON.stringify({
        sessionId: "360061",
        runId: "pre-fix",
        hypothesisId: "A",
        location: "html-document-to-pdf-blob.ts:nudgeSeHealthHeadingsClearOfPageEnd:heading",
        message: "heading slice math",
        data: {
          tag: el.tagName,
          text: (el.textContent || "").trim().slice(0, 100),
          yPx,
          yMm: Math.round(yMm * 100) / 100,
          posMm: Math.round(posMm * 100) / 100,
          posPxInSlice: Math.round(posPxInSlice * 100) / 100,
          fracPx: Math.round(fracPx * 1000) / 1000,
          wouldNudgeMm,
          wouldNudgePx,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (posMm > thresholdMm + 0.5) {
      const deltaMm = usableH_mm - posMm + 6;
      const deltaPx = (deltaMm / imgH_mm) * scrollH;
      const cur = parseFloat(idoc.defaultView?.getComputedStyle(el).marginTop || "0") || 0;
      el.style.marginTop = `${cur + deltaPx}px`;
    }
    void body.offsetHeight;
  }
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
  const marginTopMm = 11;
  /* ~2 lines of body text — match Central Executive Summary reference */
  const heightMm = 4.5;
  const widthMm = Math.min(heightMm * (dims.w / dims.h), 38);
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
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

  if (seHealthTilePlan && seHealthTilePlan.length > 0) {
    for (let i = 0; i < seHealthTilePlan.length; i++) {
      if (i > 0) pdf.addPage();
      const { consumedStartMm, topPadMm } = seHealthTilePlan[i];
      pdf.addImage(dataUrl, "JPEG", marginMm, marginMm + topPadMm - consumedStartMm, imgW, imgH);
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

  if (isSeHealthPdf) {
    const usableW_mm = 210 - 2 * pageMarginMm;
    const imgH_mm_est = (scrollH * usableW_mm) / IFRAME_WIDTH_PX;
    nudgeSeHealthHeadingsClearOfPageEnd(
      idoc,
      scrollH,
      imgH_mm_est,
      SE_HEALTH_HEADING_CLEAR_PAGE_FRACTION,
    );
    void body.offsetHeight;
    scrollH = Math.min(
      Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight, 400),
      32000,
    );
    iframe.style.height = `${Math.min(scrollH + 32, 32000)}px`;
    void body.offsetHeight;
  }

  const tableSlices = isSeHealthPdf ? collectSeHealthBodyTableSlices(body) : [];

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
