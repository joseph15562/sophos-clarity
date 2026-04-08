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
 * When the AI stream stops mid-row, that line often has fewer `|` than the table header. Marked
 * still emits a &lt;tr&gt; with missing cells — looks like a "broken" row. Remove at most **one**
 * trailing incomplete **data** row from the **last GFM table block** (not only when the file ends on
 * a table; the model often adds a heading after a cut-off row). We only strip a single row so we do
 * not delete many valid rows that happen to use fewer `|` than the header.
 */
export function trimIncompleteMarkdownTableTail(markdown: string): string {
  const lines = markdown.split("\n");
  let i = lines.length - 1;
  while (i >= 0 && lines[i].trim() === "") i--;
  if (i < 0) return markdown;

  // Last non-empty line might be prose; walk backward to the last contiguous `|...|` block.
  let end = i;
  while (end >= 0 && !lines[end].trim().startsWith("|")) {
    end--;
    while (end >= 0 && lines[end].trim() === "") end--;
  }
  if (end < 0 || !lines[end].trim().startsWith("|")) return markdown;

  let start = end;
  while (start > 0 && lines[start - 1].trim().startsWith("|")) start--;

  const segment = lines.slice(start, end + 1);
  if (segment.length < 2) return markdown;

  const headerTrim = segment[0].trim();
  const headerPipes = countPipes(headerTrim);
  if (headerPipes < 2) return markdown;

  let dataStart = 1;
  if (segment.length > 1 && isLikelySeparatorRow(segment[1].trim())) {
    dataStart = 2;
  }

  const working = [...segment];
  // Only remove the single last data row if it is incomplete. Some models emit valid rows with
  // fewer literal `|` than the header (merged/empty trailing cells); a multi-row loop would strip
  // many real rows and empty the firewall table.
  if (working.length > dataStart) {
    const lastTrim = working[working.length - 1].trim();
    if (!isLikelySeparatorRow(lastTrim) && countPipes(lastTrim) < headerPipes) {
      working.pop();
    }
  }

  if (working.length === segment.length) return markdown;
  return [...lines.slice(0, start), ...working, ...lines.slice(end + 1)].join("\n");
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
