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

/**
 * Split single-line markdown tables into one line per row so marked can parse them.
 * Only split when the line contains a separator (|---|) AND at most 2 row boundaries (" | | "),
 * so we only fix concatenated header+separator+body. Do NOT split wide rows with many empty
 * cells (e.g. firewall rules), which would contain many " | | " and get broken.
 */
function normalizeMarkdownTables(md: string): string {
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
};

/**
 * Convert report markdown to sanitized HTML with id attributes on h2/h3 for TOC linking.
 * Optionally appends a footer for validation metadata.
 */
export function buildReportHtml(markdown: string, options?: BuildReportHtmlOptions): string {
  if (!markdown) return "";
  const normalized = normalizeMarkdownTables(markdown);
  const rawHtml = marked.parse(normalized, { async: false }) as string;
  const headings = extractTocHeadings(markdown);
  let out: string;
  if (headings.length > 0 && typeof document !== "undefined") {
    const wrap = document.createElement("div");
    wrap.innerHTML = rawHtml;
    const headingEls = wrap.querySelectorAll("h2, h3");
    headingEls.forEach((el, i) => {
      if (headings[i]) el.id = headings[i].id;
    });
    out = wrap.innerHTML;
  } else {
    out = rawHtml;
  }
  if (options?.footer?.trim()) {
    out += `<footer class="report-footer report-meta text-[10px] text-muted-foreground mt-8 pt-4 border-t border-border">${DOMPurify.sanitize(options.footer)}</footer>`;
  }
  return DOMPurify.sanitize(out, PURIFY_CONFIG) as string;
}
