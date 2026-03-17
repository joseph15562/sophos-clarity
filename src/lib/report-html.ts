/**
 * Shared helpers for rendering report markdown to HTML with table-of-contents support.
 */

import { marked } from "marked";
import DOMPurify from "dompurify";

function slugifyHeading(text: string): string {
  return text.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "section";
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

/**
 * Convert report markdown to sanitized HTML with id attributes on h2/h3 for TOC linking.
 */
export function buildReportHtml(markdown: string): string {
  if (!markdown) return "";
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  const headings = extractTocHeadings(markdown);
  if (headings.length > 0 && typeof document !== "undefined") {
    const wrap = document.createElement("div");
    wrap.innerHTML = rawHtml;
    const headingEls = wrap.querySelectorAll("h2, h3");
    headingEls.forEach((el, i) => {
      if (headings[i]) el.id = headings[i].id;
    });
    return DOMPurify.sanitize(wrap.innerHTML);
  }
  return DOMPurify.sanitize(rawHtml);
}
