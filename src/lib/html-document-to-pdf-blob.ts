/**
 * Client-side: render a full HTML document string (e.g. from buildPdfHtml) into a PDF Blob
 * using jsPDF + html2canvas. Intended for one-click downloads (no print dialog).
 *
 * html2canvas does not reliably resolve CSS custom properties (`var(--text)`, etc.) from
 * :root — colors/backgrounds can become invalid and the raster looks like a solid header bar.
 * We inject literal hex overrides before capture and avoid `opacity:0` on the iframe (which
 * can also break painting in some browsers).
 */

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
 * @param fullHtml - Complete HTML document (`<!DOCTYPE html>...`) from buildPdfHtml or similar
 */
export async function htmlDocumentStringToPdfBlob(fullHtml: string): Promise<Blob> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "pdf-generation");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${IFRAME_WIDTH_PX}px`,
    /* Tall enough for full report layout (html2canvas reads content size) */
    height: "14000px",
    border: "0",
    opacity: "1",
    pointerEvents: "none",
    zIndex: "-1",
    /* visible so iframe document can lay out full scrollHeight (hidden clips capture) */
    overflow: "visible",
    visibility: "visible",
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

  // Layout + remote fonts (@import in buildPdfHtml) — best-effort wait
  await new Promise((r) => setTimeout(r, 600));
  try {
    await idoc.fonts?.ready;
  } catch {
    /* ignore */
  }

  injectHtml2CanvasFixStyles(idoc);
  idoc.documentElement.setAttribute("data-theme", "light");

  /* Strip anything that still confuses html2canvas (fixed “Dark Mode” button, scripts) */
  idoc.querySelectorAll("script").forEach((s) => s.remove());
  idoc.querySelectorAll(".theme-toggle, #themeBtn").forEach((el) => el.remove());

  // Force layout after DOM/CSS changes
  void idoc.body.offsetHeight;

  const scrollH = Math.min(
    Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight, 400),
    50000,
  );
  iframe.style.height = `${scrollH}px`;

  const body = idoc.body;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  try {
    await pdf.html(body, {
      x: 10,
      y: 10,
      width: 190,
      windowWidth: IFRAME_WIDTH_PX,
      /* slice tends to raster the full subtree more reliably than text for long reports */
      autoPaging: "slice",
      html2canvas: {
        scale: 0.48,
        useCORS: true,
        logging: false,
        letterRendering: true,
        backgroundColor: "#ffffff",
        windowWidth: IFRAME_WIDTH_PX,
        windowHeight: scrollH,
        width: IFRAME_WIDTH_PX,
        height: scrollH,
        scrollX: 0,
        scrollY: 0,
        removeContainer: true,
        ignoreElements: (node: Element) =>
          (node as HTMLElement).classList?.contains?.("theme-toggle") ?? false,
      },
    });
  } finally {
    document.body.removeChild(iframe);
  }

  return pdf.output("blob");
}
