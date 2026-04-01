/**
 * Minimal pdfmake-based PDF for the executive one-pager (Assess / DocumentPreview).
 * Used when VITE_E2E_PDF_DOWNLOAD=1 so CI can assert a real .pdf download instead of print().
 * Default user-facing path remains browser print (no extra pdfmake chunk until this import runs).
 */

import type { TDocumentDefinitions } from "pdfmake/interfaces";

/** Strip common markdown to plain text for a readable PDF body. */
function markdownToPlain(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .slice(0, 24_000);
}

export async function generateExecutiveReportPdfBlob(
  markdown: string,
  title: string,
): Promise<Blob> {
  const [{ default: pdfMake }, pdfVfsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfVfs = pdfVfsMod.default as Record<string, string>;
  const pm = pdfMake as typeof pdfMake & { vfs: Record<string, string> };
  pm.vfs = pdfVfs;

  const plain = markdownToPlain(markdown);
  const docDef: TDocumentDefinitions = {
    info: { title },
    content: [
      { text: title, style: "h" },
      { text: plain.trim() || "(Empty report)", style: "b" },
    ],
    styles: {
      h: {
        fontSize: 16,
        bold: true,
        margin: [0, 0, 0, 12] as [number, number, number, number],
      },
      b: { fontSize: 9, lineHeight: 1.25 },
    },
    defaultStyle: { font: "Roboto" },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdf = pdfMake.createPdf(docDef) as {
        getBlob: (cb: (blob: Blob) => void) => void;
      };
      pdf.getBlob((blob: Blob) => resolve(blob));
    } catch (e) {
      reject(e);
    }
  });
}
