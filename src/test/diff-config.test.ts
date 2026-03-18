import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { extractSections } from "@/lib/extract-sections";
import { diffConfigs } from "@/lib/diff-config";

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, "fixtures", name), "utf-8");
}

describe("diffConfigs", () => {
  const html = loadFixture("basic-firewall.html");
  let sections: Awaited<ReturnType<typeof extractSections>>;

  beforeAll(async () => {
    sections = await extractSections(html);
  });

  it("reports no changes when comparing identical configs", () => {
    const result = diffConfigs(sections, sections);
    expect(result.summary.sectionsModified).toBe(0);
    expect(result.summary.sectionsAdded).toBe(0);
    expect(result.summary.sectionsRemoved).toBe(0);
    expect(result.summary.totalRowsAdded).toBe(0);
    expect(result.summary.totalRowsRemoved).toBe(0);
    expect(result.summary.totalRowsModified).toBe(0);
    expect(result.summary.sectionsUnchanged).toBe(result.sections.length);
  });

  it("detects an added section", () => {
    const modified = { ...sections, "New Section": { tables: [{ headers: ["A"], rows: [{ A: "1" }] }], text: "", details: [] } };
    const result = diffConfigs(sections, modified);
    expect(result.summary.sectionsAdded).toBe(1);
    const added = result.sections.find((s) => s.name === "New Section");
    expect(added).toBeDefined();
    expect(added!.status).toBe("added");
  });

  it("detects a removed section", () => {
    const trimmed = { ...sections };
    const firstKey = Object.keys(trimmed)[0];
    delete trimmed[firstKey];
    const result = diffConfigs(sections, trimmed);
    expect(result.summary.sectionsRemoved).toBe(1);
    const removed = result.sections.find((s) => s.name === firstKey);
    expect(removed).toBeDefined();
    expect(removed!.status).toBe("removed");
  });

  it("detects modified rows within a section", () => {
    const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k))!;
    const modified = JSON.parse(JSON.stringify(sections));
    modified[fwKey].tables[0].rows[0]["Web Filter"] = "Strict Policy";
    const result = diffConfigs(sections, modified);
    expect(result.summary.sectionsModified).toBeGreaterThanOrEqual(1);
    expect(result.summary.totalRowsModified).toBeGreaterThanOrEqual(1);
  });

  it("detects added and removed rows", () => {
    const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k))!;
    const modified = JSON.parse(JSON.stringify(sections));
    modified[fwKey].tables[0].rows.pop();
    modified[fwKey].tables[0].rows.push({
      "#": "99", "Rule Name": "New-Rule", "Source Zone": "LAN",
      "Source Networks": "Any", "Destination Zone": "WAN",
      "Destination Networks": "Any", "Service": "SSH", "Action": "Allow",
      "Web Filter": "None", "Log": "Enabled", "IPS": "None", "Application Control": "None",
    });
    const result = diffConfigs(sections, modified);
    expect(result.summary.totalRowsAdded).toBeGreaterThanOrEqual(1);
    expect(result.summary.totalRowsRemoved).toBeGreaterThanOrEqual(1);
  });

  it("sorts sections with changes first", () => {
    const modified = JSON.parse(JSON.stringify(sections));
    const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k))!;
    modified[fwKey].tables[0].rows[0]["Log"] = "Disabled";
    const result = diffConfigs(sections, modified);
    const statuses = result.sections.map((s) => s.status);
    const modifiedIdx = statuses.indexOf("modified");
    const unchangedIdx = statuses.indexOf("unchanged");
    if (modifiedIdx !== -1 && unchangedIdx !== -1) {
      expect(modifiedIdx).toBeLessThan(unchangedIdx);
    }
  });
});
