/**
 * Report export logic — PDF, Word, HTML, and PowerPoint.
 * Extracted from DocumentPreview for reuse and testability.
 */

import type { BrandingData } from "@/components/BrandingSetup";
import {
  SE_HEALTH_CHECK_PDF_LAYOUT_CSS,
  SE_HEALTH_CHECK_PDF_PROFILE,
} from "@/lib/se-health-check-pdf-layout";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import PptxGenJS from "pptxgenjs";

// ── Table parsing utilities ──

function isTableRow(line: string): boolean {
  return /^\|(.+\|)+\s*$/.test(line.trim());
}

function isSeparatorRow(line: string): boolean {
  return /^\|(\s*:?-+:?\s*\|)+\s*$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

// ── DOCX utilities ──

function buildDocxTable(tableLines: string[]): Table {
  const dataRows = tableLines.filter((l) => !isSeparatorRow(l));
  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  };

  const rows = dataRows.map((line, rowIdx) => {
    const cells = parseTableRow(line);
    return new TableRow({
      children: cells.map((cell) =>
        new TableCell({
          borders: cellBorders,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cell,
                  bold: rowIdx === 0,
                  size: rowIdx === 0 ? 22 : 20,
                }),
              ],
            }),
          ],
        })
      ),
    });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
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
      const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      elements.push(
        new Paragraph({
          heading: headingMap[level] || HeadingLevel.HEADING_6,
          children: parseInlineFormatting(headingMatch[2]),
        })
      );
      i++;
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      elements.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInlineFormatting(bulletMatch[1]),
        })
      );
      i++;
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)/);
    if (numberedMatch) {
      elements.push(
        new Paragraph({
          numbering: { reference: "default-numbering", level: 0 },
          children: parseInlineFormatting(numberedMatch[1]),
        })
      );
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(
        new Paragraph({
          border: { bottom: { color: "999999", space: 1, style: "single" as const, size: 6 } },
          children: [new TextRun("")],
        })
      );
      i++;
      continue;
    }

    elements.push(new Paragraph({ children: parseInlineFormatting(trimmed) }));
    i++;
  }

  return elements;
}

// ── Array utility ──

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── PDF / HTML export ──

/** Extract h2 headings from HTML for Table of Contents */
function extractTocFromHtml(html: string): { id: string; text: string }[] {
  const toc: { id: string; text: string }[] = [];
  const h2Regex = /<h2[^>]*(?:id="([^"]*)")?[^>]*>([\s\S]*?)<\/h2>/gi;
  let m;
  while ((m = h2Regex.exec(html)) !== null) {
    const rawText = (m[2] || "").replace(/<[^>]+>/g, "").replace(/\*\*/g, "").replace(/`/g, "").trim();
    const id = m[1] || rawText.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || `h-${toc.length}`;
    toc.push({ id, text: rawText });
  }
  return toc;
}

export type ReportExportTheme = "light" | "dark";

export type BuildPdfHtmlOptions = {
  theme?: ReportExportTheme;
  /** Drop theme button + inline script — required for jsPDF/html2canvas raster (fixed “Dark Mode” pollutes the canvas) */
  omitInteractiveChrome?: boolean;
  /**
   * If this exact substring appears in innerHTML and a TOC is generated, the TOC block is inserted
   * here instead of before the entire body. Used for reports with a cover page + front matter.
   */
  tocAfterMarker?: string;
  /** Omit the navy `.report-header` bar (e.g. health-check PDF where the cover is the title page). */
  omitReportHeader?: boolean;
  /** Omit the grey `.report-footer` strip (avoids a white bar under the cover in html2canvas PDFs). */
  omitReportFooter?: boolean;
  /** Enables full-bleed cover + zero PDF margins when used with `htmlDocumentStringToPdfBlob` (reads `data-pdf-profile`). */
  pdfLayoutProfile?: typeof SE_HEALTH_CHECK_PDF_PROFILE;
  /** Skip auto-generated PDF table of contents (e.g. SE health check — overview already describes sections). */
  omitPdfToc?: boolean;
};

/** Build a standalone HTML document string for PDF/print and zip export. */
export function buildPdfHtml(
  innerHTML: string,
  title: string,
  branding?: BrandingData,
  options?: BuildPdfHtmlOptions
): string {
  const companyName = branding?.companyName || "";
  const customerName = branding?.customerName || "";
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const confidential = branding?.confidential ?? false;
  const theme = options?.theme ?? "light";
  const omitInteractiveChrome = options?.omitInteractiveChrome ?? false;
  const omitReportHeader = options?.omitReportHeader ?? false;
  const omitReportFooter = options?.omitReportFooter ?? false;
  const pdfProfileAttr =
    options?.pdfLayoutProfile === SE_HEALTH_CHECK_PDF_PROFILE
      ? ` data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"`
      : "";
  const seHealthPdfLayoutCss =
    options?.pdfLayoutProfile === SE_HEALTH_CHECK_PDF_PROFILE ? SE_HEALTH_CHECK_PDF_LAYOUT_CSS : "";

  const sophosLogoDark = `<svg viewBox="0 0 600 65" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M4.48,4.35v28.3c0,4.8,2.6,9.21,6.79,11.54l29.46,16.35.19.11,29.6-16.45c4.19-2.33,6.79-6.74,6.79-11.53V4.35H4.48ZM51.89,37.88c-2.2,1.22-4.67,1.86-7.18,1.86l-27.32-.08,15.32-8.54c1.48-.83,3.14-1.26,4.84-1.27l28.92-.09-14.57,8.13ZM51.47,23.9c-1.48.83-3.14,1.26-4.84,1.27l-28.92.09,14.57-8.13c2.2-1.22,4.67-1.86,7.18-1.86l27.32.08-15.32,8.54Z"/><g fill="#fff"><path d="M578.8,25h-46.42c-2.12,0-3.84-1.72-3.84-3.84,0-2.12,1.72-3.84,3.84-3.84h60.4s0-12.88,0-12.88h-60.4c-9.22,0-16.72,7.5-16.72,16.72,0,9.22,7.5,16.72,16.72,16.72h46.42c2.12,0,3.84,1.75,3.84,3.86,0,2.12-1.72,3.77-3.84,3.77h-60.53v12.88h60.53c9.22,0,16.72-7.42,16.72-16.64,0-9.22-7.5-16.74-16.72-16.74Z"/><path d="M228.84,4.47h-25.15c-14.89,0-27.01,12.12-27.01,27.01,0,14.89,12.12,27.01,27.01,27.01h25.15c14.89,0,27.01-12.12,27.01-27.01,0-14.89-12.12-27.01-27.01-27.01ZM228.84,45.6h-25.15c-7.78,0-14.11-6.33-14.11-14.11,0-7.78,6.33-14.11,14.11-14.11h25.15c7.78,0,14.11,6.33,14.11,14.11,0,7.78-6.33,14.11-14.11,14.11Z"/><path d="M483.22,4.47h-25.15c-14.89,0-27.01,12.12-27.01,27.01,0,14.89,12.12,27.01,27.01,27.01h25.15c14.89,0,27.01-12.12,27.01-27.01,0-14.89-12.12-27.01-27.01-27.01ZM483.22,45.6h-25.15c-7.78,0-14.11-6.33-14.11-14.11,0-7.78,6.33-14.11,14.11-14.11h25.15c7.78,0,14.11,6.33,14.11,14.11,0,7.78-6.33,14.11-14.11,14.11Z"/><polygon points="410.52 4.53 410.52 24.96 360.14 24.96 360.14 4.53 347.24 4.53 347.24 58.42 360.14 58.42 360.14 37.86 410.52 37.86 410.52 58.42 423.42 58.42 423.42 4.53 410.52 4.53"/><path d="M155.11,25h-46.42c-2.12,0-3.84-1.72-3.84-3.84,0-2.12,1.72-3.84,3.84-3.84h60.4V4.44h-60.4c-9.22,0-16.72,7.5-16.72,16.72,0,9.22,7.5,16.72,16.72,16.72h46.42c2.12,0,3.84,1.75,3.84,3.86s-1.72,3.77-3.84,3.77h-60.53v12.88s60.53,0,60.53,0c9.22,0,16.72-7.42,16.72-16.64,0-9.22-7.5-16.74-16.72-16.74Z"/><path d="M319.66,4.53h-43.49s-5.2,0-5.2,0h-7.7s0,53.89,0,53.89h12.9s0-14.44,0-14.44h43.49c10.88,0,19.73-8.85,19.73-19.73,0-10.88-8.85-19.73-19.73-19.73ZM319.66,31.08h-43.49s0-13.66,0-13.66h43.49c3.77,0,6.83,3.06,6.83,6.83,0,3.77-3.06,6.83-6.83,6.83Z"/></g></svg>`;

  const preparedBy = branding?.preparedBy || "";
  const footerText = branding?.footerText || "";
  const customLogo = branding?.logoUrl || "";

  const tocEntries = options?.omitPdfToc ? [] : extractTocFromHtml(innerHTML);
  const tocHtml =
    !options?.omitPdfToc && tocEntries.length >= 2
      ? `<nav class="pdf-toc" aria-label="Table of Contents">
  <h2 class="pdf-toc-title">Table of Contents</h2>
  <ul class="pdf-toc-list">${tocEntries.map((e) =>
      `<li><a href="#${e.id}">${e.text}</a></li>`
    ).join("")}</ul>
</nav>`
      : "";

  const tocSpacer = tocHtml ? '<div class="pdf-toc-spacer"></div>' : "";
  const marker = options?.tocAfterMarker;
  const stripTocMarker = (html: string): string => {
    if (!marker || !html.includes(marker)) return html;
    const idx = html.indexOf(marker);
    return html.slice(0, idx) + html.slice(idx + marker.length);
  };
  let printContentInner: string;
  if (tocHtml && marker && innerHTML.includes(marker)) {
    const idx = innerHTML.indexOf(marker);
    const before = innerHTML.slice(0, idx);
    const after = innerHTML.slice(idx + marker.length);
    printContentInner = before + tocHtml + tocSpacer + after;
  } else {
    printContentInner = tocHtml + tocSpacer + stripTocMarker(innerHTML);
  }

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}"${pdfProfileAttr}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — ${companyName || "Sophos FireComply"}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Zalando+Sans:wght@400;500;600;700&family=Zalando+Sans+Expanded:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    :root {
      --bg: #ffffff;
      --bg-surface: #f8fafc;
      --bg-muted: #f1f5f9;
      --border: #e2e8f0;
      --text: #001A47;
      --text-secondary: #334155;
      --text-muted: #94a3b8;
      --accent: #2006F7;
      --accent-light: rgba(32, 6, 247, 0.06);
      --accent-dark: #10037C;
      --th-bg: #10037C;
      --th-text: #ffffff;
      --row-even: #f8fafc;
      --row-odd: #ffffff;
      --code-bg: #f1f5f9;
    }
    [data-theme="dark"] {
      --bg: #0B1120;
      --bg-surface: #111827;
      --bg-muted: #1a2335;
      --border: #1e2d44;
      --text: #e2e8f0;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent: #6B5BFF;
      --accent-light: rgba(107, 91, 255, 0.08);
      --accent-dark: #818cf8;
      --th-bg: #1e2d44;
      --th-text: #e2e8f0;
      --row-even: #111827;
      --row-odd: #0B1120;
      --code-bg: #1a2335;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      padding: 0;
      margin: 0;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
    }

    /* ── Header bar ── */
    .report-header {
      background: var(--accent-dark);
      color: #fff;
      padding: 18px clamp(16px, 4vw, 48px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    [data-theme="dark"] .report-header {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
    }
    .report-header .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .report-header .sophos-logo { height: 22px; width: auto; flex-shrink: 0; }
    .report-header .brand-divider { width: 1px; height: 28px; background: rgba(255,255,255,0.25); flex-shrink: 0; }
    [data-theme="dark"] .report-header .brand-divider { background: var(--border); }
    .report-header .brand-sub {
      font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif;
      font-weight: 600;
      font-size: 9pt;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      opacity: 0.9;
    }
    .report-header .meta {
      text-align: right;
      font-size: 8.5pt;
      opacity: 0.85;
      line-height: 1.6;
    }
    @media (max-width: 600px) {
      .report-header { flex-direction: column; align-items: flex-start; }
      .report-header .meta { text-align: left; }
    }

    /* ── Dark mode toggle ── */
    .theme-toggle {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 100;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 7px 14px;
      cursor: pointer;
      font-size: 9pt;
      font-family: inherit;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      backdrop-filter: blur(8px);
    }
    .theme-toggle:hover { background: var(--bg-muted); color: var(--text); box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    [data-theme="dark"] .theme-toggle { box-shadow: 0 2px 8px rgba(0,0,0,0.3); }

    /* ── Content area ── */
    .print-content {
      padding: 28px clamp(16px, 4vw, 48px) 48px;
    }

    h1 {
      font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif;
      font-size: clamp(16pt, 3vw, 22pt);
      font-weight: 700;
      margin: 28px 0 12px;
      color: var(--text);
      letter-spacing: -0.5px;
      line-height: 1.2;
    }
    h2 {
      font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif;
      font-size: clamp(12pt, 2vw, 15pt);
      font-weight: 700;
      margin: 28px 0 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--accent);
      color: var(--text);
      letter-spacing: -0.3px;
    }
    h3 {
      font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif;
      font-size: 12pt;
      font-weight: 600;
      margin: 20px 0 8px;
      color: var(--text);
    }
    h4, h5, h6 { font-size: 10.5pt; font-weight: 600; margin: 14px 0 6px; color: var(--text-secondary); }
    p { margin: 0 0 12px; color: var(--text-secondary); line-height: 1.7; }
    ul, ol { margin: 0 0 12px; padding-left: 24px; color: var(--text-secondary); }
    li { margin: 5px 0; line-height: 1.6; }
    li::marker { color: var(--text-muted); }

    /* ── Tables ── */
    .table-wrapper {
      overflow-x: auto;
      margin: 16px 0;
      border-radius: 12px;
      border: 1px solid var(--border);
      -webkit-overflow-scrolling: touch;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 9pt;
      table-layout: auto;
      min-width: 500px;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; transition: background 0.15s; }
    th {
      background: var(--th-bg);
      color: var(--th-text);
      font-weight: 600;
      text-align: left;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    th:first-child { border-top-left-radius: 11px; }
    th:last-child { border-top-right-radius: 11px; }
    td {
      padding: 9px 14px;
      border-bottom: 1px solid var(--border);
      word-wrap: break-word;
      overflow-wrap: break-word;
      vertical-align: top;
      color: var(--text-secondary);
    }
    tr:last-child td { border-bottom: none; }
    tr:last-child td:first-child { border-bottom-left-radius: 11px; }
    tr:last-child td:last-child { border-bottom-right-radius: 11px; }
    tbody tr:nth-child(even) td { background: var(--row-even); }
    tbody tr:nth-child(odd) td { background: var(--row-odd); }
    tbody tr:hover td { background: var(--accent-light); }

    /* ── Code ── */
    code {
      font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
      font-size: 8.5pt;
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 5px;
      color: var(--accent);
    }
    pre {
      background: var(--code-bg);
      padding: 16px 18px;
      border-radius: 10px;
      overflow-x: auto;
      margin: 12px 0;
      font-size: 8.5pt;
      border: 1px solid var(--border);
    }
    pre code { background: none; padding: 0; color: var(--text); }

    /* ── Misc ── */
    hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
    blockquote {
      border-left: 3px solid var(--accent);
      padding: 12px 16px;
      margin: 12px 0;
      background: var(--accent-light);
      border-radius: 0 10px 10px 0;
      color: var(--text-secondary);
      font-style: italic;
    }
    strong { font-weight: 600; color: var(--text); }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ── Footer ── */
    .report-footer {
      margin-top: 48px;
      padding: 20px clamp(16px, 4vw, 48px);
      text-align: center;
      font-size: 8pt;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
    }
    .report-footer .footer-logo { height: 16px; width: auto; opacity: 0.4; margin-bottom: 6px; }

    /* ── Table of Contents ── */
    .pdf-toc { margin-bottom: 2em; padding-bottom: 1.5em; border-bottom: 1px solid var(--border); }
    .pdf-toc-title { font-size: 14pt; margin-bottom: 0.75em !important; }
    .pdf-toc-list { list-style: none; padding-left: 0; }
    .pdf-toc-list li { margin: 0.4em 0; }
    .pdf-toc-list a { color: var(--accent); text-decoration: none; }
    .pdf-toc-list a:hover { text-decoration: underline; }
    .pdf-toc-list a::after { content: leader(dotted) target-counter(attr(href), page); }

    ${seHealthPdfLayoutCss}

    /* ── Confidential watermark (print only) ── */
    .pdf-watermark {
      display: none;
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 48pt; font-weight: 700; color: rgba(0,0,0,0.06); pointer-events: none;
      white-space: nowrap; z-index: 9999; user-select: none;
    }

    /* ── Print: professional typography & layout ── */
    @media print {
      body {
        padding: 0;
        background: #fff !important;
        color: #1a1a1a !important;
        font-family: Georgia, 'Times New Roman', serif !important;
        font-size: 11pt;
        line-height: 1.6;
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        page-break-after: avoid;
      }
      h2 { page-break-before: always; }
      h2:first-of-type { page-break-before: avoid; }
      .print-content { padding: 0; max-width: 186mm; margin: 0 auto; }
      .report-header { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .theme-toggle { display: none !important; }
      .report-footer { display: none; }
      .pdf-toc { page-break-after: always; }
      .pdf-toc-list a::after { content: " ... " target-counter(attr(href), page); }
      ${confidential ? `.pdf-watermark { display: block !important; }` : ""}
      .print-header, .print-footer { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

      @page {
        size: A4;
        margin: 15mm;
      }

      /* Print header/footer via fixed elements — counter(page) works in print context */
      .print-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        padding: 4mm 0;
        font-family: 'Zalando Sans', sans-serif;
        font-size: 8pt;
        color: #333;
        border-bottom: 1px solid #ddd;
        background: #fff;
      }
      .print-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 4mm 0;
        font-family: Georgia, serif;
        font-size: 9pt;
        color: #666;
        border-top: 1px solid #ddd;
        background: #fff;
        text-align: center;
      }
      .print-footer::after {
        content: "Page " counter(page) " of " counter(pages) " — ${companyName || "Sophos FireComply"}${customerName ? ` • ${customerName}` : ""}";
      }

      table { font-size: 8.5pt; min-width: 0; }
      th, td { padding: 5px 7px; }
      th { print-color-adjust: exact; -webkit-print-color-adjust: exact; background: #f5f5f5 !important; color: #1a1a1a !important; }
      tbody tr:nth-child(even) td { print-color-adjust: exact; -webkit-print-color-adjust: exact; background: #fafafa !important; }
      tbody tr:nth-child(odd) td { background: #fff !important; }
      .table-wrapper { overflow: visible; border-radius: 0; }
    }
  </style>
</head>
<body>
  ${confidential ? '<div class="pdf-watermark no-print" aria-hidden="true">CONFIDENTIAL</div>' : ""}
  <div class="print-header no-print" aria-hidden="true">${companyName || "Sophos FireComply"} — ${title}${customerName ? ` | ${customerName}` : ""}</div>
  <div class="print-footer no-print" aria-hidden="true"></div>
  <style>.no-print { display: none; }</style>
  <style>@media print { .no-print { display: none !important; } .print-header, .print-footer, .pdf-watermark { display: block !important; } }</style>

  ${omitInteractiveChrome
    ? ""
    : `<button class="theme-toggle" onclick="toggleTheme()" id="themeBtn" type="button">&#9789; Dark Mode</button>`
  }

  ${omitReportHeader
    ? ""
    : `<div class="report-header">
    <div class="brand">
      ${customLogo
        ? `<img src="${customLogo}" alt="${companyName}" style="height:32px;width:auto;max-width:180px;object-fit:contain;" class="sophos-logo" />`
        : `<span class="sophos-logo">${sophosLogoDark}</span>`
      }
      <span class="brand-divider"></span>
      <span class="brand-sub">${companyName || "FireComply"}</span>
    </div>
    <div class="meta">
      ${customerName ? `<div style="font-weight:600">${customerName}</div>` : ""}
      ${preparedBy ? `<div>Prepared by: ${preparedBy}</div>` : ""}
      <div>${dateStr}</div>
    </div>
  </div>`
  }

  <div class="print-content">${printContentInner}</div>

  ${omitReportFooter
    ? ""
    : `<div class="report-footer">
    <div>${footerText || (companyName ? `Generated by ${companyName}` : "Generated by Sophos FireComply")}</div>
    <div>${dateStr}${preparedBy ? ` &mdash; ${preparedBy}` : companyName ? ` &mdash; ${companyName}` : ""}</div>
  </div>`
  }

  ${omitInteractiveChrome
    ? ""
    : `<script>
    function toggleTheme() {
      var html = document.documentElement;
      var btn = document.getElementById('themeBtn');
      var isDark = html.getAttribute('data-theme') === 'dark';
      html.setAttribute('data-theme', isDark ? 'light' : 'dark');
      btn.innerHTML = isDark ? '&#9789; Dark Mode' : '&#9788; Light Mode';
    }

    /* Wrap bare tables in .table-wrapper for rounded corners + scroll */
    document.querySelectorAll('table').forEach(function(t) {
      if (t.parentElement && t.parentElement.classList.contains('table-wrapper')) return;
      var w = document.createElement('div');
      w.className = 'table-wrapper';
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    });

    /* Ensure h2 elements have ids for ToC navigation */
    document.querySelectorAll('.print-content h2').forEach(function(h2, i) {
      if (!h2.id) {
        var text = (h2.textContent || '').replace(/[^\\w\\s-]/g, '').trim().toLowerCase().replace(/\\s+/g, '-').replace(/-+/g, '-') || 'section-' + i;
        h2.id = text;
      }
    });
  </script>`
  }
</body>
</html>`;
}

// ── Word export ──

/** Generate Word blob from markdown */
export async function generateWordBlob(markdown: string, branding: BrandingData): Promise<Blob> {
  const headerParagraphs: Paragraph[] = [];
  if (branding.companyName) {
    headerParagraphs.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: branding.companyName, bold: true, size: 36 })],
      })
    );
    headerParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "Firewall Configuration Report", color: "666666", size: 24 })],
      })
    );
    if (branding.customerName) {
      headerParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: `Customer: ${branding.customerName}`, color: "333333", size: 22 })],
        })
      );
    }
    if (branding.preparedBy) {
      headerParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Prepared by: ${branding.preparedBy}`,
              color: "666666",
              size: 20,
              italics: true,
            }),
          ],
        })
      );
    }
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
            color: "999999",
            size: 18,
          }),
        ],
      })
    );
    headerParagraphs.push(new Paragraph({ text: "" }));
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [{ level: 0, format: "decimal" as const, text: "%1.", alignment: AlignmentType.START }],
        },
      ],
    },
    sections: [
      {
        children: [...headerParagraphs, ...markdownToDocxElements(markdown)],
      },
    ],
  });

  return Packer.toBlob(doc);
}

// ── PowerPoint export ──

/** Generate a PowerPoint presentation from markdown report */
export async function generatePptxBlob(
  markdown: string,
  reportLabel: string,
  branding: BrandingData
): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = branding.companyName || "Firewall Report";
  pptx.title = `${reportLabel} - Firewall Report`;

  const PRIMARY = "001A47";
  const ACCENT = "2006F7";
  const GRAY = "6A889B";
  const LIGHT_BG = "EDF2F9";

  // --- Title slide ---
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: PRIMARY };
  if (branding.companyName) {
    titleSlide.addText(branding.companyName, {
      x: 0.8,
      y: 1.2,
      w: 11,
      h: 1,
      fontSize: 36,
      bold: true,
      color: "FFFFFF",
      fontFace: "Segoe UI",
    });
  }
  titleSlide.addText(reportLabel, {
    x: 0.8,
    y: 2.4,
    w: 11,
    h: 0.8,
    fontSize: 24,
    color: "c7d2fe",
    fontFace: "Segoe UI",
  });
  if (branding.customerName) {
    titleSlide.addText(branding.customerName, {
      x: 0.8,
      y: 3.2,
      w: 11,
      h: 0.6,
      fontSize: 18,
      color: "c7d2fe",
      fontFace: "Segoe UI",
    });
  }
  titleSlide.addText("Firewall Configuration Report", {
    x: 0.8,
    y: branding.customerName ? 3.8 : 3.4,
    w: 11,
    h: 0.6,
    fontSize: 16,
    color: "94a3b8",
    fontFace: "Segoe UI",
  });
  const dateAndAuthor = [
    new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    branding.preparedBy ? `Prepared by ${branding.preparedBy}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");
  titleSlide.addText(dateAndAuthor, {
    x: 0.8,
    y: branding.customerName ? 4.6 : 4.4,
    w: 11,
    h: 0.5,
    fontSize: 12,
    color: "94a3b8",
    fontFace: "Segoe UI",
  });

  // Parse markdown into sections (include paragraphs so no slide is left blank)
  const lines = markdown.split("\n");
  let currentH2 = "";
  let currentBullets: string[] = [];
  let currentParagraphs: string[] = [];
  const sections: {
    title: string;
    bullets: string[];
    paragraphs: string[];
    tables: { headers: string[]; rows: string[][] }[];
  }[] = [];
  let currentTables: { headers: string[]; rows: string[][] }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const h2Match = line.match(/^##\s+(.*)/);
    const h3Match = line.match(/^###\s+(.*)/);

    if (h2Match || h3Match) {
      if (currentH2) {
        sections.push({
          title: currentH2,
          bullets: [...currentBullets],
          paragraphs: [...currentParagraphs],
          tables: [...currentTables],
        });
      }
      currentH2 = (h2Match || h3Match)![1];
      currentBullets = [];
      currentParagraphs = [];
      currentTables = [];
      continue;
    }

    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isTableRow(lines[i].trim()) || isSeparatorRow(lines[i].trim()))) {
        tableLines.push(lines[i].trim());
        i++;
      }
      i--;
      const dataLines = tableLines.filter((l) => !isSeparatorRow(l));
      if (dataLines.length >= 2) {
        const headers = parseTableRow(dataLines[0]);
        const rows = dataLines.slice(1).map((l) => parseTableRow(l));
        currentTables.push({ headers, rows });
      }
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      currentBullets.push(bulletMatch[1].replace(/\*\*/g, ""));
      continue;
    }

    const numMatch = line.match(/^\d+\.\s+(.*)/);
    if (numMatch) {
      currentBullets.push(numMatch[1].replace(/\*\*/g, ""));
      continue;
    }

    if (line.startsWith("**") && line.includes(":")) {
      currentBullets.push(line.replace(/\*\*/g, ""));
      continue;
    }

    if (line.length > 0 && line.length < 500) {
      currentParagraphs.push(line.replace(/\*\*/g, "").trim());
    }
  }
  if (currentH2) {
    sections.push({
      title: currentH2,
      bullets: [...currentBullets],
      paragraphs: [...currentParagraphs],
      tables: [...currentTables],
    });
  }

  // --- Generate slides for each section ---
  const MAX_PARAGRAPH_LINES_ON_TITLE = 5;
  const PLACEHOLDER_TEXT =
    "Key findings and recommendations for this area are in the full report. Use the Word/HTML export for full detail.";

  for (const section of sections) {
    const sectionSlide = pptx.addSlide();
    sectionSlide.addText(section.title, {
      x: 0.8,
      y: 0.3,
      w: 11,
      h: 0.7,
      fontSize: 24,
      bold: true,
      color: PRIMARY,
      fontFace: "Segoe UI",
    });
    sectionSlide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 0.95,
      w: 2.5,
      h: 0.04,
      fill: { color: ACCENT },
    });

    const paraLines = section.paragraphs.slice(0, MAX_PARAGRAPH_LINES_ON_TITLE);
    const hasContent =
      paraLines.length > 0 ||
      section.bullets.length > 0 ||
      section.tables.some((t) => t.rows.length > 0);
    let bodyY = 1.15;

    if (paraLines.length > 0) {
      const bodyText = paraLines.join("\n");
      sectionSlide.addText(bodyText, {
        x: 0.8,
        y: bodyY,
        w: 11,
        h: 4,
        fontSize: 14,
        color: "334155",
        fontFace: "Segoe UI",
        valign: "top",
        breakLine: true,
        lineSpacingMultiple: 1.25,
      });
      bodyY += Math.min(paraLines.length * 0.35, 2.5);
    }

    if (!hasContent) {
      sectionSlide.addText(PLACEHOLDER_TEXT, {
        x: 0.8,
        y: 1.15,
        w: 11,
        h: 1.5,
        fontSize: 14,
        color: GRAY,
        fontFace: "Segoe UI",
        italic: true,
        valign: "top",
      });
    }

    if (section.bullets.length > 0) {
      const chunks = chunkArray(section.bullets, 6);
      const bulletsStartOnNewSlide = paraLines.length > 0;
      for (let ci = 0; ci < chunks.length; ci++) {
        const slideRef =
          ci === 0 && !bulletsStartOnNewSlide
            ? sectionSlide
            : (() => {
                const s = pptx.addSlide();
                s.addText(ci === 0 ? section.title : `${section.title} (continued)`, {
                  x: 0.8,
                  y: 0.3,
                  w: 11,
                  h: 0.7,
                  fontSize: 20,
                  bold: true,
                  color: PRIMARY,
                  fontFace: "Segoe UI",
                });
                s.addShape(pptx.ShapeType.rect, {
                  x: 0.8,
                  y: 0.95,
                  w: 2.5,
                  h: 0.04,
                  fill: { color: ACCENT },
                });
                return s;
              })();
        const yStart = 1.0;
        const bulletTexts = chunks[ci].map((b) => ({
          text: b.length > 120 ? b.slice(0, 117) + "…" : b,
          options: {
            fontSize: 14,
            color: "334155",
            bullet: { code: "2022" },
            fontFace: "Segoe UI",
            breakLine: true as const,
          },
        }));
        slideRef.addText(bulletTexts as Parameters<typeof slideRef.addText>[0], {
          x: 0.8,
          y: yStart,
          w: 11,
          h: 5.5 - yStart,
          valign: "top",
          lineSpacingMultiple: 1.3,
        });
      }
    }

    for (const table of section.tables) {
      if (table.rows.length === 0) continue;
      const maxRowsPerSlide = 10;
      const rowChunks = chunkArray(table.rows, maxRowsPerSlide);

      for (let ci = 0; ci < rowChunks.length; ci++) {
        const tSlide = pptx.addSlide();
        const suffix = rowChunks.length > 1 ? ` (${ci + 1}/${rowChunks.length})` : "";
        tSlide.addText(`${section.title}${suffix}`, {
          x: 0.8,
          y: 0.2,
          w: 11,
          h: 0.6,
          fontSize: 20,
          bold: true,
          color: PRIMARY,
          fontFace: "Segoe UI",
        });
        tSlide.addShape(pptx.ShapeType.rect, {
          x: 0.8,
          y: 0.75,
          w: 2.5,
          h: 0.03,
          fill: { color: ACCENT },
        });

        const colW = 11.8 / table.headers.length;
        const headerRow: PptxGenJS.TableRow = table.headers.map((h) => ({
          text: String(h).slice(0, 80),
          options: {
            bold: true,
            fontSize: 11,
            color: "FFFFFF",
            fill: { color: ACCENT },
            fontFace: "Segoe UI",
            align: "left" as const,
            valign: "middle" as const,
          },
        }));
        const dataRows: PptxGenJS.TableRow[] = rowChunks[ci].map((row, ri) =>
          row.map((cell) => ({
            text: String(cell).slice(0, 100),
            options: {
              fontSize: 10,
              color: "334155",
              fill: { color: ri % 2 === 0 ? "FFFFFF" : LIGHT_BG },
              fontFace: "Segoe UI",
              valign: "top" as const,
            },
          }))
        );

        tSlide.addTable([headerRow, ...dataRows], {
          x: 0.3,
          y: 0.95,
          w: 12.4,
          colW: Array(table.headers.length).fill(colW),
          border: { pt: 0.5, color: "cbd5e1" },
          autoPage: false,
          margin: [3, 5, 3, 5],
        });
      }
    }
  }

  const endSlide = pptx.addSlide();
  endSlide.background = { color: PRIMARY };
  endSlide.addText("Thank You", {
    x: 0.8,
    y: 2.0,
    w: 11,
    h: 1,
    fontSize: 36,
    bold: true,
    color: "FFFFFF",
    fontFace: "Segoe UI",
    align: "center",
  });
  if (branding.companyName) {
    endSlide.addText(`Prepared by ${branding.companyName}`, {
      x: 0.8,
      y: 3.2,
      w: 11,
      h: 0.6,
      fontSize: 16,
      color: "94a3b8",
      fontFace: "Segoe UI",
      align: "center",
    });
  }

  return (await pptx.write({ outputType: "blob" })) as Blob;
}
