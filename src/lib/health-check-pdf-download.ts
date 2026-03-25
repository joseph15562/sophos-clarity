/**
 * PDF download for SE Health Check — loaded via dynamic import() only when the user
 * clicks “Download PDF”, so /health-check does not pull pdfmake on first paint.
 */

import type { BrandingData } from "@/components/BrandingSetup";
import { buildSeHealthCheckBrowserHtmlDocument } from "@/lib/se-health-check-browser-html";
import { buildSeHealthCheckPdfBlob } from "@/lib/se-health-check-pdfmake";
import type { SEHealthCheckReportParams } from "@/lib/se-health-check-report-html";
import { sanitizePdfFilenamePart } from "@/lib/pdf-utils";
import { saveAs } from "file-saver";
import JSZip from "jszip";

export type { SEHealthCheckReportParams };

export async function runHealthCheckPdfDownload(args: {
  reportParams: SEHealthCheckReportParams;
  branding: BrandingData;
  filenameCustomerPart: string;
}): Promise<string> {
  const { reportParams, filenameCustomerPart } = args;
  const blob = await buildSeHealthCheckPdfBlob(reportParams);
  const part = sanitizePdfFilenamePart(filenameCustomerPart);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Sophos-Firewall-Health-Check-${part}-${date}.pdf`;
  saveAs(blob, filename);
  return filename;
}

/** Dark-themed standalone HTML (licence + best-practice dashboard + full report body), not the PDF print wrapper. */
export async function runHealthCheckHtmlDownload(args: {
  reportParams: SEHealthCheckReportParams;
  branding: BrandingData;
  filenameCustomerPart: string;
}): Promise<string> {
  const html = buildSeHealthCheckBrowserHtmlDocument(args.reportParams);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const part = sanitizePdfFilenamePart(args.filenameCustomerPart);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Sophos-Firewall-Health-Check-${part}-${date}.html`;
  saveAs(blob, filename);
  return filename;
}

/** Bundle PDF + HTML into a single zip and trigger download. */
export async function runHealthCheckZipDownload(args: {
  reportParams: SEHealthCheckReportParams;
  branding: BrandingData;
  filenameCustomerPart: string;
}): Promise<string> {
  const { reportParams, filenameCustomerPart } = args;
  const part = sanitizePdfFilenamePart(filenameCustomerPart);
  const date = new Date().toISOString().slice(0, 10);
  const baseName = `Sophos-Firewall-Health-Check-${part}-${date}`;

  const [pdfBlob, html] = await Promise.all([
    buildSeHealthCheckPdfBlob(reportParams),
    Promise.resolve(buildSeHealthCheckBrowserHtmlDocument(reportParams)),
  ]);

  const zip = new JSZip();
  zip.file(`${baseName}.pdf`, pdfBlob);
  zip.file(`${baseName}.html`, html);
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const filename = `${baseName}.zip`;
  saveAs(zipBlob, filename);
  return filename;
}
