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
import PptxGenJS from "pptxgenjs";

export type ReportEntry = {
  id: string;
  label: string;
  markdown: string;
  /** Shown in the failed state so you can see why generation failed */
  errorMessage?: string;
  /** Shown under the spinner during loading for diagnosis */
  loadingStatus?: string;
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

/** Generate a PowerPoint presentation from markdown report */
async function generatePptxBlob(markdown: string, reportLabel: string, branding: BrandingData): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = branding.companyName || "Firewall Report";
  pptx.title = `${reportLabel} - Firewall Report`;

  const PRIMARY = "1a1a2e";
  const ACCENT = "6366f1";
  const GRAY = "64748b";
  const LIGHT_BG = "f1f5f9";

  // --- Title slide ---
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: PRIMARY };
  if (branding.companyName) {
    titleSlide.addText(branding.companyName, {
      x: 0.8, y: 1.2, w: 11, h: 1,
      fontSize: 36, bold: true, color: "FFFFFF",
      fontFace: "Segoe UI",
    });
  }
  titleSlide.addText(reportLabel, {
    x: 0.8, y: 2.4, w: 11, h: 0.8,
    fontSize: 24, color: "c7d2fe",
    fontFace: "Segoe UI",
  });
  titleSlide.addText("Firewall Configuration Report", {
    x: 0.8, y: 3.4, w: 11, h: 0.6,
    fontSize: 16, color: "94a3b8",
    fontFace: "Segoe UI",
  });
  titleSlide.addText(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), {
    x: 0.8, y: 4.4, w: 11, h: 0.5,
    fontSize: 12, color: "94a3b8",
    fontFace: "Segoe UI",
  });

  // Parse markdown into sections
  const lines = markdown.split("\n");
  let currentH2 = "";
  let currentBullets: string[] = [];
  const sections: { title: string; bullets: string[]; tables: { headers: string[]; rows: string[][] }[] }[] = [];
  let currentTables: { headers: string[]; rows: string[][] }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const h2Match = line.match(/^##\s+(.*)/);
    const h3Match = line.match(/^###\s+(.*)/);

    if (h2Match || h3Match) {
      if (currentH2 && (currentBullets.length > 0 || currentTables.length > 0)) {
        sections.push({ title: currentH2, bullets: [...currentBullets], tables: [...currentTables] });
      }
      currentH2 = (h2Match || h3Match)![1];
      currentBullets = [];
      currentTables = [];
      continue;
    }

    // Collect table
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isTableRow(lines[i].trim()) || isSeparatorRow(lines[i].trim()))) {
        tableLines.push(lines[i].trim());
        i++;
      }
      i--; // step back
      const dataLines = tableLines.filter(l => !isSeparatorRow(l));
      if (dataLines.length >= 2) {
        const headers = parseTableRow(dataLines[0]);
        const rows = dataLines.slice(1).map(l => parseTableRow(l));
        currentTables.push({ headers, rows });
      }
      continue;
    }

    // Collect bullet points and key text
    const bulletMatch = line.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      currentBullets.push(bulletMatch[1].replace(/\*\*/g, ""));
      continue;
    }

    // Collect numbered items
    const numMatch = line.match(/^\d+\.\s+(.*)/);
    if (numMatch) {
      currentBullets.push(numMatch[1].replace(/\*\*/g, ""));
      continue;
    }

    // Collect bold key-value lines as bullets
    if (line.startsWith("**") && line.includes(":")) {
      currentBullets.push(line.replace(/\*\*/g, ""));
    }
  }
  // Push last section
  if (currentH2 && (currentBullets.length > 0 || currentTables.length > 0)) {
    sections.push({ title: currentH2, bullets: [...currentBullets], tables: [...currentTables] });
  }

  // --- Generate slides for each section ---
  for (const section of sections) {
    // Section title slide
    const sectionSlide = pptx.addSlide();
    sectionSlide.addText(section.title, {
      x: 0.8, y: 0.3, w: 11, h: 0.7,
      fontSize: 22, bold: true, color: PRIMARY,
      fontFace: "Segoe UI",
    });
    sectionSlide.addShape(pptx.ShapeType.rect, {
      x: 0.8, y: 0.95, w: 2.5, h: 0.04,
      fill: { color: ACCENT },
    });

    // Bullets (paginate if >8)
    if (section.bullets.length > 0) {
      const chunks = chunkArray(section.bullets, 8);
      const isFirst = true;
      let slideRef = sectionSlide;

      for (let ci = 0; ci < chunks.length; ci++) {
        if (ci > 0) {
          slideRef = pptx.addSlide();
          slideRef.addText(`${section.title} (cont.)`, {
            x: 0.8, y: 0.3, w: 11, h: 0.7,
            fontSize: 18, bold: true, color: PRIMARY,
            fontFace: "Segoe UI",
          });
        }
        const yStart = ci === 0 && isFirst ? 1.2 : 1.0;
        const bulletTexts = chunks[ci].map(b => ({
          text: b,
          options: { fontSize: 13, color: "334155", bullet: { code: "2022" }, fontFace: "Segoe UI", breakLine: true as const },
        }));
        slideRef.addText(bulletTexts as any, {
          x: 0.8, y: yStart, w: 11, h: 5.5 - yStart,
          valign: "top",
          lineSpacingMultiple: 1.3,
        });
      }
    }

    // Tables (one slide per table, paginate rows if needed)
    for (const table of section.tables) {
      const maxRowsPerSlide = 12;
      const rowChunks = chunkArray(table.rows, maxRowsPerSlide);

      for (let ci = 0; ci < rowChunks.length; ci++) {
        const tSlide = pptx.addSlide();
        const suffix = rowChunks.length > 1 ? ` (${ci + 1}/${rowChunks.length})` : "";
        tSlide.addText(`${section.title}${suffix}`, {
          x: 0.8, y: 0.2, w: 11, h: 0.6,
          fontSize: 18, bold: true, color: PRIMARY,
          fontFace: "Segoe UI",
        });

        const colW = 11.8 / table.headers.length;
        const headerRow: PptxGenJS.TableRow = table.headers.map(h => ({
          text: h,
          options: { bold: true, fontSize: 10, color: "FFFFFF", fill: { color: ACCENT }, fontFace: "Segoe UI", align: "left" as const, valign: "middle" as const },
        }));
        const dataRows: PptxGenJS.TableRow[] = rowChunks[ci].map((row, ri) => 
          row.map(cell => ({
            text: cell,
            options: { fontSize: 9, color: "334155", fill: { color: ri % 2 === 0 ? "FFFFFF" : LIGHT_BG }, fontFace: "Segoe UI", valign: "top" as const },
          }))
        );

        tSlide.addTable([headerRow, ...dataRows], {
          x: 0.3, y: 0.9, w: 12.4,
          colW: Array(table.headers.length).fill(colW),
          border: { pt: 0.5, color: "cbd5e1" },
          autoPage: false,
          margin: [3, 5, 3, 5],
        });
      }
    }
  }

  // --- Summary / closing slide ---
  const endSlide = pptx.addSlide();
  endSlide.background = { color: PRIMARY };
  endSlide.addText("Thank You", {
    x: 0.8, y: 2.0, w: 11, h: 1,
    fontSize: 36, bold: true, color: "FFFFFF",
    fontFace: "Segoe UI", align: "center",
  });
  if (branding.companyName) {
    endSlide.addText(`Prepared by ${branding.companyName}`, {
      x: 0.8, y: 3.2, w: 11, h: 0.6,
      fontSize: 16, color: "94a3b8",
      fontFace: "Segoe UI", align: "center",
    });
  }

  return (await pptx.write({ outputType: "blob" })) as Blob;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function ReportContent({ markdown, isLoading, isFailed, onRetry, branding, pdfFilename, errorMessage, loadingStatus }: {
  markdown: string;
  isLoading: boolean;
  isFailed: boolean;
  onRetry: () => void;
  branding: BrandingData;
  pdfFilename: string;
  errorMessage?: string;
  loadingStatus?: string;
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
            {loadingStatus && <p className="text-sm mt-1 font-medium text-foreground">{loadingStatus}</p>}
            <p className="text-sm mt-1">This may take a minute for large configs</p>
          </div>
        )}

        {isFailed && !markdown && (
          <div className="flex flex-col items-center justify-center py-16 text-destructive">
            <p className="text-lg font-medium mb-2">Generation failed</p>
            {errorMessage && (
              <p className="text-sm text-left max-w-xl mb-4 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 break-words">
                {errorMessage}
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-4">Click retry to try again, or wait a minute if the API hit its rate limit.</p>
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
    const reportsFolder = zip.folder("reports")!;
    const presentationsFolder = zip.folder("presentations")!;

    for (const report of reports) {
      const baseName = report.label.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase();

      // Word
      const wordBlob = await generateWordBlob(report.markdown, branding);
      reportsFolder.file(`${baseName}-report.docx`, wordBlob);

      // PDF (as styled HTML)
      const rawHtml = marked.parse(report.markdown, { async: false }) as string;
      const sanitized = DOMPurify.sanitize(rawHtml);
      const pdfHtml = buildPdfHtml(sanitized, baseName);
      reportsFolder.file(`${baseName}-report.html`, pdfHtml);

      // PowerPoint presentation
      const pptxBlob = await generatePptxBlob(report.markdown, report.label, branding);
      presentationsFolder.file(`${baseName}-presentation.pptx`, pptxBlob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const zipName = branding.companyName
      ? `${branding.companyName.replace(/\s+/g, "-").toLowerCase()}-firewall-reports.zip`
      : "firewall-reports.zip";
    saveAs(zipBlob, zipName);
  };

  if (reports.length === 1 && !isLoading) {
    const r = reports[0];
    const oneReportDone = r.markdown && !failedReportIds.has(r.id);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print">
          <h2 className="text-xl font-bold text-foreground">Document Preview</h2>
          {oneReportDone && (
            <div className="flex flex-col items-end gap-1">
              <Button onClick={handleDownloadAll} className="gap-2">
                <Archive className="h-4 w-4" /> Download All (.zip)
              </Button>
              <p className="text-xs text-muted-foreground">Powerpoint presentations, HTML reports and Docx reports</p>
            </div>
          )}
        </div>
        <ReportContent
          markdown={r.markdown}
          isLoading={loadingReportIds.has(r.id)}
          isFailed={failedReportIds.has(r.id)}
          onRetry={() => onRetry(r.id)}
          branding={branding}
          pdfFilename={`${r.label.replace(/\s+/g, "-").toLowerCase()}-report.pdf`}
          errorMessage={r.errorMessage}
          loadingStatus={r.loadingStatus}
        />
      </div>
    );
  }

  if (reports.length === 0 && isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground no-print">Document Preview</h2>
        <ReportContent markdown="" isLoading={true} isFailed={false} onRetry={() => {}} branding={branding} pdfFilename="report.pdf" loadingStatus="Starting…" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <h2 className="text-xl font-bold text-foreground">Document Preview</h2>
        {allDone && (
          <div className="flex flex-col items-end gap-1">
            <Button onClick={handleDownloadAll} className="gap-2">
              <Archive className="h-4 w-4" /> Download All (.zip)
            </Button>
            <p className="text-xs text-muted-foreground">Powerpoint presentations, HTML reports and Docx reports</p>
          </div>
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
              errorMessage={r.errorMessage}
              loadingStatus={r.loadingStatus}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
