import { useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import { BrandingData } from "./BrandingSetup";
import { Loader2, Download, FileText, RefreshCw, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { marked } from "marked";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import JSZip from "jszip";

export type ReportEntry = {
  id: string;
  label: string;
  markdown: string;
};

type Props = {
  reports: ReportEntry[];
  activeReportId: string;
  onActiveChange: (id: string) => void;
  isLoading: boolean;
  loadingReportIds: Set<string>;
  failedReportIds: Set<string>;
  onRetry: (reportId: string) => void;
  branding: BrandingData;
};

function isTableRow(line: string): boolean {
  return /^\|(.+\|)+\s*$/.test(line.trim());
}

function isSeparatorRow(line: string): boolean {
  return /^\|(\s*:?-+:?\s*\|)+\s*$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
}

function buildDocxTable(tableLines: string[]): Table {
  const dataRows = tableLines.filter(l => !isSeparatorRow(l));
  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  };

  const rows = dataRows.map((line, rowIdx) => {
    const cells = parseTableRow(line);
    return new TableRow({
      children: cells.map(cell =>
        new TableCell({
          borders: cellBorders,
          children: [new Paragraph({
            children: [new TextRun({
              text: cell,
              bold: rowIdx === 0,
              size: rowIdx === 0 ? 22 : 20,
            })],
          })],
        })
      ),
    });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function markdownToDocxElements(md: string): (Paragraph | Table)[] {
  const lines = md.split("\n");
  const elements: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isTableRow(lines[i].trim()) || isSeparatorRow(lines[i].trim()))) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        elements.push(buildDocxTable(tableLines));
        elements.push(new Paragraph({ text: "" }));
      }
      continue;
    }

    if (!trimmed) {
      elements.push(new Paragraph({ text: "" }));
      i++;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      elements.push(new Paragraph({
        heading: headingMap[level] || HeadingLevel.HEADING_6,
        children: parseInlineFormatting(headingMatch[2]),
      }));
      i++;
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      elements.push(new Paragraph({
        bullet: { level: 0 },
        children: parseInlineFormatting(bulletMatch[1]),
      }));
      i++;
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)/);
    if (numberedMatch) {
      elements.push(new Paragraph({
        numbering: { reference: "default-numbering", level: 0 },
        children: parseInlineFormatting(numberedMatch[1]),
      }));
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(new Paragraph({
        border: { bottom: { color: "999999", space: 1, style: "single" as any, size: 6 } },
        children: [new TextRun("")],
      }));
      i++;
      continue;
    }

    elements.push(new Paragraph({ children: parseInlineFormatting(trimmed) }));
    i++;
  }

  return elements;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true, italics: true }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], bold: true }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5], font: "Courier New", size: 20 }));
    } else if (match[6]) {
      runs.push(new TextRun({ text: match[6] }));
    }
  }
  return runs.length > 0 ? runs : [new TextRun(text)];
}

/** Build a standalone HTML document string for PDF generation */
function buildPdfHtml(innerHTML: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1a1a2e;
      padding: 12mm;
    }
    h1 { font-size: 20px; font-weight: 700; margin: 16px 0 8px; }
    h2 { font-size: 16px; font-weight: 700; margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #ddd; }
    h3 { font-size: 13px; font-weight: 600; margin: 10px 0 4px; }
    h4, h5, h6 { font-size: 12px; font-weight: 600; margin: 8px 0 4px; }
    p { margin: 0 0 6px; }
    ul, ol { margin: 0 0 6px; padding-left: 20px; }
    li { margin: 2px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 10px;
      table-layout: fixed;
      page-break-inside: auto;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th {
      background: #f0f0f5;
      font-weight: 600;
      text-align: left;
      padding: 4px 6px;
      border: 1px solid #ccc;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    td {
      padding: 3px 6px;
      border: 1px solid #ccc;
      word-wrap: break-word;
      overflow-wrap: break-word;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #fafafa; }
    code {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      background: #f5f5f5;
      padding: 1px 3px;
      border-radius: 2px;
    }
    pre {
      background: #f5f5f5;
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 6px 0;
      font-size: 10px;
    }
    hr { border: none; border-top: 1px solid #ddd; margin: 12px 0; }
    @media print {
      body { padding: 0; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>${innerHTML}</body>
</html>`;
}

/** Generate a PDF blob from HTML content */
async function generatePdfBlob(innerHTML: string, title: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.width = "210mm";
    iframe.style.height = "297mm";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      reject(new Error("Could not create iframe"));
      return;
    }

    doc.open();
    doc.write(buildPdfHtml(innerHTML, title));
    doc.close();

    // Wait for content to render then print
    setTimeout(() => {
      try {
        // Use the iframe's print for individual downloads
        // For blob generation, we'll use a different approach
        const htmlContent = doc.documentElement.outerHTML;
        const blob = new Blob([htmlContent], { type: "text/html" });
        document.body.removeChild(iframe);
        resolve(blob);
      } catch (err) {
        document.body.removeChild(iframe);
        reject(err);
      }
    }, 200);
  });
}

/** Generate Word blob from markdown */
async function generateWordBlob(markdown: string, branding: BrandingData): Promise<Blob> {
  const headerParagraphs: Paragraph[] = [];
  if (branding.companyName) {
    headerParagraphs.push(new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: branding.companyName, bold: true, size: 36 })],
    }));
    headerParagraphs.push(new Paragraph({
      children: [new TextRun({ text: "Firewall Configuration Report", color: "666666", size: 24 })],
    }));
    headerParagraphs.push(new Paragraph({ text: "" }));
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: "default-numbering",
        levels: [{ level: 0, format: "decimal" as any, text: "%1.", alignment: AlignmentType.START }],
      }],
    },
    sections: [{
      children: [...headerParagraphs, ...markdownToDocxElements(markdown)],
    }],
  });

  return Packer.toBlob(doc);
}

function ReportContent({ markdown, isLoading, isFailed, onRetry, branding, pdfFilename }: {
  markdown: string;
  isLoading: boolean;
  isFailed: boolean;
  onRetry: () => void;
  branding: BrandingData;
  pdfFilename: string;
}) {
  const docRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    if (!markdown) return "";
    const rawHtml = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [markdown]);

  const handlePdf = async () => {
    const el = docRef.current;
    if (!el) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const title = pdfFilename.replace(/\.pdf$/i, "");
    printWindow.document.write(buildPdfHtml(el.innerHTML, title));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleWord = async () => {
    if (!markdown) return;
    const blob = await generateWordBlob(markdown, branding);
    const wordFilename = pdfFilename.replace(/\.pdf$/, ".docx");
    saveAs(blob, wordFilename);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2 no-print">
        {isFailed && (
          <Button variant="destructive" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        )}
        {markdown && !isLoading && !isFailed && (
          <>
            <Button variant="secondary" onClick={handleWord} className="gap-2">
              <FileText className="h-4 w-4" /> Download Word
            </Button>
            <Button onClick={handlePdf} className="gap-2">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </>
        )}
      </div>

      <div ref={docRef} className="bg-card rounded-xl border border-border shadow-sm p-8 md:p-12 doc-section">
        {(branding.companyName || branding.logoUrl) && (
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
            {branding.logoUrl && (
              <img src={branding.logoUrl} alt="Company logo" className="h-14 w-auto max-w-[200px] object-contain" />
            )}
            {branding.companyName && (
              <div>
                <p className="text-lg font-bold text-foreground">{branding.companyName}</p>
                <p className="text-sm text-muted-foreground">Firewall Configuration Report</p>
              </div>
            )}
          </div>
        )}

        {isLoading && !markdown && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-lg font-medium">Analysing configuration...</p>
            <p className="text-sm">This may take a minute for large configs</p>
          </div>
        )}

        {isFailed && !markdown && (
          <div className="flex flex-col items-center justify-center py-16 text-destructive">
            <p className="text-lg font-medium mb-2">Generation failed</p>
            <p className="text-sm text-muted-foreground mb-4">The AI service may be overloaded. Click retry to try again.</p>
            <Button variant="destructive" onClick={onRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Retry Generation
            </Button>
          </div>
        )}

        {html && <div dangerouslySetInnerHTML={{ __html: html }} />}

        {isLoading && markdown && (
          <div className="flex items-center gap-2 text-muted-foreground mt-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Still generating...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentPreview({ reports, activeReportId, onActiveChange, isLoading, loadingReportIds, failedReportIds, onRetry, branding }: Props) {
  if (reports.length === 0 && !isLoading) return null;

  const allDone = reports.length > 0 && !isLoading && reports.every(r => r.markdown && !failedReportIds.has(r.id));

  const handleDownloadAll = async () => {
    if (!allDone) return;
    const zip = new JSZip();

    for (const report of reports) {
      const baseName = report.label.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase();

      // Word
      const wordBlob = await generateWordBlob(report.markdown, branding);
      zip.file(`${baseName}-report.docx`, wordBlob);

      // PDF (as styled HTML)
      const rawHtml = marked.parse(report.markdown, { async: false }) as string;
      const sanitized = DOMPurify.sanitize(rawHtml);
      const pdfHtml = buildPdfHtml(sanitized, baseName);
      zip.file(`${baseName}-report.html`, pdfHtml);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const zipName = branding.companyName
      ? `${branding.companyName.replace(/\s+/g, "-").toLowerCase()}-firewall-reports.zip`
      : "firewall-reports.zip";
    saveAs(zipBlob, zipName);
  };

  if (reports.length === 1 && !isLoading) {
    const r = reports[0];
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground no-print">Document Preview</h2>
        <ReportContent
          markdown={r.markdown}
          isLoading={loadingReportIds.has(r.id)}
          isFailed={failedReportIds.has(r.id)}
          onRetry={() => onRetry(r.id)}
          branding={branding}
          pdfFilename={`${r.label.replace(/\s+/g, "-").toLowerCase()}-report.pdf`}
        />
      </div>
    );
  }

  if (reports.length === 0 && isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground no-print">Document Preview</h2>
        <ReportContent markdown="" isLoading={true} isFailed={false} onRetry={() => {}} branding={branding} pdfFilename="report.pdf" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <h2 className="text-xl font-bold text-foreground">Document Preview</h2>
        {allDone && reports.length > 1 && (
          <Button onClick={handleDownloadAll} className="gap-2">
            <Archive className="h-4 w-4" /> Download All (.zip)
          </Button>
        )}
      </div>
      <Tabs value={activeReportId} onValueChange={onActiveChange} className="no-print-tabs">
        <TabsList className="no-print flex-wrap h-auto gap-1">
          {reports.map((r) => (
            <TabsTrigger key={r.id} value={r.id} className="text-xs">
              {r.label}
              {loadingReportIds.has(r.id) && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
              {failedReportIds.has(r.id) && <span className="ml-1 text-destructive">⚠</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        {reports.map((r) => (
          <TabsContent key={r.id} value={r.id}>
            <ReportContent
              markdown={r.markdown}
              isLoading={loadingReportIds.has(r.id)}
              isFailed={failedReportIds.has(r.id)}
              onRetry={() => onRetry(r.id)}
              branding={branding}
              pdfFilename={`${r.label.replace(/\s+/g, "-").toLowerCase()}-report.pdf`}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
