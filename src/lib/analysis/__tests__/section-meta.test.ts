import { describe, it, expect } from "vitest";
import type { ExtractedSections, SectionData } from "@/lib/extract-sections";
import { countRows, findFirewallRulesTable } from "@/lib/analysis/section-meta";

function section(overrides: Partial<SectionData> = {}): SectionData {
  return {
    tables: [],
    text: "",
    details: [],
    ...overrides,
  };
}

describe("section-meta", () => {
  describe("findFirewallRulesTable", () => {
    it("returns table for matching section", () => {
      const table = {
        headers: ["Name", "Action"],
        rows: [{ Name: "r1", Action: "Accept" }],
      };
      const sections: ExtractedSections = {
        "Firewall Rules": section({ tables: [table] }),
      };
      expect(findFirewallRulesTable(sections)).toBe(table);
    });

    it("returns null when no rules section", () => {
      const sections: ExtractedSections = {
        NAT: section({ tables: [{ headers: ["x"], rows: [] }] }),
      };
      expect(findFirewallRulesTable(sections)).toBeNull();
    });
  });

  describe("countRows", () => {
    it("counts rows matching pattern", () => {
      const sections: ExtractedSections = {
        "Web Filter Policies": section({
          tables: [
            { headers: ["Policy"], rows: [{ Policy: "A" }, { Policy: "B" }] },
          ],
        }),
        Other: section({
          tables: [{ headers: ["x"], rows: [{ x: "1" }] }],
        }),
      };
      expect(countRows(sections, /web\s*filter/i)).toBe(2);
    });

    it("excludes rows matching exclude pattern", () => {
      const sections: ExtractedSections = {
        "Web Filter Policies": section({
          tables: [{ headers: ["p"], rows: [{ p: "1" }] }],
        }),
        "Web Filter Policy Details": section({
          tables: [{ headers: ["p"], rows: [{ p: "2" }, { p: "3" }] }],
        }),
      };
      expect(
        countRows(sections, /web\s*filter/i, /details/i),
      ).toBe(1);
    });
  });
});
