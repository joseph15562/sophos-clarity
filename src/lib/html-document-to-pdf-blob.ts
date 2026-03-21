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
.print-content strong,
#cover-title {
  color: #001A47 !important;
}
.print-content h2 {
  border-bottom-color: #2006F7 !important;
}
.print-content p,
.print-content li,
.print-content td,
.se-hc-cover,
.se-hc-cover td,
.se-hc-cover p,
.se-hc-cover table {
  color: #334155 !important;
}
.se-hc-cover h1 {
  color: #001A47 !important;
}
.se-hc-cover {
  border-bottom-color: #2006F7 !important;
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

function injectHtml2CanvasFixStyles(doc: Document) {
  const style = doc.createElement("style");
  style.setAttribute("data-pdf-html2canvas-fix", "true");
  style.textContent = PDF_HTML2CANVAS_FIX_CSS;
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

  injectHtml2CanvasFixStyles(idoc);
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
    addCanvasToPdf(pdf, canvas, 10);
    return pdf.output("blob");
  } finally {
    document.body.removeChild(iframe);
  }
}
