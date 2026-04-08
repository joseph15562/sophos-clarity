import { describe, it, expect } from "vitest";
import {
  buildMarkdownReportPdfDocDefinition,
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
