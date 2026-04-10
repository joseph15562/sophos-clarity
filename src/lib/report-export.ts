/**
 * Report export logic — PDF, Word, HTML, and PowerPoint.
 * Extracted from DocumentPreview for reuse and testability.
 */

import type { BrandingData } from "@/components/BrandingSetup";
import { normalizeMarkdownEmbeddedDataImages } from "@/lib/markdown-data-uri-normalize";
import { normalizeMarkdownTables, trimIncompleteMarkdownTableTail } from "@/lib/report-html";
import {
  SE_HEALTH_CHECK_PDF_LAYOUT_CSS,
  SE_HEALTH_CHECK_PDF_PROFILE,
} from "@/lib/se-health-check-pdf-layout";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  TableLayoutType,
  ShadingType,
  PageOrientation,
  VerticalAlignTable,
} from "docx";
import PptxGenJS from "pptxgenjs";

// ── HTML safety for PDF shell (branding is user-controlled) ──

function escapeHtmlBranding(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MAX_BRANDING_DATA_IMAGE_CHARS = 500_000;

/** Only https images or small data:image/*;base64 URLs — blocks javascript:, data:text/html, etc. */
function sanitizeBrandingLogoUrl(raw: string | null | undefined): string {
  const u = (raw ?? "").trim();
  if (!u) return "";
  if (u.startsWith("https://")) {
    try {
      const parsed = new URL(u);
      return parsed.protocol === "https:" ? u : "";
    } catch {
      return "";
    }
  }
  if (!u.startsWith("data:image/") || u.length > MAX_BRANDING_DATA_IMAGE_CHARS) return "";
  const head = u.slice(0, Math.min(80, u.indexOf(",") + 1 || 80)).toLowerCase();
  if (!head.includes(";base64,") && !u.includes(";base64,")) return "";
  if (!/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml)/i.test(u)) return "";
  return u;
}

// ── Table parsing utilities ──

function isTableRow(line: string): boolean {
  return /^\|(.+\|)+\s*$/.test(line.trim());
}

function isSeparatorRow(line: string): boolean {
  return /^\|(\s*:?-+:?\s*\|)+\s*$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

// ── DOCX utilities ──

/** Sophos navy header + light grid (matches PDF / product palette). */
const DOCX_TABLE_HEADER_FILL = "001A47";
const DOCX_TABLE_HEADER_TEXT = "FFFFFF";
const DOCX_TABLE_ZEBRA = "EDF2F9";
const DOCX_TABLE_GRID = "94A3B8";

/** Twips for row-index column when header is `#` / No / Index (2–3 digit row numbers). */
const DOCX_INDEX_COL_TWIPS = 640;

function isLikelyIndexColumnHeader(headerCell: string): boolean {
  const t = headerCell.trim();
  if (!t) return false;
  if (/^#+$/.test(t)) return true;
  if (/^(no\.?|n[°º]\.?|idx\.?|index|row|rank|item)$/i.test(t)) return true;
  return false;
}

function splitRemainderEvenly(restTotal: number, nCols: number): number[] {
  if (nCols <= 0) return [];
  const base = Math.floor(restTotal / nCols);
  const rem = restTotal - base * nCols;
  return Array.from({ length: nCols }, (_, i) => base + (i < rem ? 1 : 0));
}

/**
 * Landscape fixed table grid: first column wide for titles unless it is clearly a row index (`#`).
 * When narrow, the “primary text” width bonus moves to column 2 (e.g. rule name).
 * @internal Exported for unit tests.
 */
export function computeDocxTableFixedColumnWidths(
  cellCount: number,
  gridTotal: number,
  opts?: { headerFirstCell?: string; firstColBodySamples?: string[] },
): number[] {
  if (cellCount <= 1) return [gridTotal];

  const header = opts?.headerFirstCell?.trim() ?? "";
  const samples = opts?.firstColBodySamples ?? [];
  const narrowFirst =
    isLikelyIndexColumnHeader(header) ||
    (cellCount >= 8 && samples.length >= 3 && samples.every((s) => /^\d{1,6}$/.test(s.trim())));

  if (!narrowFirst) {
    const firstW = Math.min(Math.floor(gridTotal * 0.32), 4800);
    const restTotal = gridTotal - firstW;
    return [firstW, ...splitRemainderEvenly(restTotal, cellCount - 1)];
  }

  const indexW = Math.min(DOCX_INDEX_COL_TWIPS, Math.max(400, gridTotal - 2000));
  const afterIndex = gridTotal - indexW;
  if (cellCount === 2) {
    return [indexW, afterIndex];
  }
  const secondW = Math.min(Math.floor(afterIndex * 0.34), 5200);
  const tailTotal = afterIndex - secondW;
  return [indexW, secondW, ...splitRemainderEvenly(tailTotal, cellCount - 2)];
}

function buildDocxTable(tableLines: string[]): Table {
  const dataRows = tableLines.filter((l) => !isSeparatorRow(l));
  if (dataRows.length === 0) {
    return new Table({ rows: [], width: { size: 100, type: WidthType.PERCENTAGE } });
  }

  const cellCount = Math.max(...dataRows.map((line) => parseTableRow(line).length), 1);
  /** Twip grid for landscape body — wide firewall rule tables need room to wrap, not squeeze. */
  const gridTotal = 13_000;
  const useAutofit = cellCount <= 5;
  const headerCells = dataRows[0] ? parseTableRow(dataRows[0]) : [];
  const firstColBodySamples = dataRows.slice(1, 5).map((line) => parseTableRow(line)[0] ?? "");
  const columnWidths = useAutofit
    ? undefined
    : computeDocxTableFixedColumnWidths(cellCount, gridTotal, {
        headerFirstCell: headerCells[0] ?? "",
        firstColBodySamples,
      });

  const cellMargins =
    cellCount > 12
      ? { top: 36, bottom: 36, left: 55, right: 55 }
      : cellCount > 8
        ? { top: 45, bottom: 45, left: 70, right: 70 }
        : { top: 60, bottom: 60, left: 90, right: 90 };

  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: DOCX_TABLE_GRID },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: DOCX_TABLE_GRID },
    left: { style: BorderStyle.SINGLE, size: 1, color: DOCX_TABLE_GRID },
    right: { style: BorderStyle.SINGLE, size: 1, color: DOCX_TABLE_GRID },
  };

  const fontBody = cellCount > 12 ? 16 : cellCount > 8 ? 18 : 20;
  const fontHeader = cellCount > 12 ? 18 : 22;

  const rows = dataRows.map((line, rowIdx) => {
    let cells = parseTableRow(line);
    while (cells.length < cellCount) cells.push("");
    if (cells.length > cellCount) cells = cells.slice(0, cellCount);
    const isHeader = rowIdx === 0;

    return new TableRow({
      children: cells.map(
        (cell) =>
          new TableCell({
            borders: cellBorders,
            verticalAlign: VerticalAlignTable.TOP,
            margins: cellMargins,
            shading: isHeader
              ? { fill: DOCX_TABLE_HEADER_FILL, type: ShadingType.CLEAR }
              : rowIdx % 2 === 1
                ? { fill: DOCX_TABLE_ZEBRA, type: ShadingType.CLEAR }
                : { fill: "FFFFFF", type: ShadingType.CLEAR },
            children: [
              new Paragraph({
                spacing: { after: 0, before: 0, line: 240 },
                children: [
                  new TextRun({
                    text: cell,
                    bold: isHeader,
                    size: isHeader ? fontHeader : fontBody,
                    color: isHeader ? DOCX_TABLE_HEADER_TEXT : "334155",
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
      ),
    });
  });

  if (useAutofit) {
    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.AUTOFIT,
    });
  }

  return new Table({
    rows,
    width: { size: gridTotal, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
  });
}

/** Max base64 length (~6M chars) for a single embedded Word image */
const MAX_DOCX_IMAGE_B64_CHARS = 6_000_000;

type DocxEmbedImage = {
  alt: string;
  type: "png" | "jpg" | "gif" | "bmp";
  data: Uint8Array;
};

const DOCX_IMG_PLACEHOLDER_LINE = /^__FC_DOCX_IMG_(\d+)__$/;

function base64ToUint8Array(b64: string): Uint8Array {
  if (typeof globalThis.atob === "function") {
    const bin = globalThis.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const NodeBuffer = (
    globalThis as unknown as { Buffer?: { from(s: string, enc: string): Uint8Array } }
  ).Buffer;
  if (NodeBuffer?.from) {
    return Uint8Array.from(NodeBuffer.from(b64, "base64"));
  }
  throw new Error("No base64 decoder available");
}

function readPngIhdrDimensions(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 24) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1 || w > 16384 || h > 16384) {
    return null;
  }
  return { w, h };
}

/** Cover / MSP logos use alt text like "Company Logo" — keep Word inline size near header strip (see PDF ~56px tall). */
function isLikelyBrandingLogoAlt(alt: string): boolean {
  const a = alt.trim().toLowerCase();
  if (!a) return false;
  return (
    a === "company logo" ||
    a === "logo" ||
    a.startsWith("company logo") ||
    a.includes("customer logo") ||
    a.includes("msp logo") ||
    a.includes("branding logo")
  );
}

/** Pixel size passed to docx {@link ImageRun} (library converts for OOXML). Exported for unit tests. */
export function docxImageTransformation(
  mime: DocxEmbedImage["type"],
  data: Uint8Array,
  alt: string = "",
): { width: number; height: number } {
  const branding = isLikelyBrandingLogoAlt(alt);
  /** Inline figures in report body can stay larger; cover logos must not dominate the page. */
  const maxW = branding ? 168 : 440;
  const maxH = branding ? 44 : 260;
  const minW = branding ? 24 : 48;
  const minH = branding ? 20 : 32;
  if (mime === "png") {
    const dim = readPngIhdrDimensions(data);
    if (dim) {
      let w = dim.w;
      let h = dim.h;
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      if (h > maxH) {
        w = Math.round((w * maxH) / h);
        h = maxH;
      }
      return { width: Math.max(minW, w), height: Math.max(minH, h) };
    }
  }
  if (branding) {
    return { width: 160, height: 40 };
  }
  return { width: 320, height: 120 };
}

/**
 * Replace `![alt](data:image/*;base64,...)` with placeholders and collect binaries for {@link ImageRun}.
 * Without this, docx would emit the base64 as plain text (broken compliance reports with inline logos).
 */
function extractDataUriMarkdownImagesForDocx(markdown: string): {
  text: string;
  images: DocxEmbedImage[];
} {
  const webpStripped = markdown.replace(
    /!\[([^\]]*)\]\(\s*data:image\/webp[^)]*\)/gi,
    (_m, alt: string) =>
      `\n\n[Image "${String(alt).replace(/"/g, "'")}" — WebP is not embedded in Word; use PNG or JPEG for branding.]\n\n`,
  );

  const images: DocxEmbedImage[] = [];

  const dataUriRe = new RegExp(
    "!\\[([^\\]]*)\\]\\(\\s*data:image\\/(png|jpeg|jpg|gif|bmp)\\s*;\\s*base64\\s*,\\s*([\\s\\S]*?)\\s*\\)",
    "gi",
  );

  const text = webpStripped.replace(
    dataUriRe,
    (full, alt: string, mimeExt: string, b64body: string) => {
      const b64 = b64body.replace(/\s/g, "");
      if (b64.length > MAX_DOCX_IMAGE_B64_CHARS) {
        return `\n\n[Image "${String(alt).replace(/"/g, "'")}" omitted — file too large for Word export.]\n\n`;
      }
      const ext = mimeExt.toLowerCase();
      const type: DocxEmbedImage["type"] =
        ext === "jpg" || ext === "jpeg"
          ? "jpg"
          : ext === "gif"
            ? "gif"
            : ext === "bmp"
              ? "bmp"
              : "png";
      try {
        const data = base64ToUint8Array(b64);
        if (data.length < 32) {
          return `\n\n[Image "${String(alt).replace(/"/g, "'")}" could not be decoded for Word export.]\n\n`;
        }
        const idx = images.length;
        images.push({ alt: String(alt), type, data });
        return `\n\n__FC_DOCX_IMG_${idx}__\n\n`;
      } catch {
        return `\n\n[Image "${String(alt).replace(/"/g, "'")}" could not be decoded for Word export.]\n\n`;
      }
    },
  );

  return { text, images };
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

function markdownToDocxElements(
  md: string,
  embeddedImages: DocxEmbedImage[] = [],
): (Paragraph | Table)[] {
  const lines = md.split("\n");
  const elements: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    const imgPh = trimmed.match(DOCX_IMG_PLACEHOLDER_LINE);
    if (imgPh) {
      const idx = Number(imgPh[1]);
      const img = embeddedImages[idx];
      if (img) {
        const { width, height } = docxImageTransformation(img.type, img.data, img.alt);
        const altSafe = (img.alt || "Image").slice(0, 120);
        elements.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 160, before: 80 },
            children: [
              new ImageRun({
                type: img.type,
                data: img.data,
                transformation: { width, height },
                altText: { name: altSafe, description: altSafe },
              }),
            ],
          }),
        );
      } else {
        elements.push(
          new Paragraph({
            children: [new TextRun({ text: "[Missing image data for Word export]" })],
          }),
        );
      }
      i++;
      continue;
    }

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
        }),
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
        }),
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
        }),
      );
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(
        new Paragraph({
          border: { bottom: { color: "999999", space: 1, style: "single" as const, size: 6 } },
          children: [new TextRun("")],
        }),
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
    const rawText = (m[2] || "")
      .replace(/<[^>]+>/g, "")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .trim();
    const id =
      m[1] ||
      rawText
        .toLowerCase()
        .replace(/[^\w]+/g, "-")
        .replace(/^-|-$/g, "") ||
      `h-${toc.length}`;
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
  options?: BuildPdfHtmlOptions,
): string {
  const titleSafe = escapeHtmlBranding(title);
  const companyName = branding?.companyName || "";
  const customerName = branding?.customerName || "";
  const companyNameSafe = escapeHtmlBranding(companyName);
  const customerNameSafe = escapeHtmlBranding(customerName);
  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const confidential = branding?.confidential ?? false;
  const theme = options?.theme ?? "light";
  const omitInteractiveChrome = options?.omitInteractiveChrome ?? false;
  const omitReportHeader = options?.omitReportHeader ?? false;
  const omitReportFooter = options?.omitReportFooter ?? false;
  const isSeHealthPdfLayout = options?.pdfLayoutProfile === SE_HEALTH_CHECK_PDF_PROFILE;
  const pdfProfileAttr = isSeHealthPdfLayout
    ? ` data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"`
    : "";
  const seHealthPdfLayoutCss = isSeHealthPdfLayout ? SE_HEALTH_CHECK_PDF_LAYOUT_CSS : "";
  /** Top-level @page — Safari often ignores orientation when @page appears only inside @media print. */
  const pagedMediaPageRule = isSeHealthPdfLayout
    ? `@page { size: 210mm 297mm; margin: 12mm 14mm 14mm 14mm; }`
    : `@page { size: 297mm 210mm; margin: 12mm 14mm 14mm 14mm; }`;
  /** Some WebKit builds only pick up @page when declared in a print-only stylesheet at the top of head. */
  const printMediaPageBlock = `<style type="text/css" media="print">\n    ${pagedMediaPageRule}\n  </style>`;

  const sophosLogoDark = `<svg viewBox="0 0 600 65" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M4.48,4.35v28.3c0,4.8,2.6,9.21,6.79,11.54l29.46,16.35.19.11,29.6-16.45c4.19-2.33,6.79-6.74,6.79-11.53V4.35H4.48ZM51.89,37.88c-2.2,1.22-4.67,1.86-7.18,1.86l-27.32-.08,15.32-8.54c1.48-.83,3.14-1.26,4.84-1.27l28.92-.09-14.57,8.13ZM51.47,23.9c-1.48.83-3.14,1.26-4.84,1.27l-28.92.09,14.57-8.13c2.2-1.22,4.67-1.86,7.18-1.86l27.32.08-15.32,8.54Z"/><g fill="#fff"><path d="M578.8,25h-46.42c-2.12,0-3.84-1.72-3.84-3.84,0-2.12,1.72-3.84,3.84-3.84h60.4s0-12.88,0-12.88h-60.4c-9.22,0-16.72,7.5-16.72,16.72,0,9.22,7.5,16.72,16.72,16.72h46.42c2.12,0,3.84,1.75,3.84,3.86,0,2.12-1.72,3.77-3.84,3.77h-60.53v12.88h60.53c9.22,0,16.72-7.42,16.72-16.64,0-9.22-7.5-16.74-16.72-16.74Z"/><path d="M228.84,4.47h-25.15c-14.89,0-27.01,12.12-27.01,27.01,0,14.89,12.12,27.01,27.01,27.01h25.15c14.89,0,27.01-12.12,27.01-27.01,0-14.89-12.12-27.01-27.01-27.01ZM228.84,45.6h-25.15c-7.78,0-14.11-6.33-14.11-14.11,0-7.78,6.33-14.11,14.11-14.11h25.15c7.78,0,14.11,6.33,14.11,14.11,0,7.78-6.33,14.11-14.11,14.11Z"/><path d="M483.22,4.47h-25.15c-14.89,0-27.01,12.12-27.01,27.01,0,14.89,12.12,27.01,27.01,27.01h25.15c14.89,0,27.01-12.12,27.01-27.01,0-14.89-12.12-27.01-27.01-27.01ZM483.22,45.6h-25.15c-7.78,0-14.11-6.33-14.11-14.11,0-7.78,6.33-14.11,14.11-14.11h25.15c7.78,0,14.11,6.33,14.11,14.11,0,7.78-6.33,14.11-14.11,14.11Z"/><polygon points="410.52 4.53 410.52 24.96 360.14 24.96 360.14 4.53 347.24 4.53 347.24 58.42 360.14 58.42 360.14 37.86 410.52 37.86 410.52 58.42 423.42 58.42 423.42 4.53 410.52 4.53"/><path d="M155.11,25h-46.42c-2.12,0-3.84-1.72-3.84-3.84,0-2.12,1.72-3.84,3.84-3.84h60.4V4.44h-60.4c-9.22,0-16.72,7.5-16.72,16.72,0,9.22,7.5,16.72,16.72,16.72h46.42c2.12,0,3.84,1.75,3.84,3.86s-1.72,3.77-3.84,3.77h-60.53v12.88s60.53,0,60.53,0c9.22,0,16.72-7.42,16.72-16.64,0-9.22-7.5-16.74-16.72-16.74Z"/><path d="M319.66,4.53h-43.49s-5.2,0-5.2,0h-7.7s0,53.89,0,53.89h12.9s0-14.44,0-14.44h43.49c10.88,0,19.73-8.85,19.73-19.73,0-10.88-8.85-19.73-19.73-19.73ZM319.66,31.08h-43.49s0-13.66,0-13.66h43.49c3.77,0,6.83,3.06,6.83,6.83,0,3.77-3.06,6.83-6.83,6.83Z"/></g></svg>`;

  const preparedBy = branding?.preparedBy || "";
  const footerText = branding?.footerText || "";
  const preparedBySafe = escapeHtmlBranding(preparedBy);
  const footerTextSafe = escapeHtmlBranding(footerText);
  const customLogo = sanitizeBrandingLogoUrl(branding?.logoUrl);
  const hideDuplicateBodyLogo = !omitReportHeader && Boolean(customLogo);

  const tocEntries = options?.omitPdfToc ? [] : extractTocFromHtml(innerHTML);
  const tocHtml =
    !options?.omitPdfToc && tocEntries.length >= 2
      ? `<nav class="pdf-toc" aria-label="Table of Contents">
  <h2 class="pdf-toc-title">Table of Contents</h2>
  <ul class="pdf-toc-list">${tocEntries
    .map((e) => `<li><a href="#${e.id}">${e.text}</a></li>`)
    .join("")}</ul>
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
<html lang="en" data-theme="${theme}"${pdfProfileAttr} data-hide-duplicate-body-logo="${hideDuplicateBodyLogo ? "true" : "false"}">
<head>
  <meta charset="utf-8">
  ${printMediaPageBlock}
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titleSafe} — ${companyNameSafe || "Sophos FireComply"}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&family=Zalando+Sans:wght@400;500;600;700;800;900&family=Zalando+Sans+Expanded:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');

    ${pagedMediaPageRule}

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
      font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Noto Color Emoji';
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

    /* innerHTML has no Tailwind — constrain images so branding logos cannot span pages */
    .print-content img {
      max-width: 100%;
      max-height: 60mm;
      height: auto;
      object-fit: contain;
    }
    .print-content img.report-pdf-brand-logo {
      max-height: 3.5rem;
      max-width: 200px;
      width: auto;
      display: block;
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
    p {
      margin: 0 0 12px;
      color: var(--text-secondary);
      line-height: 1.7;
      orphans: 3;
      widows: 3;
    }
    ul, ol { margin: 0 0 12px; padding-left: 24px; color: var(--text-secondary); }
    li { margin: 5px 0; line-height: 1.6; }
    li::marker { color: var(--text-muted); }

    /* ── Tables ── */
    .table-wrapper {
      overflow-x: auto;
      margin: 16px 0;
      border-radius: 12px;
      border: 1px solid var(--border);
      border-left: 4px solid var(--accent);
      -webkit-overflow-scrolling: touch;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 9pt;
      table-layout: fixed;
      min-width: 0;
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
      white-space: normal;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: normal;
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
      word-break: normal;
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
        font-family: 'Zalando Sans', system-ui, sans-serif !important;
        font-size: 11pt;
        line-height: 1.6;
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        page-break-after: avoid;
      }
      h2 { page-break-before: always; }
      h2:first-of-type { page-break-before: avoid; }
      .print-content { padding: 0; max-width: 100%; margin: 0; }
      .report-header {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
        padding: 14px 18px 16px !important;
        align-items: flex-start !important;
        overflow: visible !important;
      }
      .report-header .brand {
        align-items: center;
      }
      .report-header .meta {
        line-height: 1.5 !important;
        overflow: visible !important;
        padding: 2px 0;
      }
      .report-header .meta > div {
        line-height: 1.5 !important;
      }
      .theme-toggle { display: none !important; }
      .report-footer { display: none; }
      /* Header already shows MSP logo — hide only the body image, keep title/subtitle text */
      html[data-hide-duplicate-body-logo="true"] .report-pdf-brand-block img.report-pdf-brand-logo {
        display: none !important;
      }
      .report-header img.sophos-logo {
        max-height: 28px !important;
        max-width: 180px !important;
        width: auto !important;
        height: auto !important;
        object-fit: contain !important;
      }
      .print-content img {
        max-width: 100% !important;
        max-height: 120mm;
        width: auto !important;
        height: auto !important;
        object-fit: contain !important;
      }
      .print-content img.report-pdf-brand-logo {
        max-height: 48px !important;
        max-width: 200px !important;
      }
      .pdf-toc { page-break-after: always; }
      .pdf-toc-list a::after { content: " ... " target-counter(attr(href), page); }
      /* @page lives at top of this stylesheet for Safari; margins match pagedMediaPageRule */

      thead {
        display: table-header-group;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      table {
        font-size: 8pt;
        min-width: 0 !important;
        width: 100% !important;
        table-layout: fixed !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
      }
      /*
       * Medium/wide compliance-style tables: fixed layout splits width evenly and crushes long
       * evidence columns. Auto layout lets the browser allocate width from cell content.
       */
      table.pdf-table--medium,
      table.pdf-table--wide {
        table-layout: auto !important;
      }
      table:not(.pdf-table--wide):not(.pdf-table--medium) tr {
        page-break-inside: avoid;
      }
      th, td {
        padding: 4px 6px !important;
        vertical-align: top !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        word-break: normal !important;
        hyphens: manual !important;
        white-space: normal !important;
      }
      th {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
        background: #001A47 !important;
        color: #ffffff !important;
        border: 1px solid #003366 !important;
        font-weight: 600 !important;
        position: static !important;
        text-transform: none !important;
        letter-spacing: 0.02em !important;
        font-size: 7pt !important;
        line-height: 1.25 !important;
      }
      table.pdf-table--wide th {
        font-size: 6.5pt !important;
        padding: 3px 4px !important;
        line-height: 1.2 !important;
      }
      table.pdf-table--wide td {
        font-size: 6.5pt !important;
        padding: 3px 4px !important;
      }
      table.pdf-table--wide {
        font-size: 6.5pt !important;
      }
      table.pdf-table--medium th {
        font-size: 6.75pt !important;
        padding: 3px 5px !important;
        line-height: 1.22 !important;
      }
      table.pdf-table--medium td {
        font-size: 6.75pt !important;
        padding: 3px 5px !important;
      }
      table.pdf-table--medium {
        font-size: 6.75pt !important;
      }
      .pdf-table--wide tr,
      .pdf-table--medium tr {
        page-break-inside: auto !important;
      }
      /* Backticks in markdown become <code>; in dense tables the pill style reads as heavy “tags”. */
      table td code,
      table th code {
        font-family: inherit !important;
        font-size: inherit !important;
        line-height: inherit !important;
        font-weight: inherit !important;
        color: inherit !important;
        background: transparent !important;
        padding: 0 !important;
        border-radius: 0 !important;
        white-space: normal !important;
        word-break: break-word !important;
        overflow-wrap: anywhere !important;
      }
      td {
        border: 1px solid #cbd5e1 !important;
        color: #334155 !important;
      }
      tbody tr:nth-child(even) td {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
        background: #EDF2F9 !important;
      }
      tbody tr:nth-child(odd) td {
        background: #ffffff !important;
      }
      .table-wrapper {
        overflow: visible !important;
        border-radius: 12px;
        max-width: 100% !important;
        border: 1px solid #cbd5e1;
        border-left: 4px solid #2006f7 !important;
      }
    }
  </style>
</head>
<body>
  ${confidential ? '<div class="pdf-watermark no-print" aria-hidden="true">CONFIDENTIAL</div>' : ""}
  <style>.no-print { display: none; }</style>
  <style>@media print { .no-print { display: none !important; }${confidential ? " .pdf-watermark { display: block !important; }" : ""} }</style>

  ${
    omitInteractiveChrome
      ? ""
      : `<button class="theme-toggle" onclick="toggleTheme()" id="themeBtn" type="button">&#9789; Dark Mode</button>`
  }

  ${
    omitReportHeader
      ? ""
      : `<div class="report-header">
    <div class="brand">
      ${
        customLogo
          ? `<img src="${customLogo}" alt="${companyNameSafe}" style="height:32px;width:auto;max-width:180px;object-fit:contain;" class="sophos-logo" />`
          : `<span class="sophos-logo">${sophosLogoDark}</span>`
      }
      <span class="brand-divider"></span>
      <span class="brand-sub">${companyNameSafe || "FireComply"}</span>
    </div>
    <div class="meta">
      ${customerName ? `<div style="font-weight:600">${customerNameSafe}</div>` : ""}
      ${preparedBy ? `<div>Prepared by: ${preparedBySafe}</div>` : ""}
      <div>${dateStr}</div>
    </div>
  </div>`
  }

  <div class="print-content">${printContentInner}</div>

  ${
    omitReportFooter
      ? ""
      : `<div class="report-footer">
    <div>${footerTextSafe || (companyName ? `Generated by ${companyNameSafe}` : "Generated by Sophos FireComply")}</div>
    <div>${dateStr}${preparedBy ? ` &mdash; ${preparedBySafe}` : companyName ? ` &mdash; ${companyNameSafe}` : ""}</div>
  </div>`
  }

  ${
    omitInteractiveChrome
      ? ""
      : `<script>
    function toggleTheme() {
      var html = document.documentElement;
      var btn = document.getElementById('themeBtn');
      var isDark = html.getAttribute('data-theme') === 'dark';
      html.setAttribute('data-theme', isDark ? 'light' : 'dark');
      btn.innerHTML = isDark ? '&#9789; Dark Mode' : '&#9788; Light Mode';
    }
  </script>`
  }
  <script>
(function () {
  function prepPrintLayout() {
    document.querySelectorAll("table").forEach(function (t) {
      if (t.parentElement && t.parentElement.classList.contains("table-wrapper")) return;
      var w = document.createElement("div");
      w.className = "table-wrapper";
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    });

    document.querySelectorAll("table").forEach(function (t) {
      var row = t.rows[0];
      if (!row) return;
      var n = row.cells.length;
      if (n >= 10) {
        t.classList.add("pdf-table--wide");
        var wrapW = t.parentElement;
        if (wrapW && wrapW.classList.contains("table-wrapper")) wrapW.classList.add("pdf-table-wrap--wide");
      } else if (n >= 7) {
        t.classList.add("pdf-table--medium");
      }
    });

    document.querySelectorAll(".print-content h2").forEach(function (h2, i) {
      if (!h2.id) {
        var text =
          (h2.textContent || "")
            .replace(/[^\\w\\s-]/g, "")
            .trim()
            .toLowerCase()
            .replace(/\\s+/g, "-")
            .replace(/-+/g, "-") || "section-" + i;
        h2.id = text;
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", prepPrintLayout);
  } else {
    prepPrintLayout();
  }
})();
  </script>
</body>
</html>`;
}

/**
 * Open a full HTML document for printing. Prefers a blob: URL so Safari/WebKit is more likely to
 * respect `@page` size than `about:blank` + `document.write`.
 */
export function openHtmlForPrint(html: string): boolean {
  if (typeof window === "undefined") return false;

  const fallbackWrite = (): boolean => {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return false;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    window.setTimeout(() => {
      try {
        w.print();
      } catch {
        /* ignore */
      }
    }, 300);
    return true;
  };

  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      URL.revokeObjectURL(url);
      return fallbackWrite();
    }

    const cleanup = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    };
    w.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 10 * 60_000);

    const schedulePrint = () => {
      window.setTimeout(() => {
        try {
          w.focus();
          w.print();
        } catch {
          /* ignore */
        }
      }, 150);
    };

    if (w.document.readyState === "complete") {
      schedulePrint();
    } else {
      w.addEventListener("load", schedulePrint, { once: true });
    }
    return true;
  } catch {
    return fallbackWrite();
  }
}

/**
 * Load full HTML into a hidden iframe and print (when opening a new tab is undesirable).
 * Uses a blob URL first for the same `@page` behavior as {@link openHtmlForPrint}.
 */
export function printHtmlInHiddenIframe(html: string): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "FireComply print");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return false;
  }

  const removeIframe = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const fallbackWrite = (): boolean => {
    const idoc = iframe.contentDocument ?? win.document;
    try {
      idoc.open();
      idoc.write(html);
      idoc.close();
    } catch {
      removeIframe();
      return false;
    }
    win.focus();
    window.setTimeout(() => {
      try {
        win.print();
      } catch {
        /* ignore */
      }
      window.setTimeout(removeIframe, 2_000);
    }, 300);
    return true;
  };

  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const cleanup = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
      removeIframe();
    };

    let cleaned = false;
    const runCleanup = () => {
      if (cleaned) return;
      cleaned = true;
      cleanup();
    };

    iframe.addEventListener(
      "load",
      () => {
        window.setTimeout(() => {
          try {
            win.focus();
            win.print();
          } catch {
            /* ignore */
          }
          win.addEventListener("afterprint", runCleanup, { once: true });
          window.setTimeout(runCleanup, 2_000);
        }, 100);
      },
      { once: true },
    );
    iframe.src = url;
    return true;
  } catch {
    return fallbackWrite();
  }
}

// ── Word export ──

/**
 * Saved packages use HTML div anchors for in-browser scroll ({@link packageReportsToMarkdown}).
 * Word export would otherwise print the full tag line as body text.
 */
export function stripSavedReportJumpTargetDivsForWord(markdown: string): string {
  return markdown.replace(
    /^\s*<div\b[^>]*\bsaved-report-jump-target\b[^>]*>\s*<\/div>\s*\r?\n?/gim,
    "",
  );
}

/** Generate Word blob from markdown */
export async function generateWordBlob(markdown: string, branding: BrandingData): Promise<Blob> {
  const cleaned = trimIncompleteMarkdownTableTail(
    normalizeMarkdownTables(
      normalizeMarkdownEmbeddedDataImages(stripSavedReportJumpTargetDivsForWord(markdown)),
    ),
  );
  const { text: mdForDocx, images: docxImages } = extractDataUriMarkdownImagesForDocx(cleaned);

  const headerParagraphs: Paragraph[] = [];
  if (branding.companyName) {
    headerParagraphs.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: branding.companyName, bold: true, size: 36 })],
      }),
    );
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Firewall Configuration Report", color: "666666", size: 24 }),
        ],
      }),
    );
    if (branding.customerName) {
      headerParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Customer: ${branding.customerName}`, color: "333333", size: 22 }),
          ],
        }),
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
        }),
      );
    }
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            color: "999999",
            size: 18,
          }),
        ],
      }),
    );
    headerParagraphs.push(new Paragraph({ text: "" }));
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            { level: 0, format: "decimal" as const, text: "%1.", alignment: AlignmentType.START },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
          },
        },
        children: [...headerParagraphs, ...markdownToDocxElements(mdForDocx, docxImages)],
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
  branding: BrandingData,
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
  const lines = trimIncompleteMarkdownTableTail(normalizeMarkdownTables(markdown)).split("\n");
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
          })),
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
