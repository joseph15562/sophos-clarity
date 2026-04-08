/**
 * Shared helpers for rendering report markdown to HTML with table-of-contents support.
 */

import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: false });

type PurifyConfig = NonNullable<Parameters<typeof DOMPurify.sanitize>[1]>;

export const PURIFY_CONFIG: PurifyConfig = {
  ADD_TAGS: ["table", "thead", "tbody", "tr", "th", "td", "colgroup", "col"],
  FORBID_TAGS: [
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "textarea",
    "select",
  ],
  FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover", "onfocus", "onblur"],
};

/** Strips sizing the model often emits on images/SVG — it beats our CSS if left on the element. */
function stripReportMediaSizing(root: HTMLElement) {
  root.querySelectorAll("img").forEach((el) => {
    el.removeAttribute("width");
    el.removeAttribute("height");
    el.removeAttribute("style");
  });
  root.querySelectorAll("svg").forEach((el) => {
    el.removeAttribute("width");
    el.removeAttribute("height");
    el.removeAttribute("style");
  });
}

const REPORT_HTML_SANITIZE: PurifyConfig = {
  ...PURIFY_CONFIG,
  FORBID_ATTR: [...(PURIFY_CONFIG.FORBID_ATTR ?? []), "style"],
};

/**
 * Split single-line markdown tables into one line per row so marked can parse them.
 * Only split when the line contains a separator (|---|) AND at most 2 row boundaries (" | | "),
 * so we only fix concatenated header+separator+body. Do NOT split wide rows with many empty
 * cells (e.g. firewall rules), which would contain many " | | " and get broken.
 */
/** Exported for PDF / other parsers that must match {@link buildReportHtml} table handling. */
function countPipes(line: string): number {
  return (line.match(/\|/g) ?? []).length;
}

function isLikelySeparatorRow(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith("|")) return false;
  const withoutEdges = t.replace(/^\|/, "").replace(/\|\s*$/, "");
  if (!withoutEdges.includes("-")) return false;
  return /^[\s\-:|]+$/.test(withoutEdges);
}

/**
 * When the AI stream stops mid-row, the last markdown line often has fewer `|` than the table
 * header. Marked still emits a &lt;tr&gt; with missing cells — looks like a "broken" row. Drop
 * that trailing line so the table ends at the last complete row.
 */
export function trimIncompleteMarkdownTableTail(markdown: string): string {
  const lines = markdown.split("\n");
  let end = lines.length - 1;
  while (end >= 0 && lines[end].trim() === "") end--;
  if (end < 0) return markdown;

  const lastLine = lines[end].trim();
  if (!lastLine.startsWith("|")) return markdown;

  let start = end;
  while (start >= 0 && lines[start].trim().startsWith("|")) start--;
  start++;

  const tableLines = lines.slice(start, end + 1).map((l) => l.trim());
  if (tableLines.length < 2) return markdown;

  const header = tableLines[0];
  const headerPipes = countPipes(header);
  if (headerPipes < 2) return markdown;

  let dataStart = 1;
  if (tableLines.length > 1 && isLikelySeparatorRow(tableLines[1])) {
    dataStart = 2;
  }

  const dataRows = tableLines.slice(dataStart);
  if (dataRows.length === 0) return markdown;

  const lastData = dataRows[dataRows.length - 1];
  if (isLikelySeparatorRow(lastData)) return markdown;

  const lastPipes = countPipes(lastData);
  if (lastPipes < headerPipes) {
    lines.splice(end, 1);
    return lines.join("\n");
  }
  return markdown;
}

export function normalizeMarkdownTables(md: string): string {
  const rowBoundary = " | | ";
  return md
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|") || trimmed.length < 4) return line;
      const hasSeparator = /\|\s*---\s*\|/.test(trimmed);
      if (!hasSeparator || !trimmed.includes(rowBoundary)) return line;
      const parts = trimmed.split(rowBoundary);
      if (parts.length > 3) return line;
      const rows = parts.map((p) => {
        let row = p.trim();
        if (!row.startsWith("|")) row = "| " + row;
        if (!row.endsWith("|")) row = row + " |";
        return row;
      });
      return rows.join("\n");
    })
    .join("\n");
}

function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}

export function extractTocHeadings(md: string): { id: string; text: string; level: number }[] {
  const headings: { id: string; text: string; level: number }[] = [];
  const used = new Set<string>();
  for (const line of md.split("\n")) {
    const match = line.trim().match(/^(#{2,3})\s+(.*)/);
    if (match) {
      const text = match[2].replace(/\*\*/g, "").replace(/`/g, "").trim();
      let id = slugifyHeading(text);
      if (used.has(id)) {
        let n = 1;
        while (used.has(`${id}-${n}`)) n++;
        id = `${id}-${n}`;
      }
      used.add(id);
      headings.push({ id, text, level: match[1].length });
    }
  }
  return headings;
}

export type BuildReportHtmlOptions = {
  /** Optional footer line for traceability (e.g. "Generated from Sophos FireComply · N sections, M rules"). */
  footer?: string;
  /**
   * When true (default), removes a trailing table row with fewer `|` than the header (stream cut mid-row).
   * Set false while the client is still receiving streaming tokens so a row in progress is not removed.
   */
  stripIncompleteTableTail?: boolean;
};

/**
 * Convert report markdown to sanitized HTML with id attributes on h2/h3 for TOC linking.
 * Optionally appends a footer for validation metadata.
 */
export function buildReportHtml(markdown: string, options?: BuildReportHtmlOptions): string {
  if (!markdown) return "";
  let md = normalizeMarkdownTables(markdown);
  if (options?.stripIncompleteTableTail !== false) {
    md = trimIncompleteMarkdownTableTail(md);
  }
  const rawHtml = marked.parse(md, { async: false }) as string;
  const headings = extractTocHeadings(md);
  let out: string;
  if (typeof document !== "undefined") {
    const wrap = document.createElement("div");
    wrap.innerHTML = rawHtml;
    const headingEls = wrap.querySelectorAll("h2, h3");
    headingEls.forEach((el, i) => {
      if (headings[i]) el.id = headings[i].id;
    });
    stripReportMediaSizing(wrap);
    out = wrap.innerHTML;
  } else {
    out = rawHtml;
  }
  if (options?.footer?.trim()) {
    out += `<footer class="report-footer report-meta text-[10px] text-muted-foreground mt-8 pt-4 border-t border-border">${DOMPurify.sanitize(options.footer)}</footer>`;
  }
  return DOMPurify.sanitize(out, REPORT_HTML_SANITIZE) as string;
}
