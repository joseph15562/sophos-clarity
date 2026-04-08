/**
 * @deprecated Import {@link generateMarkdownReportPdfBlob} from `@/lib/assessment-report-pdfmake`
 * instead. Kept as a thin wrapper for older call sites / docs.
 */
export async function generateExecutiveReportPdfBlob(
  markdown: string,
  title: string,
): Promise<Blob> {
  const { generateMarkdownReportPdfBlob } = await import("@/lib/assessment-report-pdfmake");
  return generateMarkdownReportPdfBlob(markdown, { title, coverLines: [] });
}
