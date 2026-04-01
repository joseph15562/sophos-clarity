import { describe, it, expect } from "vitest";
import { analyseRuleOptimisation } from "@/lib/rule-optimiser";
import type { ExtractedSections, SectionData, TableData } from "@/lib/extract-sections";

function buildSections(overrides: Partial<Record<string, SectionData>> = {}): ExtractedSections {
  const base: ExtractedSections = {};
  return { ...base, ...overrides } as ExtractedSections;
}

function buildFirewallRulesSection(rules: Record<string, string>[]): {
  tables: TableData[];
  text?: string;
  details?: unknown[];
} {
  const headers = rules.length > 0 ? Object.keys(rules[0]) : [];
  return { tables: [{ headers, rows: rules }], text: "", details: [] };
}

const baseRule = {
  Status: "On",
  "Source Zone": "lan",
  "Destination Zones": "wan",
  Source: "any",
  Destination: "any",
  Action: "accept",
};

describe("analyseRuleOptimisation", () => {
  it("still flags shadowing when user scope and schedule are absent on both rules", () => {
    const sections = buildSections({
      "Firewall Rules": buildFirewallRulesSection([
        { ...baseRule, "Rule Name": "broad", Service: "any" },
        { ...baseRule, "Rule Name": "narrow", Service: "http" },
      ]),
    });
    const { shadowed } = analyseRuleOptimisation(sections);
    expect(shadowed).toHaveLength(1);
    expect(shadowed[0].shadowedRule.name).toBe("narrow");
  });

  it("does not flag shadowing when source identity differs", () => {
    const sections = buildSections({
      "Firewall Rules": buildFirewallRulesSection([
        {
          ...baseRule,
          "Rule Name": "L2W_mobile_moto",
          Service: "any",
          Identity: "mobile_moto",
        },
        {
          ...baseRule,
          "Rule Name": "L2W_HTTP/S",
          Service: "http, https",
          Identity: "known_users",
        },
      ]),
    });
    const { shadowed } = analyseRuleOptimisation(sections);
    expect(shadowed).toHaveLength(0);
  });

  it("does not flag shadowing when Match known users differs", () => {
    const sections = buildSections({
      "Firewall Rules": buildFirewallRulesSection([
        {
          ...baseRule,
          "Rule Name": "A",
          Service: "any",
          "Match known users": "Enable",
        },
        {
          ...baseRule,
          "Rule Name": "B",
          Service: "http",
          "Match known users": "Disable",
        },
      ]),
    });
    const { shadowed } = analyseRuleOptimisation(sections);
    expect(shadowed).toHaveLength(0);
  });

  it("does not flag shadowing when schedules differ", () => {
    const sections = buildSections({
      "Firewall Rules": buildFirewallRulesSection([
        { ...baseRule, "Rule Name": "A", Service: "any", Schedule: "Business hours" },
        { ...baseRule, "Rule Name": "B", Service: "http", Schedule: "24x7" },
      ]),
    });
    const { shadowed } = analyseRuleOptimisation(sections);
    expect(shadowed).toHaveLength(0);
  });

  it("flags shadowing when identity and schedule match and envelope is broader", () => {
    const sections = buildSections({
      "Firewall Rules": buildFirewallRulesSection([
        {
          ...baseRule,
          "Rule Name": "broad",
          Service: "any",
          Identity: "staff",
          Schedule: "all",
        },
        {
          ...baseRule,
          "Rule Name": "narrow",
          Service: "https",
          Identity: "staff",
          Schedule: "all",
        },
      ]),
    });
    const { shadowed } = analyseRuleOptimisation(sections);
    expect(shadowed).toHaveLength(1);
  });

  it("treats rules with different identity as non-duplicates", () => {
    const sections = buildSections({
      "Firewall Rules": buildFirewallRulesSection([
        {
          ...baseRule,
          "Rule Name": "R1",
          Service: "http",
          Identity: "g1",
        },
        {
          ...baseRule,
          "Rule Name": "R2",
          Service: "http",
          Identity: "g2",
        },
      ]),
    });
    const { duplicates } = analyseRuleOptimisation(sections);
    expect(duplicates).toHaveLength(0);
  });

  it("does not suggest merge when user scope differs", () => {
    const sections = buildSections({
      "Firewall Rules": buildFirewallRulesSection([
        { ...baseRule, "Rule Name": "A", Service: "http", Identity: "g1" },
        { ...baseRule, "Rule Name": "B", Service: "https", Identity: "g2" },
      ]),
    });
    const { mergeable } = analyseRuleOptimisation(sections);
    expect(mergeable).toHaveLength(0);
  });
});
