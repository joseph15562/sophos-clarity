import { describe, expect, it } from "vitest";
import { trimIncompleteMarkdownTableTail, buildReportHtml } from "@/lib/report-html";

describe("trimIncompleteMarkdownTableTail", () => {
  it("removes last row when it has fewer pipes than the header", () => {
    const md = [
      "## Firewall Rules",
      "",
      "| h1 | h2 | h3 |",
      "| --- | --- | --- |",
      "| 18 | A | Enabled |",
      "| 19 | B | Enabled |",
      "| 20 | SE_Desks |",
    ].join("\n");
    const out = trimIncompleteMarkdownTableTail(md);
    expect(out).not.toContain("| 20 |");
    expect(out).toContain("| 19 |");
  });

  it("keeps complete tables unchanged", () => {
    const md = ["| a | b |", "| - | - |", "| 1 | 2 |"].join("\n");
    expect(trimIncompleteMarkdownTableTail(md)).toBe(md);
  });

  it("does not strip when last row matches header width", () => {
    const md = ["| x | y | z |", "| - | - | - |", "| a | b | c |"].join("\n");
    expect(trimIncompleteMarkdownTableTail(md)).toBe(md);
  });

  it("trims last table block when headings or prose follow (not EOF table)", () => {
    const md = [
      "## Firewall Rules",
      "",
      "| a | b |",
      "| - | - |",
      "| 1 | ok |",
      "| 2 | cut",
      "",
      "## Summary",
      "",
      "Narrative text.",
    ].join("\n");
    const out = trimIncompleteMarkdownTableTail(md);
    expect(out).not.toContain("| 2 | cut");
    expect(out).toContain("## Summary");
    expect(out).toContain("Narrative text.");
  });
});

describe("buildReportHtml stripIncompleteTableTail", () => {
  it("with trim, incomplete final row is not rendered as a table row", () => {
    const md = "| a | b | c |\n| - | - | - |\n| 1 | 2 | 3 |\n| cut |";
    const html = buildReportHtml(md, { stripIncompleteTableTail: true });
    expect(html).toContain("1");
    expect(html).toContain("2");
    expect(html).not.toContain("cut");
  });
});
