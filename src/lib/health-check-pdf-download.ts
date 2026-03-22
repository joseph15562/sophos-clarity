/**
 * PDF download for SE Health Check — loaded via dynamic import() only when the user
 * clicks “Download PDF”, so /health-check does not pull pdfmake on first paint.
 */

import type { BrandingData } from "@/components/BrandingSetup";
import { buildSeHealthCheckBrowserHtmlDocument } from "@/lib/se-health-check-browser-html";
import { buildSeHealthCheckPdfBlob } from "@/lib/se-health-check-pdfmake";
import type { SEHealthCheckReportParams } from "@/lib/se-health-check-report-html";
import { sanitizePdfFilenamePart } from "@/lib/html-document-to-pdf-blob";
import { saveAs } from "file-saver";

export type { SEHealthCheckReportParams };

export async function runHealthCheckPdfDownload(args: {
  reportParams: SEHealthCheckReportParams;
  branding: BrandingData;
  filenameCustomerPart: string;
}): Promise<void> {
  const { reportParams, filenameCustomerPart } = args;
  const blob = await buildSeHealthCheckPdfBlob(reportParams);
  const part = sanitizePdfFilenamePart(filenameCustomerPart);
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `Sophos-Firewall-Health-Check-${part}-${date}.pdf`);
}

/** Dark-themed standalone HTML (licence + best-practice dashboard + full report body), not the PDF print wrapper. */
export async function runHealthCheckHtmlDownload(args: {
  reportParams: SEHealthCheckReportParams;
  branding: BrandingData;
  filenameCustomerPart: string;
}): Promise<void> {
  const html = buildSeHealthCheckBrowserHtmlDocument(args.reportParams);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const part = sanitizePdfFilenamePart(args.filenameCustomerPart);
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `Sophos-Firewall-Health-Check-${part}-${date}.html`);
}
