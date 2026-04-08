/**
 * Real A4 landscape PDF bytes from firewall / compliance report markdown (pdfmake).
 * Avoids browser print orientation quirks; lazy-load pdfmake only when generating.
 */

import { marked } from "marked";
import type { Token, Tokens } from "marked";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { normalizeMarkdownEmbeddedDataImages } from "@/lib/markdown-data-uri-normalize";
import { normalizeMarkdownTables, trimIncompleteMarkdownTableTail } from "@/lib/report-html";

marked.setOptions({ gfm: true, breaks: false });

export {
  normalizeMarkdownEmbeddedDataImages,
  normalizePdfImageMarkdownSyntax,
} from "@/lib/markdown-data-uri-normalize";

const MAX_MARKDOWN_CHARS = 450_000;
const MAX_TABLE_BODY_ROWS = 200;

/** pdfmake accepts these data-URI schemes; WebP etc. stay in markdown (may print as text). */
const DATA_IMAGE_URI_RE = /^data:image\/(png|jpeg|jpg|gif);base64,/i;

/** Only whitespace / BOM / NBSP before a line-start image (handles CRLF and full-width space). */
function isOnlyLeadingWhitespaceBeforeImage(prefix: string): boolean {
  return !/[^\s\uFEFF\u00A0]/.test(prefix);
}

export type MarkdownOrDataUriImage = { kind: "md"; text: string } | { kind: "image"; uri: string };

/**
 * Split markdown so `![alt](data:image/png;base64,...)` (arbitrary length) can be rendered with
 * pdfmake `{ image }`. marked + our inline walker drop/ignore image tokens, and huge URLs may not
 * tokenize as images — leaving raw `![]()` in the PDF.
 */
export function splitMarkdownDataUriImages(markdown: string): MarkdownOrDataUriImage[] {
  const parts: MarkdownOrDataUriImage[] = [];
  let i = 0;
  const n = markdown.length;

  const pushMd = (start: number, end: number) => {
    if (end > start) parts.push({ kind: "md", text: markdown.slice(start, end) });
  };

  while (i < n) {
    const img = markdown.indexOf("![", i);
    if (img < 0) {
      pushMd(i, n);
      break;
    }
    pushMd(i, img);
    const closeBracket = markdown.indexOf("]", img + 2);
    if (closeBracket < 0) {
      pushMd(img, img + 2);
      i = img + 2;
      continue;
    }
    const afterBracket = closeBracket + 1;
    if (afterBracket >= n || markdown[afterBracket] !== "(") {
      pushMd(img, img + 2);
      i = img + 2;
      continue;
    }
    const closeParen = markdown.indexOf(")", afterBracket + 1);
    if (closeParen < 0) {
      // No closing `)` anywhere — push everything remaining as text
      pushMd(img, n);
      i = n;
      continue;
    }
    const uri = markdown.slice(afterBracket + 1, closeParen);
    if (DATA_IMAGE_URI_RE.test(uri)) {
      const lineStart =
        img === 0
          ? 0
          : Math.max(markdown.lastIndexOf("\n", img - 1), markdown.lastIndexOf("\r", img - 1)) + 1;
      const beforeImg = markdown.slice(lineStart, img);
      // Only treat as a pdfmake image at line start (after spaces). Inline/table images stay in MD.
      if (isOnlyLeadingWhitespaceBeforeImage(beforeImg)) {
        parts.push({ kind: "image", uri });
        i = closeParen + 1;
      } else {
        pushMd(img, closeParen + 1);
        i = closeParen + 1;
      }
    } else {
      pushMd(img, closeParen + 1);
      i = closeParen + 1;
    }
  }

  const merged: MarkdownOrDataUriImage[] = [];
  for (const p of parts) {
    if (p.kind === "md" && p.text === "") continue;
    const last = merged[merged.length - 1];
    if (p.kind === "md" && last?.kind === "md") {
      last.text += p.text;
    } else {
      merged.push(p.kind === "md" ? { kind: "md", text: p.text } : { kind: "image", uri: p.uri });
    }
  }
  return merged;
}

function dataUriToPdfImage(uri: string, compact?: boolean): Content {
  if (compact) {
    return {
      image: uri,
      width: 140,
      maxHeight: 40,
      alignment: "left",
      margin: [0, 2, 0, 4],
    };
  }
  return {
    image: uri,
    width: 200,
    maxHeight: 56,
    alignment: "left",
    margin: [0, 0, 0, 12],
  };
}

/** Paragraph / table cell: emit data-URI images instead of dropping image/link tokens in inlineToRich. */
function tokensToFlowContent(tokens: Token[] | undefined, compactImage: boolean): Content {
  if (!tokens?.length) return " ";
  const hasDataImage = tokens.some((t) => {
    if (t.type === "image") return DATA_IMAGE_URI_RE.test((t as Tokens.Image).href ?? "");
    if (t.type === "link") return DATA_IMAGE_URI_RE.test((t as Tokens.Link).href ?? "");
    return false;
  });
  if (!hasDataImage) return inlineToRich(tokens);

  const stack: Content[] = [];
  for (const t of tokens) {
    if (t.type === "image") {
      const href = (t as Tokens.Image).href ?? "";
      if (DATA_IMAGE_URI_RE.test(href)) {
        stack.push(dataUriToPdfImage(href, compactImage));
      }
      continue;
    }
    if (t.type === "link") {
      const href = (t as Tokens.Link).href ?? "";
      if (DATA_IMAGE_URI_RE.test(href)) {
        stack.push(dataUriToPdfImage(href, compactImage));
      } else {
        const frag = inlineToRich([t]);
        if (frag !== " ") stack.push({ text: frag });
      }
      continue;
    }
    const frag = inlineToRich([t]);
    if (frag !== " ") stack.push({ text: frag });
  }
  if (stack.length === 0) return " ";
  if (stack.length === 1) return stack[0];
  return { stack };
}

export type MarkdownReportPdfOptions = {
  title: string;
  /** e.g. customer name, company, date — shown under title */
  coverLines?: string[];
};

function inlinePlain(tokens: Token[] | undefined): string {
  if (!tokens?.length) return "";
  let s = "";
  for (const t of tokens) {
    switch (t.type) {
      case "text":
      case "escape":
        s += (t as Tokens.Text).text;
        break;
      case "strong":
        s += inlinePlain((t as Tokens.Strong).tokens);
        break;
      case "em":
        s += inlinePlain((t as Tokens.Em).tokens);
        break;
      case "codespan":
        s += (t as Tokens.Codespan).text;
        break;
      case "link":
        s += inlinePlain((t as Tokens.Link).tokens);
        break;
      case "br":
        s += " ";
        break;
      case "del":
        s += inlinePlain((t as Tokens.Del).tokens);
        break;
      default:
        break;
    }
  }
  return s;
}

function inlineToRich(tokens: Token[] | undefined): Content {
  if (!tokens?.length) return " ";
  const parts: Record<string, unknown>[] = [];
  const walk = (ts: Token[]) => {
    for (const t of ts) {
      switch (t.type) {
        case "text":
        case "escape":
          parts.push({ text: (t as Tokens.Text).text });
          break;
        case "strong":
          parts.push({ text: inlinePlain((t as Tokens.Strong).tokens), bold: true });
          break;
        case "em":
          parts.push({ text: inlinePlain((t as Tokens.Em).tokens), italics: true });
          break;
        case "codespan":
          parts.push({
            text: (t as Tokens.Codespan).text,
            fontSize: 7.5,
            color: "#334155",
          });
          break;
        case "link":
          parts.push({
            text: inlinePlain((t as Tokens.Link).tokens),
            color: "#2006F7",
            decoration: "underline",
          });
          break;
        case "br":
          parts.push({ text: " ", fontSize: 6 });
          break;
        case "del":
          parts.push({ text: inlinePlain((t as Tokens.Del).tokens), decoration: "lineThrough" });
          break;
        default:
          break;
      }
    }
  };
  walk(tokens);
  if (parts.length === 0) return " ";
  if (
    parts.length === 1 &&
    typeof parts[0].text === "string" &&
    Object.keys(parts[0]).length === 1
  ) {
    return parts[0].text as string;
  }
  return parts as unknown as Content;
}

function blockToPlain(token: Token): string {
  switch (token.type) {
    case "paragraph":
      return inlinePlain((token as Tokens.Paragraph).tokens);
    case "heading":
      return inlinePlain((token as Tokens.Heading).tokens);
    case "code":
      return (token as Tokens.Code).text;
    default:
      return "";
  }
}

function listItemPlain(item: Tokens.ListItem): string {
  const prefix = item.task ? (item.checked ? "[x] " : "[ ] ") : "";
  const body = item.tokens
    .map((t) => blockToPlain(t))
    .filter(Boolean)
    .join("\n");
  const text = body.trim() || item.text.trim();
  return prefix + text;
}

// A4 landscape: 841.89 pt wide. Margins [24, 36, 24, 40] → content width ~794 pt.
const PAGE_MARGIN_H = 24;
const LANDSCAPE_CONTENT_WIDTH = 842 - PAGE_MARGIN_H * 2; // ~794
const SAMPLE_ROWS = 30;
const MAX_CHARS_CAP = 24;

const ZWS = "\u200B";

/** Insert zero-width spaces after _, commas, slashes, and dots so pdfmake
 *  wraps at logical boundaries instead of splitting words mid-character. */
function softBreakCellText(s: string): string {
  return s.replace(/([_,/.:])/g, `$1${ZWS}`);
}

/** Sizing tiers — font, padding, and char-width all shrink with column count. */
function tableSizingForCols(colCount: number) {
  if (colCount <= 4)
    return {
      fontSize: 7.5,
      headerFontSize: 7.5,
      hPad: 4,
      vPad: 3,
      headerVPad: 4,
      charWidth: 4.2,
      minCol: 28,
    };
  if (colCount <= 6)
    return {
      fontSize: 7,
      headerFontSize: 7,
      hPad: 3,
      vPad: 3,
      headerVPad: 3,
      charWidth: 3.9,
      minCol: 24,
    };
  if (colCount <= 9)
    return {
      fontSize: 6,
      headerFontSize: 6,
      hPad: 2,
      vPad: 2,
      headerVPad: 2,
      charWidth: 3.3,
      minCol: 20,
    };
  if (colCount <= 12)
    return {
      fontSize: 5.5,
      headerFontSize: 5.5,
      hPad: 2,
      vPad: 2,
      headerVPad: 2,
      charWidth: 3.0,
      minCol: 18,
    };
  // 13+ columns — very dense
  return {
    fontSize: 5,
    headerFontSize: 5,
    hPad: 1,
    vPad: 1,
    headerVPad: 2,
    charWidth: 2.7,
    minCol: 14,
  };
}

/**
 * All-numeric column widths that sum to exactly the content width.
 * Measures capped text lengths, builds proportional weights, then distributes
 * the full page width so every column is accounted for — no `"*"` wildcards
 * that let pdfmake miscalculate borders.
 */
function computeColumnWidths(
  header: Tokens.TableCell[],
  rows: Tokens.TableCell[][],
  sizing: ReturnType<typeof tableSizingForCols>,
): number[] {
  const colCount = header.length;
  if (colCount === 0) return [];
  if (colCount === 1) return [LANDSCAPE_CONTENT_WIDTH];

  const sample = rows.slice(0, SAMPLE_ROWS);
  const cellHPad = sizing.hPad * 2;

  const maxChars: number[] = header.map((h, i) => {
    let max = inlinePlain(h.tokens).length;
    for (const row of sample) {
      if (row[i]) max = Math.max(max, inlinePlain(row[i].tokens).length);
    }
    return Math.min(max, MAX_CHARS_CAP);
  });

  // Desired width per column = text width + internal padding
  const desired = maxChars.map((ch) => Math.max(sizing.minCol, ch * sizing.charWidth + cellHPad));
  const totalDesired = desired.reduce((a, b) => a + b, 0);

  // Scale so the total fills exactly the content width
  const scale = LANDSCAPE_CONTENT_WIDTH / totalDesired;
  const scaled = desired.map((w) => Math.max(sizing.minCol, w * scale));

  // Integer-round and fix off-by-one so the sum is exactly LANDSCAPE_CONTENT_WIDTH
  const rounded = scaled.map((w) => Math.round(w));
  let diff = LANDSCAPE_CONTENT_WIDTH - rounded.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0 && i < rounded.length; i++) {
    if (diff > 0) {
      rounded[i]++;
      diff--;
    } else if (rounded[i] > sizing.minCol) {
      rounded[i]--;
      diff++;
    }
  }
  return rounded;
}

function tableToPdf(tok: Tokens.Table): Content {
  const colCount = Math.max(1, tok.header.length);
  const sizing = tableSizingForCols(colCount);

  const headerRow: TableCell[] = tok.header.map((cell) => ({
    text: softBreakCellText(inlinePlain(cell.tokens)),
    style: "tableHeader",
    fontSize: sizing.headerFontSize,
    color: "#ffffff",
    margin: [sizing.hPad, sizing.headerVPad, sizing.hPad, sizing.headerVPad] as [
      number,
      number,
      number,
      number,
    ],
  }));

  let bodyRows = tok.rows;
  let truncatedNote: Content | null = null;
  if (bodyRows.length > MAX_TABLE_BODY_ROWS) {
    bodyRows = bodyRows.slice(0, MAX_TABLE_BODY_ROWS);
    truncatedNote = {
      text: `… ${tok.rows.length - MAX_TABLE_BODY_ROWS} more table rows omitted for PDF size.`,
      style: "muted",
      margin: [0, 4, 0, 8],
    };
  }

  const widths = computeColumnWidths(tok.header, bodyRows, sizing);

  const dataRows: TableCell[][] = bodyRows.map((row) =>
    row.map((cell) => ({
      text: softBreakCellText(inlinePlain(cell.tokens)),
      style: "tableCell",
      fontSize: sizing.fontSize,
      margin: [sizing.hPad, sizing.vPad, sizing.hPad, sizing.vPad] as [
        number,
        number,
        number,
        number,
      ],
    })),
  );

  const isFirstRow = (ri: number) => ri === 0;

  const stack: Content[] = [
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths,
        body: [headerRow, ...dataRows],
      },
      layout: {
        fillColor: (rowIndex: number) => {
          if (isFirstRow(rowIndex)) return "#0f1d3d";
          return rowIndex % 2 === 0 ? "#f0f4f8" : "#ffffff";
        },
        hLineWidth: (lineIdx: number, _node: unknown) => {
          if (lineIdx === 0 || lineIdx === 1) return 0;
          return 0.25;
        },
        vLineWidth: () => 0,
        hLineColor: () => "#e2e8f0",
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      margin: [0, 0, 0, 12],
    },
  ];
  if (truncatedNote) stack.push(truncatedNote);
  return { stack };
}

function blocksToContent(tokens: Token[]): Content[] {
  const out: Content[] = [];
  for (const tok of tokens) {
    switch (tok.type) {
      case "space":
        break;
      case "heading": {
        const h = tok as Tokens.Heading;
        const text = inlineToRich(h.tokens);
        const style = h.depth <= 1 ? "h1" : h.depth === 2 ? "h2" : "h3";
        out.push({ text, style, margin: [0, h.depth <= 2 ? 14 : 10, 0, 6] });
        break;
      }
      case "paragraph": {
        const flow = tokensToFlowContent((tok as Tokens.Paragraph).tokens, false);
        const margin: [number, number, number, number] = [0, 0, 0, 8];
        if (typeof flow === "string") {
          out.push({ text: flow, style: "body", margin });
        } else {
          const stack =
            typeof flow === "object" &&
            flow !== null &&
            "stack" in flow &&
            Array.isArray((flow as { stack: Content[] }).stack)
              ? (flow as { stack: Content[] }).stack
              : [flow];
          out.push({ stack, style: "body", margin });
        }
        break;
      }
      case "list": {
        const list = tok as Tokens.List;
        const items = list.items.map((item) => listItemPlain(item));
        if (list.ordered) {
          out.push({
            ol: items,
            style: "body",
            margin: [0, 0, 0, 10],
            fontSize: 9,
          });
        } else {
          out.push({
            ul: items,
            style: "body",
            margin: [0, 0, 0, 10],
            fontSize: 9,
          });
        }
        break;
      }
      case "table":
        out.push(tableToPdf(tok as Tokens.Table));
        break;
      case "code": {
        const c = tok as Tokens.Code;
        out.push({
          table: {
            widths: ["*"],
            body: [
              [
                {
                  text: c.text,
                  fontSize: 7.5,
                  color: "#0f172a",
                  margin: [10, 10, 10, 10],
                },
              ],
            ],
          },
          layout: "noBorders",
          fillColor: "#f1f5f9",
          margin: [0, 0, 0, 12],
        });
        break;
      }
      case "blockquote": {
        const b = tok as Tokens.Blockquote;
        const inner = blocksToContent(b.tokens);
        out.push({
          stack: inner,
          margin: [12, 4, 12, 10],
          italics: true,
          color: "#475569",
        });
        break;
      }
      case "hr":
        out.push({
          canvas: [
            { type: "line", x1: 0, y1: 0, x2: 720, y2: 0, lineWidth: 0.75, lineColor: "#cbd5e1" },
          ],
          margin: [0, 10, 0, 14],
        });
        break;
      default:
        break;
    }
  }
  return out;
}

export type PdfFontConfig = {
  bodyFont?: string;
  headingFont?: string;
};

/** Builds the pdfmake document definition (no PDF bytes). Exported for unit tests. */
export function buildMarkdownReportPdfDocDefinition(
  markdown: string,
  options: MarkdownReportPdfOptions,
  fontCfg?: PdfFontConfig,
): TDocumentDefinitions {
  const bodyFont = fontCfg?.bodyFont ?? "Roboto";
  const headingFont = fontCfg?.headingFont ?? bodyFont;
  const normalized = normalizeMarkdownEmbeddedDataImages(markdown);
  const rawPieces = splitMarkdownDataUriImages(normalized);

  // Truncate only markdown text — data-URI images (which can be 500 K+ chars for a PNG logo)
  // must not be sliced in half or the closing `)` is lost and the image renders as raw text.
  let charBudget = MAX_MARKDOWN_CHARS;
  const pieces: MarkdownOrDataUriImage[] = [];
  for (const p of rawPieces) {
    if (p.kind === "image") {
      pieces.push(p);
    } else {
      if (charBudget <= 0) break;
      const text = p.text.slice(0, charBudget);
      charBudget -= text.length;
      pieces.push({ kind: "md", text });
    }
  }

  const cover: Content[] = [
    { text: options.title, style: "coverTitle" },
    ...(options.coverLines?.filter(Boolean).map((line) => ({
      text: line,
      style: "coverMeta",
      margin: [0, 2, 0, 0] as [number, number, number, number],
    })) ?? []),
    { text: " ", margin: [0, 0, 0, 16] },
  ];

  let idx = 0;
  const body: Content[] = [];
  while (idx < pieces.length && pieces[idx].kind === "image") {
    body.push(dataUriToPdfImage((pieces[idx] as { kind: "image"; uri: string }).uri));
    idx++;
  }

  let coverInserted = false;
  for (; idx < pieces.length; idx++) {
    const part = pieces[idx];
    if (!coverInserted && part.kind === "md" && part.text.trim().length > 0) {
      body.push(...cover);
      coverInserted = true;
    }
    if (part.kind === "image") {
      body.push(dataUriToPdfImage(part.uri));
    } else {
      const normalized = trimIncompleteMarkdownTableTail(normalizeMarkdownTables(part.text));
      if (normalized.trim().length > 0) {
        body.push(...blocksToContent(marked.lexer(normalized) as Token[]));
      }
    }
  }
  if (!coverInserted) {
    body.push(...cover);
  }

  return {
    info: { title: options.title },
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [PAGE_MARGIN_H, 36, PAGE_MARGIN_H, 40],
    content: body,
    styles: {
      coverTitle: {
        font: headingFont,
        fontSize: 18,
        bold: true,
        color: "#001A47",
      },
      coverMeta: { fontSize: 9, color: "#64748b" },
      h1: { font: headingFont, fontSize: 14, bold: true, color: "#001A47" },
      h2: { font: headingFont, fontSize: 12, bold: true, color: "#001A47" },
      h3: { font: headingFont, fontSize: 10.5, bold: true, color: "#0f172a" },
      body: { fontSize: 9, lineHeight: 1.35, color: "#334155" },
      muted: { fontSize: 8, color: "#94a3b8", italics: true },
      tableHeader: { bold: true, color: "#ffffff" },
      tableCell: { color: "#334155" },
    },
    defaultStyle: {
      font: bodyFont,
      fontSize: 9,
      lineHeight: 1.35,
    },
    footer: (currentPage, pageCount) => ({
      text: `Sophos FireComply · Page ${currentPage} of ${pageCount}`,
      alignment: "center",
      fontSize: 7,
      color: "#94a3b8",
      margin: [0, 8, 0, 0],
    }),
  };
}

/**
 * Build a landscape PDF blob from report markdown. Throws if markdown is empty.
 */
export async function generateMarkdownReportPdfBlob(
  markdown: string,
  options: MarkdownReportPdfOptions,
): Promise<Blob> {
  const md = markdown?.trim();
  if (!md) throw new Error("Report is empty");

  const [{ default: pdfMake }, pdfVfsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfVfs = pdfVfsMod.default as Record<string, string>;
  const pm = pdfMake as typeof pdfMake & { vfs: Record<string, string> };
  pm.vfs = pdfVfs;

  const docDef = buildMarkdownReportPdfDocDefinition(md, options);
  const pdfDoc = pdfMake.createPdf(docDef) as { getBlob: () => Promise<Blob> };
  return pdfDoc.getBlob();
}
