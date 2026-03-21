/**
 * PDF download for SE Health Check — loaded via dynamic import() only when the user
 * clicks “Download PDF”, so /health-check does not pull jspdf/html2canvas on first paint.
 */

import type { BrandingData } from "@/components/BrandingSetup";
import { buildPdfHtml } from "@/lib/report-export";
import { SE_HEALTH_CHECK_PDF_PROFILE } from "@/lib/se-health-check-pdf-layout";
import { htmlDocumentStringToPdfBlob, sanitizePdfFilenamePart } from "@/lib/html-document-to-pdf-blob";
import {
  buildSEHealthCheckReportHtml,
  SE_HEALTH_CHECK_PDF_TOC_AFTER_MARKER,
  type SEHealthCheckReportParams,
} from "@/lib/se-health-check-report-html";
import { saveAs } from "file-saver";

export type { SEHealthCheckReportParams };

export async function runHealthCheckPdfDownload(args: {
  reportParams: SEHealthCheckReportParams;
  branding: BrandingData;
  filenameCustomerPart: string;
}): Promise<void> {
  const inner = buildSEHealthCheckReportHtml(args.reportParams);
  const html = buildPdfHtml(inner, "Sophos Firewall Health Check", args.branding, {
    theme: "light",
    omitInteractiveChrome: true,
    tocAfterMarker: SE_HEALTH_CHECK_PDF_TOC_AFTER_MARKER,
    omitReportHeader: true,
    omitReportFooter: true,
    pdfLayoutProfile: SE_HEALTH_CHECK_PDF_PROFILE,
  });
  const blob = await htmlDocumentStringToPdfBlob(html);
  const part = sanitizePdfFilenamePart(args.filenameCustomerPart);
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `Sophos-Firewall-Health-Check-${part}-${date}.pdf`);
}
