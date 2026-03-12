import { useMemo, useRef, type ReactNode } from "react";
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
  /** Rendered at the top when reports exist (e.g. Add Compliance Evidence Pack) */
  topActions?: ReactNode;
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

/** Build a standalone HTML document string for PDF/print and zip export. A4 format, clear to read. */
function buildPdfHtml(innerHTML: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Zalando+Sans:wght@400;500;600;700&family=Zalando+Sans+Expanded:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #001A47;
      padding: 0;
      max-width: 186mm;
      margin: 0 auto;
      background: #fff;
    }
    .print-content { padding: 12mm 0; }
    h1 { font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif; font-size: 18pt; font-weight: 700; margin: 14px 0 8px; color: #001A47; }
    h2 { font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif; font-size: 14pt; font-weight: 700; margin: 12px 0 6px; padding-bottom: 4px; border-bottom: 2px solid #2006F7; color: #10037C; }
    h3 { font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif; font-size: 12pt; font-weight: 600; margin: 10px 0 4px; color: #001A47; }
    h4, h5, h6 { font-size: 11pt; font-weight: 600; margin: 8px 0 4px; color: #223E4C; }
    p { margin: 0 0 8px; color: #223E4C; }
    ul, ol { margin: 0 0 8px; padding-left: 22px; color: #223E4C; }
    li { margin: 3px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 9.5pt;
      table-layout: fixed;
      page-break-inside: auto;
      border: 1px solid #BBCFDE;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th {
      background: #2006F7;
      color: #fff;
      font-weight: 600;
      text-align: left;
      padding: 5px 6px;
      border: 1px solid #10037C;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    td {
      padding: 4px 6px;
      border: 1px solid #BBCFDE;
      word-wrap: break-word;
      overflow-wrap: break-word;
      vertical-align: top;
      color: #223E4C;
    }
    tr:nth-child(even) td { background: #EDF2F9; }
    tr:nth-child(odd) td { background: #fff; }
    code { font-family: 'Courier New', monospace; font-size: 9pt; background: #EDF2F9; padding: 2px 4px; border-radius: 3px; }
    pre { background: #EDF2F9; padding: 8px; border-radius: 4px; overflow-x: auto; margin: 8px 0; font-size: 9pt; }
    hr { border: none; border-top: 1px solid #BBCFDE; margin: 12px 0; }
    blockquote { border-left: 4px solid #2006F7; padding-left: 10px; margin: 8px 0; background: #EDF2F9; color: #223E4C; font-style: italic; }
    strong { font-weight: 600; color: #001A47; }
    @media print {
      body { padding: 0; max-width: none; }
      .print-content { padding: 0; max-width: 186mm; margin: 0 auto; }
      @page { size: A4; margin: 12mm; }
      table { font-size: 9pt; }
      th, td { padding: 4px 5px; }
    }
  </style>
</head>
<body><div class="print-content">${innerHTML}</div></body>
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

  // Parse markdown into sections (include paragraphs so no slide is left blank)
  const lines = markdown.split("\n");
  let currentH2 = "";
  let currentBullets: string[] = [];
  let currentParagraphs: string[] = [];
  const sections: { title: string; bullets: string[]; paragraphs: string[]; tables: { headers: string[]; rows: string[][] }[] }[] = [];
  let currentTables: { headers: string[]; rows: string[][] }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const h2Match = line.match(/^##\s+(.*)/);
    const h3Match = line.match(/^###\s+(.*)/);

    if (h2Match || h3Match) {
      // Push previous section even if no bullets/tables (so we get a slide; we'll use paragraphs or placeholder)
      if (currentH2) {
        sections.push({ title: currentH2, bullets: [...currentBullets], paragraphs: [...currentParagraphs], tables: [...currentTables] });
      }
      currentH2 = (h2Match || h3Match)![1];
      currentBullets = [];
      currentParagraphs = [];
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
      continue;
    }

    // Collect paragraph text (non-empty lines that aren't structure)
    if (line.length > 0 && line.length < 500) {
      currentParagraphs.push(line.replace(/\*\*/g, "").trim());
    }
  }
  // Push last section
  if (currentH2) {
    sections.push({ title: currentH2, bullets: [...currentBullets], paragraphs: [...currentParagraphs], tables: [...currentTables] });
  }

  // --- Generate slides for each section ---
  const MAX_PARAGRAPH_LINES_ON_TITLE = 5;
  const PLACEHOLDER_TEXT = "Key findings and recommendations for this area are in the full report. Use the Word/HTML export for full detail.";

  for (const section of sections) {
    // Section title slide — always add body content so no blank slides
    const sectionSlide = pptx.addSlide();
    sectionSlide.addText(section.title, {
      x: 0.8, y: 0.3, w: 11, h: 0.7,
      fontSize: 24, bold: true, color: PRIMARY,
      fontFace: "Segoe UI",
    });
    sectionSlide.addShape(pptx.ShapeType.rect, {
      x: 0.8, y: 0.95, w: 2.5, h: 0.04,
      fill: { color: ACCENT },
    });

    // Body: paragraphs first (good for presenting findings), then bullets, or placeholder
    const paraLines = section.paragraphs.slice(0, MAX_PARAGRAPH_LINES_ON_TITLE);
    const hasContent = paraLines.length > 0 || section.bullets.length > 0 || section.tables.some(t => t.rows.length > 0);
    let bodyY = 1.15;

    if (paraLines.length > 0) {
      const bodyText = paraLines.join("\n");
      sectionSlide.addText(bodyText, {
        x: 0.8, y: bodyY, w: 11, h: 4,
        fontSize: 14, color: "334155",
        fontFace: "Segoe UI",
        valign: "top",
        breakLine: true,
        lineSpacingMultiple: 1.25,
      });
      bodyY += Math.min(paraLines.length * 0.35, 2.5);
    }

    if (!hasContent) {
      sectionSlide.addText(PLACEHOLDER_TEXT, {
        x: 0.8, y: 1.15, w: 11, h: 1.5,
        fontSize: 14, color: GRAY,
        fontFace: "Segoe UI",
        italic: true,
        valign: "top",
      });
    }

    // Bullets (paginate if >6 for readability when presenting)
    if (section.bullets.length > 0) {
      const chunks = chunkArray(section.bullets, 6);
      const bulletsStartOnNewSlide = paraLines.length > 0; // keep title slide for paragraph body only
      for (let ci = 0; ci < chunks.length; ci++) {
        const slideRef = (ci === 0 && !bulletsStartOnNewSlide) ? sectionSlide : (() => {
          const s = pptx.addSlide();
          s.addText(ci === 0 ? section.title : `${section.title} (continued)`, {
            x: 0.8, y: 0.3, w: 11, h: 0.7,
            fontSize: 20, bold: true, color: PRIMARY,
            fontFace: "Segoe UI",
          });
          s.addShape(pptx.ShapeType.rect, {
            x: 0.8, y: 0.95, w: 2.5, h: 0.04,
            fill: { color: ACCENT },
          });
          return s;
        })();
        const yStart = 1.0;
        const bulletTexts = chunks[ci].map(b => ({
          text: b.length > 120 ? b.slice(0, 117) + "…" : b,
          options: { fontSize: 14, color: "334155", bullet: { code: "2022" }, fontFace: "Segoe UI", breakLine: true as const },
        }));
        slideRef.addText(bulletTexts as any, {
          x: 0.8, y: yStart, w: 11, h: 5.5 - yStart,
          valign: "top",
          lineSpacingMultiple: 1.3,
        });
      }
    }

    // Tables (one slide per table with data; skip empty tables)
    for (const table of section.tables) {
      if (table.rows.length === 0) continue;
      const maxRowsPerSlide = 10;
      const rowChunks = chunkArray(table.rows, maxRowsPerSlide);

      for (let ci = 0; ci < rowChunks.length; ci++) {
        const tSlide = pptx.addSlide();
        const suffix = rowChunks.length > 1 ? ` (${ci + 1}/${rowChunks.length})` : "";
        tSlide.addText(`${section.title}${suffix}`, {
          x: 0.8, y: 0.2, w: 11, h: 0.6,
          fontSize: 20, bold: true, color: PRIMARY,
          fontFace: "Segoe UI",
        });
        tSlide.addShape(pptx.ShapeType.rect, {
          x: 0.8, y: 0.75, w: 2.5, h: 0.03,
          fill: { color: ACCENT },
        });

        const colW = 11.8 / table.headers.length;
        const headerRow: PptxGenJS.TableRow = table.headers.map(h => ({
          text: String(h).slice(0, 80),
          options: { bold: true, fontSize: 11, color: "FFFFFF", fill: { color: ACCENT }, fontFace: "Segoe UI", align: "left" as const, valign: "middle" as const },
        }));
        const dataRows: PptxGenJS.TableRow[] = rowChunks[ci].map((row, ri) =>
          row.map(cell => ({
            text: String(cell).slice(0, 100),
            options: { fontSize: 10, color: "334155", fill: { color: ri % 2 === 0 ? "FFFFFF" : LIGHT_BG }, fontFace: "Segoe UI", valign: "top" as const },
          }))
        );

        tSlide.addTable([headerRow, ...dataRows], {
          x: 0.3, y: 0.95, w: 12.4,
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
            <Loader2 className="h-8 w-8 animate-spin mb-6 text-primary" />
            <p className="text-lg font-semibold text-foreground mb-4">Analysing configuration</p>
            <div className="flex items-center gap-2 text-xs">
              {["Sending request", "Waiting for response", "Generating"].map((step, i) => {
                const currentIdx = !loadingStatus ? -1 : loadingStatus.startsWith("Sending") ? 0 : loadingStatus.startsWith("Waiting") ? 1 : loadingStatus.startsWith("Generating") ? 2 : -1;
                const isActive = i === currentIdx;
                const isDone = i < currentIdx;
                return (
                  <span key={step} className="flex items-center gap-1.5">
                    {i > 0 && <span className={`w-6 h-px ${isDone ? "bg-[#00995a] dark:bg-[#00F2B3]" : "bg-border"}`} />}
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${isDone ? "bg-[#00995a]/15 text-[#00995a] dark:bg-[#00F2B3]/15 dark:text-[#00F2B3]" : isActive ? "bg-primary/15 text-primary ring-2 ring-primary/30" : "bg-muted text-muted-foreground"}`}>
                      {isDone ? "✓" : i + 1}
                    </span>
                    <span className={`${isActive ? "font-semibold text-foreground" : isDone ? "text-[#00995a] dark:text-[#00F2B3]" : "text-muted-foreground"}`}>{step}</span>
                  </span>
                );
              })}
            </div>
            <p className="text-xs mt-4 text-muted-foreground">This may take a minute for large configs</p>
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

export function DocumentPreview({ reports, activeReportId, onActiveChange, isLoading, loadingReportIds, failedReportIds, onRetry, branding, topActions }: Props) {
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
        {topActions}
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
      {topActions}
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
          {reports.map((r) => {
            const done = r.markdown && !loadingReportIds.has(r.id) && !failedReportIds.has(r.id);
            return (
              <TabsTrigger key={r.id} value={r.id} className="text-xs gap-1.5">
                {r.label}
                {loadingReportIds.has(r.id) && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                {failedReportIds.has(r.id) && <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-destructive/10 text-destructive text-[10px]">✕</span>}
                {done && <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#00995a]/15 text-[#00995a] dark:bg-[#00F2B3]/15 dark:text-[#00F2B3] text-[10px]">✓</span>}
              </TabsTrigger>
            );
          })}
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
