/**
 * Real A4 landscape PDF bytes from firewall / compliance report markdown (pdfmake).
 * Avoids browser print orientation quirks; lazy-load pdfmake only when generating.
 */

import { marked } from "marked";
import type { Token, Tokens } from "marked";
import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { normalizeMarkdownTables, trimIncompleteMarkdownTableTail } from "@/lib/report-html";

marked.setOptions({ gfm: true, breaks: false });

const MAX_MARKDOWN_CHARS = 450_000;
const MAX_TABLE_BODY_ROWS = 200;

/** pdfmake accepts these data-URI schemes; WebP etc. stay in markdown (may print as text). */
const DATA_IMAGE_URI_RE = /^data:image\/(png|jpeg|jpg|gif);base64,/i;

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
      i = img + 2;
      continue;
    }
    const afterBracket = closeBracket + 1;
    if (afterBracket >= n || markdown[afterBracket] !== "(") {
      i = img + 2;
      continue;
    }
    const closeParen = markdown.indexOf(")", afterBracket + 1);
    if (closeParen < 0) {
      i = img + 2;
      continue;
    }
    const uri = markdown.slice(afterBracket + 1, closeParen);
    if (DATA_IMAGE_URI_RE.test(uri)) {
      const lineStart = img === 0 ? 0 : markdown.lastIndexOf("\n", img - 1) + 1;
      const beforeImg = markdown.slice(lineStart, img);
      // Only treat as a pdfmake image at line start (after spaces). Inline/table images stay in MD.
      if (/^[ \t]*$/.test(beforeImg)) {
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

function dataUriToPdfImage(uri: string): Content {
  return {
    image: uri,
    width: 200,
    maxHeight: 56,
    alignment: "left",
    margin: [0, 0, 0, 12],
  };
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

function tableToPdf(tok: Tokens.Table): Content {
  const colCount = Math.max(1, tok.header.length);
  const widths = Array.from({ length: colCount }, () => "*");

  const headerRow: TableCell[] = tok.header.map((cell) => ({
    text: inlineToRich(cell.tokens),
    style: "tableHeader",
    color: "#ffffff",
    margin: [4, 5, 4, 5],
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

  const dataRows: TableCell[][] = bodyRows.map((row) =>
    row.map((cell) => ({
      text: inlineToRich(cell.tokens),
      style: "tableCell",
      margin: [4, 4, 4, 4],
    })),
  );

  const stack: Content[] = [
    {
      table: {
        headerRows: 1,
        widths,
        body: [headerRow, ...dataRows],
      },
      layout: {
        fillColor: (rowIndex: number) => {
          if (rowIndex === 0) return "#001A47";
          return rowIndex % 2 === 0 ? "#EDF2F9" : null;
        },
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => "#cbd5e1",
        vLineColor: () => "#cbd5e1",
      },
      margin: [0, 0, 0, 10],
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
      case "paragraph":
        out.push({
          text: inlineToRich((tok as Tokens.Paragraph).tokens),
          style: "body",
          margin: [0, 0, 0, 8],
        });
        break;
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

/** Builds the pdfmake document definition (no PDF bytes). Exported for unit tests. */
export function buildMarkdownReportPdfDocDefinition(
  markdown: string,
  options: MarkdownReportPdfOptions,
): TDocumentDefinitions {
  const sliced = markdown.slice(0, MAX_MARKDOWN_CHARS);
  const pieces = splitMarkdownDataUriImages(sliced);

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
    pageMargins: [40, 48, 40, 52],
    content: body,
    styles: {
      coverTitle: {
        fontSize: 18,
        bold: true,
        color: "#001A47",
      },
      coverMeta: { fontSize: 9, color: "#64748b" },
      h1: { fontSize: 14, bold: true, color: "#001A47" },
      h2: { fontSize: 12, bold: true, color: "#001A47" },
      h3: { fontSize: 10.5, bold: true, color: "#0f172a" },
      body: { fontSize: 9, lineHeight: 1.35, color: "#334155" },
      muted: { fontSize: 8, color: "#94a3b8", italics: true },
      tableHeader: { bold: true, color: "#ffffff", fontSize: 7.5 },
      tableCell: { fontSize: 7.5, color: "#334155" },
    },
    defaultStyle: {
      font: "Roboto",
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
