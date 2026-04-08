import { describe, expect, it } from "vitest";
import {
  countFirewallRulesSectionTableDataRows,
  markdownTableFromFirewallRulesTable,
  maybeAppendFirewallRulesExportAppendix,
} from "@/lib/firewall-rules-markdown-appendix";
import type { ExtractedSections, TableData } from "@/lib/extract-sections";

describe("countFirewallRulesSectionTableDataRows", () => {
  it("returns -1 when heading is missing", () => {
    expect(countFirewallRulesSectionTableDataRows("# Title\n\nHello")).toBe(-1);
  });

  it("counts data rows after separator", () => {
    const md = [
      "## Firewall Rules",
      "",
      "| a | b |",
      "| --- | --- |",
      "| 1 | x |",
      "| 2 | y |",
      "",
      "## Summary",
    ].join("\n");
    expect(countFirewallRulesSectionTableDataRows(md)).toBe(2);
  });
});

describe("maybeAppendFirewallRulesExportAppendix", () => {
  const sections: ExtractedSections = {
    "Firewall Rules": {
      tables: [
        {
          headers: ["Rule", "Name"],
          rows: [
            { Rule: "1", Name: "A" },
            { Rule: "2", Name: "B" },
            { Rule: "3", Name: "C" },
          ],
        },
      ],
      details: [],
      text: "",
    },
  };

  it("appends when narrative table has fewer rows than export", () => {
    const md = [
      "## Firewall Rules",
      "",
      "| Rule | Name |",
      "| --- | --- |",
      "| 1 | A |",
      "",
      "## Summary",
      "Done.",
    ].join("\n");
    const out = maybeAppendFirewallRulesExportAppendix(md, sections, {
      firewallLabels: ["fw1"],
    });
    expect(out).toContain("Complete firewall rules (from configuration export)");
    expect(out).toContain("| 3 | C |");
    expect(out).toContain("lists **1** row");
  });

  it("does not append when narrative row count already matches export", () => {
    const md = [
      "## Firewall Rules",
      "",
      "| Rule | Name |",
      "| --- | --- |",
      "| 1 | A |",
      "| 2 | B |",
      "| 3 | C |",
    ].join("\n");
    const out = maybeAppendFirewallRulesExportAppendix(md, sections, { firewallLabels: ["fw1"] });
    expect(out).toBe(md);
  });
});

describe("markdownTableFromFirewallRulesTable", () => {
  it("escapes pipes in cells", () => {
    const t: TableData = {
      headers: ["A"],
      rows: [{ A: "x|y" }],
    };
    expect(markdownTableFromFirewallRulesTable(t)).toContain("x\\|y");
  });
});
