import { describe, it, expect } from "vitest";
import { buildReportHtml, PURIFY_CONFIG } from "@/lib/report-html";

describe("buildReportHtml – XSS sanitization", () => {
  it("strips script tags from markdown containing raw HTML", () => {
    const md = '## Summary\n\nHello <script>alert("xss")</script> world';
    const html = buildReportHtml(md);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert");
    expect(html).toContain("Hello");
    expect(html).toContain("world");
  });

  it("strips iframe tags injected in markdown", () => {
    const md = '## Report\n\n<iframe src="https://evil.com"></iframe>';
    const html = buildReportHtml(md);
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("evil.com");
  });

  it("strips event handler attributes from HTML elements", () => {
    const md = '## Report\n\n<img src="x" onerror="alert(1)">';
    const html = buildReportHtml(md);
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert");
  });

  it("strips form and input elements", () => {
    const md = '## Report\n\n<form action="/steal"><input type="text" name="token"></form>';
    const html = buildReportHtml(md);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("/steal");
  });

  it("strips style tags that could hijack page appearance", () => {
    const md = "## Report\n\n<style>body { display: none }</style>";
    const html = buildReportHtml(md);
    expect(html).not.toContain("<style");
    expect(html).not.toContain("display: none");
  });

  it("preserves safe markdown rendering (headings, bold, lists)", () => {
    const md =
      "## Firewall Review\n\n**Critical:** 3 findings\n\n- Rule overlap\n- No IPS\n- Logging disabled";
    const html = buildReportHtml(md);
    expect(html).toContain("<h2");
    expect(html).toContain("Firewall Review");
    expect(html).toContain("<strong>Critical:</strong>");
    expect(html).toContain("<li>Rule overlap</li>");
  });

  it("preserves markdown tables (ADD_TAGS in config)", () => {
    const md = "## Rules\n\n| Name | Action |\n|------|--------|\n| Allow-All | Accept |";
    const html = buildReportHtml(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<thead>");
    expect(html).toContain("<th>Name</th>");
    expect(html).toContain("<td>Allow-All</td>");
  });

  it("appends a sanitized footer when provided", () => {
    const md = "## Summary\n\nAll clear.";
    const html = buildReportHtml(md, {
      footer: "Generated · 5 sections <script>alert(1)</script>",
    });
    expect(html).toContain("<footer");
    expect(html).toContain("5 sections");
    expect(html).not.toContain("<script>");
  });

  it("strips img width, height, and style so report CSS can constrain display size", () => {
    const md =
      '## Cover\n\n<img src="https://example.com/x.png" width="2000" height="2000" style="width:100%">';
    const html = buildReportHtml(md);
    expect(html).toContain("<img");
    expect(html).not.toContain('width="2000"');
    expect(html).not.toContain('height="2000"');
    expect(html).not.toContain("style=");
  });

  it("repairs Company Logo](data:image… before parse so preview is an img, not raw base64 text", () => {
    const tiny =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const md = `## Sophos Wall\n\nCompany Logo](${tiny})\n`;
    const html = buildReportHtml(md);
    expect(html).toContain("<img");
    expect(html).toContain("src=");
    expect(html).not.toContain("Company Logo](");
  });

  it("returns empty string for empty input", () => {
    expect(buildReportHtml("")).toBe("");
  });

  it("PURIFY_CONFIG explicitly forbids dangerous tags", () => {
    expect(PURIFY_CONFIG.FORBID_TAGS).toContain("script");
    expect(PURIFY_CONFIG.FORBID_TAGS).toContain("iframe");
    expect(PURIFY_CONFIG.FORBID_TAGS).toContain("object");
    expect(PURIFY_CONFIG.FORBID_TAGS).toContain("embed");
    expect(PURIFY_CONFIG.FORBID_TAGS).toContain("form");
  });
});
