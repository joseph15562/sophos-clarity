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

const IFRAME_WIDTH_PX = 1024;

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
  min-height: 1123px !important;
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
  flex: 1 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 24px 0 32px !important;
  min-height: 200px !important;
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
  page-break-after: always !important;
  break-after: page !important;
  padding: 0 !important;
  margin: 0 !important;
}
.se-hc-overview-header-navy {
  background: #001A47 !important;
  padding: 32px 48px 40px !important;
  min-height: 300px !important;
  box-sizing: border-box !important;
}
.se-hc-overview-header-logo {
  display: block !important;
  height: 20px !important;
  width: auto !important;
  max-width: 180px !important;
}
.print-content h2.se-hc-overview-title {
  margin: 36px 0 0 !important;
  padding: 0 !important;
  border: none !important;
  border-bottom: none !important;
  font-size: 22pt !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
  color: #00f2b3 !important;
  font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif !important;
  text-align: left !important;
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

/**
 * Tile one tall image across A4 portrait pages (mm units).
 */
function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, marginMm: number): void {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const usableW = pageW - 2 * marginMm;
  const usableH = pageH - 2 * marginMm;

  const imgW = usableW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);

  let consumed = 0;
  let first = true;
  while (consumed < imgH - 0.01) {
    if (!first) pdf.addPage();
    first = false;
    pdf.addImage(dataUrl, "JPEG", marginMm, marginMm - consumed, imgW, imgH);
    consumed += usableH;
  }
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

  const scrollH = Math.min(
    Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight, 400),
    32000,
  );
  iframe.style.height = `${Math.min(scrollH + 32, 32000)}px`;

  void idoc.body.offsetHeight;

  const body = idoc.body;
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
    addCanvasToPdf(pdf, canvas, pageMarginMm);
    return pdf.output("blob");
  } finally {
    document.body.removeChild(iframe);
  }
}
