import { describe, it, expect } from "vitest";
import { buildMarkdownReportPdfDocDefinition } from "@/lib/assessment-report-pdfmake";

describe("assessment-report-pdfmake", () => {
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
