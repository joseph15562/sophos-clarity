/**
 * Client-side: render a full HTML document string (e.g. from buildPdfHtml) into a PDF Blob
 * using jsPDF + html2canvas. Intended for one-click downloads (no print dialog).
 */

import { jsPDF } from "jspdf";

const IFRAME_WIDTH_PX = 1024;

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
    left: "0",
    top: "0",
    width: `${IFRAME_WIDTH_PX}px`,
    /* Tall enough for full report layout (html2canvas reads content size) */
    height: "12000px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-1",
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

  // Layout + remote fonts (@import in buildPdfHtml) — best-effort wait
  await new Promise((r) => setTimeout(r, 600));
  try {
    await idoc.fonts?.ready;
  } catch {
    /* ignore */
  }

  const body = idoc.body;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  try {
    await pdf.html(body, {
      x: 10,
      y: 10,
      width: 190,
      windowWidth: IFRAME_WIDTH_PX,
      autoPaging: "text",
      html2canvas: {
        scale: 0.42,
        useCORS: true,
        logging: false,
        letterRendering: true,
      },
    });
  } finally {
    document.body.removeChild(iframe);
  }

  return pdf.output("blob");
}
