import { describe, it, expect } from "vitest";
import {
  buildMarkdownReportPdfDocDefinition,
  normalizePdfImageMarkdownSyntax,
  splitMarkdownDataUriImages,
} from "@/lib/assessment-report-pdfmake";

const TINY_PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("assessment-report-pdfmake", () => {
  it("splitMarkdownDataUriImages extracts line-start data URIs only", () => {
    const md = `![Logo](${TINY_PNG_DATA_URI})\n\n## Hi\n`;
    const parts = splitMarkdownDataUriImages(md);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ kind: "image", uri: TINY_PNG_DATA_URI });
    expect(parts[1].kind).toBe("md");
    expect((parts[1] as { kind: "md"; text: string }).text).toContain("## Hi");
  });

  it("leaves inline data-uri markdown intact (table/paragraph safe)", () => {
    const md = `x ![L](${TINY_PNG_DATA_URI}) y`;
    const parts = splitMarkdownDataUriImages(md);
    expect(parts).toHaveLength(1);
    expect(parts[0].kind).toBe("md");
    expect((parts[0] as { kind: "md"; text: string }).text).toContain("![L]");
  });

  it("embeds line-start logo as pdfmake image, not raw markdown", () => {
    const md = `![Co](${TINY_PNG_DATA_URI})\n\n## X\n`;
    const doc = buildMarkdownReportPdfDocDefinition(md, { title: "Report" });
    const json = JSON.stringify(doc.content);
    expect(json).toContain(`"image":"${TINY_PNG_DATA_URI}"`);
    expect(json).not.toContain("![Co]");
  });

  it("normalizes broken pipe-before-paren logo lines to real markdown images", () => {
    const broken = `Company Logo|(${TINY_PNG_DATA_URI})\n\n## Section\n`;
    const fixed = normalizePdfImageMarkdownSyntax(broken);
    expect(fixed).toContain(`![Company Logo](${TINY_PNG_DATA_URI})`);
    const doc = buildMarkdownReportPdfDocDefinition(broken, { title: "Report" });
    const json = JSON.stringify(doc.content);
    expect(json).toContain(`"image":"${TINY_PNG_DATA_URI}"`);
    expect(json).not.toContain("Company Logo|(");
  });

  it("normalizes missing-bracket logo lines Company Logo](data:…) to images", () => {
    const broken = `## Firewall\n\nCompany Logo](${TINY_PNG_DATA_URI})\n\nBody\n`;
    const fixed = normalizePdfImageMarkdownSyntax(broken);
    expect(fixed).toContain(`![Company Logo](${TINY_PNG_DATA_URI})`);
    const doc = buildMarkdownReportPdfDocDefinition(broken, { title: "Report" });
    const json = JSON.stringify(doc.content);
    expect(json).toContain(`"image":"${TINY_PNG_DATA_URI}"`);
    expect(json).not.toContain("Company Logo](");
  });

  it("normalizes Company Logo](data:…) when base64 is wrapped across lines", () => {
    const b64 = TINY_PNG_DATA_URI.replace(/^data:image\/png;base64,/i, "");
    const broken = `## Sophos Wall\n\nCompany Logo](data:image/png;base64,${b64.slice(0, 8)}\n${b64.slice(8)}\n)\n\nAfter\n`;
    const fixed = normalizePdfImageMarkdownSyntax(broken);
    expect(fixed).toContain("![Company Logo](");
    expect(fixed.replace(/\s/g, "")).toContain(TINY_PNG_DATA_URI.replace(/\s/g, ""));
    const doc = buildMarkdownReportPdfDocDefinition(broken, { title: "Report" });
    const json = JSON.stringify(doc.content);
    expect(json).toContain(`"image":"${TINY_PNG_DATA_URI}"`);
  });

  it("extracts line-start images after CRLF", () => {
    const md = `\r\n![L](${TINY_PNG_DATA_URI})\r\n\r\n## Hi\r\n`;
    const parts = splitMarkdownDataUriImages(md);
    const img = parts.find((p) => p.kind === "image");
    expect(img).toEqual({ kind: "image", uri: TINY_PNG_DATA_URI });
  });

  it("renders data-uri image inside a GFM table cell", () => {
    const md = `| A | B |\n| - | - |\n| x | ![L](${TINY_PNG_DATA_URI}) |\n`;
    const doc = buildMarkdownReportPdfDocDefinition(md, { title: "T" });
    const json = JSON.stringify(doc.content);
    expect(json).toContain(`"image":"${TINY_PNG_DATA_URI}"`);
  });

  it("survives a data-URI logo larger than MAX_MARKDOWN_CHARS (500 K+ chars)", () => {
    const hugeLogo = "data:image/png;base64," + "A".repeat(500_000);
    const md = `![Company Logo](${hugeLogo})\n\n## Sophos Wall\n\nReport body text.\n`;
    const doc = buildMarkdownReportPdfDocDefinition(md, {
      title: "Firewall Assessment",
      coverLines: ["Customer: TestCo"],
    });
    const json = JSON.stringify(doc.content);
    expect(json).toContain(`"image":"${hugeLogo}"`);
    expect(json).not.toContain("Company Logo](");
    expect(json).toContain("Sophos Wall");
    expect(json).toContain("Report body text");
  });

  it("preserves ![…] as text when closeParen is missing (truncated URI)", () => {
    const truncated = `![Logo](data:image/png;base64,AAAA`;
    const parts = splitMarkdownDataUriImages(truncated);
    const text = parts.map((p) => (p as { text: string }).text ?? "").join("");
    expect(text).toContain("![Logo]");
  });

  it("table widths are all-numeric, proportional, and sum to content width", () => {
    const md = [
      "| # | Rule Name | Source | Dest | Action |",
      "| - | --------- | ------ | ---- | ------ |",
      "| 1 | Allow DNS to internal resolvers for all corporate subnets | 10.0.0.0/8 | 10.1.1.53 | Allow |",
      "| 2 | Block | Any | Any | Drop |",
    ].join("\n");
    const doc = buildMarkdownReportPdfDocDefinition(md, { title: "T" });
    const json = JSON.stringify(doc.content);
    const widthsMatch = json.match(/"widths":\[([^\]]+)\]/);
    expect(widthsMatch).toBeTruthy();
    const widths = JSON.parse(`[${widthsMatch![1]}]`) as number[];
    expect(widths.every((w) => typeof w === "number")).toBe(true);
    // "#" column must be significantly narrower than "Rule Name"
    expect(widths[0]).toBeLessThan(widths[1]);
    // Widths must sum to landscape content width (~794)
    const total = widths.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(790);
    expect(total).toBeLessThanOrEqual(800);
  });

  it("wide tables (14+ columns) use 5 pt font and all columns are present", () => {
    const cols = Array.from({ length: 16 }, (_, i) => `Col${i}`);
    const sep = cols.map(() => "---");
    const row = cols.map((_, i) => `val${i}`);
    const md = `| ${cols.join(" | ")} |\n| ${sep.join(" | ")} |\n| ${row.join(" | ")} |`;
    const doc = buildMarkdownReportPdfDocDefinition(md, { title: "T" });
    const json = JSON.stringify(doc.content);
    expect(json).toContain('"fontSize":5');
    const widthsMatch = json.match(/"widths":\[([^\]]+)\]/);
    expect(widthsMatch).toBeTruthy();
    const widths = JSON.parse(`[${widthsMatch![1]}]`) as number[];
    expect(widths).toHaveLength(16);
    // Total must match content width exactly
    expect(widths.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(790);
  });

  it("builds an A4 landscape definition with headings, table, and list", () => {
    const md = `## Section\n\n| ID | Note |\n| -- | ---- |\n| A1 | Test |\n\n- One\n- Two\n\n**Bold** text.`;
    const doc = buildMarkdownReportPdfDocDefinition(md, {
      title: "Test report",
      coverLines: ["Customer: X"],
    });
    expect(doc.pageOrientation).toBe("landscape");
    expect(doc.pageSize).toBe("A4");
    const json = JSON.stringify(doc.content);
    expect(json).toContain("Test report");
    expect(json).toContain("Customer: X");
    expect(json).toContain("Section");
    expect(json).toContain("A1");
  });
});
