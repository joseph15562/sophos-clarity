import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractSectionsWithMeta, buildMetaFromSections } from "../extract-sections";
import type { ExtractionMeta, ExtractedSections } from "../extract-sections";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "../../test/fixtures");

function loadFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf-8");
}

describe("extractSectionsWithMeta", () => {
  it("returns metadata with correct counts for basic-firewall fixture", async () => {
    const html = loadFixture("basic-firewall.html");
    const { sections, meta } = await extractSectionsWithMeta(html);

    expect(Object.keys(sections).length).toBeGreaterThan(0);
    expect(meta.totalDetected).toBeGreaterThan(0);
    expect(meta.totalExtracted).toBeGreaterThanOrEqual(1);
    expect(meta.totalDetected).toBe(meta.totalExtracted + meta.totalEmpty);
    expect(meta.coveragePct).toBeGreaterThan(0);
    expect(meta.coveragePct).toBeLessThanOrEqual(100);
  });

  it("has the same extracted sections as keys in the sections object", async () => {
    const html = loadFixture("basic-firewall.html");
    const { sections, meta } = await extractSectionsWithMeta(html);

    const extractedNames = meta.sections
      .filter((s) => s.status === "extracted")
      .map((s) => s.displayName);

    for (const name of extractedNames) {
      expect(sections).toHaveProperty(name);
    }
    expect(meta.totalExtracted).toBe(Object.keys(sections).length);
  });

  it("tracks row and table counts per section", async () => {
    const html = loadFixture("basic-firewall.html");
    const { meta } = await extractSectionsWithMeta(html);

    const fwRules = meta.sections.find((s) => /firewall/i.test(s.displayName));
    expect(fwRules).toBeDefined();
    expect(fwRules!.status).toBe("extracted");
    expect(fwRules!.rowCount).toBeGreaterThanOrEqual(4);
    expect(fwRules!.tableCount).toBeGreaterThanOrEqual(1);
  });

  it("marks empty sections with status 'empty'", async () => {
    const html = loadFixture("basic-firewall.html");
    const { meta } = await extractSectionsWithMeta(html);

    const sslSection = meta.sections.find((s) => /ssl/i.test(s.displayName));
    expect(sslSection).toBeDefined();
    expect(sslSection!.status).toBe("empty");
    expect(sslSection!.rowCount).toBe(0);
  });

  it("correctly computes coverage percentage", async () => {
    const html = loadFixture("basic-firewall.html");
    const { meta } = await extractSectionsWithMeta(html);

    const expected = Math.round((meta.totalExtracted / meta.totalDetected) * 100);
    expect(meta.coveragePct).toBe(expected);
  });

  it("returns zero metadata for non-Sophos HTML", async () => {
    const html = loadFixture("non-sophos.html");
    const { sections, meta } = await extractSectionsWithMeta(html);

    expect(Object.keys(sections)).toHaveLength(0);
    expect(meta.totalDetected).toBe(0);
    expect(meta.totalExtracted).toBe(0);
    expect(meta.coveragePct).toBe(0);
  });

  it("returns zero metadata for empty/short input", async () => {
    const { meta } = await extractSectionsWithMeta("");
    expect(meta.totalDetected).toBe(0);
    expect(meta.coveragePct).toBe(0);
  });

  it("minimal fixture: detects all sidebar sections", async () => {
    const html = loadFixture("minimal-sophos.html");
    const { meta } = await extractSectionsWithMeta(html);

    expect(meta.totalDetected).toBe(2);
    expect(meta.totalExtracted).toBe(2);
    expect(meta.coveragePct).toBe(100);

    const names = meta.sections.map((s) => s.displayName);
    expect(names).toContain("Firewall Rules");
    expect(names).toContain("Zones");
  });

  it("each section meta has all required fields", async () => {
    const html = loadFixture("basic-firewall.html");
    const { meta } = await extractSectionsWithMeta(html);

    for (const section of meta.sections) {
      expect(section.key.length).toBeGreaterThan(0);
      expect(section.displayName.length).toBeGreaterThan(0);
      expect(["extracted", "empty"]).toContain(section.status);
      expect(typeof section.htmlId).toBe("string");
      expect(typeof section.extractionMethod).toBe("string");
      expect(typeof section.plainTextFallback).toBe("boolean");
      expect(section.rowCount).toBeGreaterThanOrEqual(0);
      expect(section.tableCount).toBeGreaterThanOrEqual(0);
      expect(section.detailCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("sidebar-mapped sections have correct extractionMethod", async () => {
    const html = loadFixture("basic-firewall.html");
    const { meta } = await extractSectionsWithMeta(html);

    const fwRules = meta.sections.find((s) => s.key === "firewallRules");
    expect(fwRules).toBeDefined();
    expect(fwRules!.extractionMethod).toBe("sidebar-mapped");
    expect(fwRules!.htmlId).toBe("firewall-rules");
  });

  it("empty sections still track htmlId and method", async () => {
    const html = loadFixture("basic-firewall.html");
    const { meta } = await extractSectionsWithMeta(html);

    const ssl = meta.sections.find((s) => s.key === "sslTlsInspectionRules");
    expect(ssl).toBeDefined();
    expect(ssl!.status).toBe("empty");
    expect(ssl!.htmlId).toBe("ssl-tls-inspection-rules");
    expect(ssl!.extractionMethod).toBe("sidebar-mapped");
  });
});

describe("generic section discovery", () => {
  it("discovers unmapped sections via section-content-* containers", async () => {
    const html = loadFixture("extended-sections.html");
    const { sections, meta } = await extractSectionsWithMeta(html);

    const discovered = meta.sections.filter((s) => s.extractionMethod === "generic-discovery");
    expect(discovered.length).toBeGreaterThanOrEqual(2);

    const vpn = discovered.find((s) => /vpn/i.test(s.displayName));
    expect(vpn).toBeDefined();
    expect(vpn!.status).toBe("extracted");
    expect(vpn!.rowCount).toBe(3);
    expect(sections[vpn!.displayName]).toBeDefined();

    const dhcp = discovered.find((s) => /dhcp/i.test(s.displayName));
    expect(dhcp).toBeDefined();
    expect(dhcp!.status).toBe("extracted");
    expect(dhcp!.rowCount).toBe(2);
  });

  it("generates readable display names from HTML IDs", async () => {
    const html = loadFixture("extended-sections.html");
    const { meta } = await extractSectionsWithMeta(html);

    const vpn = meta.sections.find((s) => s.htmlId === "vpn-settings");
    expect(vpn).toBeDefined();
    expect(vpn!.displayName).toBe("Vpn Settings");

    const dhcp = meta.sections.find((s) => s.htmlId === "dhcp-server");
    expect(dhcp).toBeDefined();
    expect(dhcp!.displayName).toBe("Dhcp Server");
  });

  it("uses plain text fallback for sections without tables", async () => {
    const html = loadFixture("extended-sections.html");
    const { sections, meta } = await extractSectionsWithMeta(html);

    const dns = meta.sections.find((s) => /dns/i.test(s.displayName) && s.extractionMethod === "generic-discovery");
    expect(dns).toBeDefined();
    expect(dns!.status).toBe("extracted");
    expect(dns!.plainTextFallback).toBe(true);
    expect(dns!.tableCount).toBe(0);
    expect(sections[dns!.displayName].text.length).toBeGreaterThan(0);
  });

  it("does not duplicate sections already found by sidebar or map passes", async () => {
    const html = loadFixture("extended-sections.html");
    const { meta } = await extractSectionsWithMeta(html);

    const fwEntries = meta.sections.filter((s) => /firewall/i.test(s.displayName));
    expect(fwEntries).toHaveLength(1);
    expect(fwEntries[0].extractionMethod).toBe("sidebar-mapped");

    const zoneEntries = meta.sections.filter((s) => /zone/i.test(s.displayName));
    expect(zoneEntries).toHaveLength(1);
    expect(zoneEntries[0].extractionMethod).toBe("sidebar-mapped");
  });

  it("skips empty unmapped containers", async () => {
    const html = loadFixture("extended-sections.html");
    const { meta } = await extractSectionsWithMeta(html);

    const emptyCustom = meta.sections.find((s) => s.htmlId === "empty-custom");
    expect(emptyCustom).toBeUndefined();
  });

  it("still finds standard sidebar sections alongside discovered ones", async () => {
    const html = loadFixture("extended-sections.html");
    const { meta } = await extractSectionsWithMeta(html);

    const sidebar = meta.sections.filter((s) => s.extractionMethod.startsWith("sidebar"));
    expect(sidebar.length).toBeGreaterThanOrEqual(2);

    const discovered = meta.sections.filter((s) => s.extractionMethod === "generic-discovery");
    expect(discovered.length).toBeGreaterThanOrEqual(2);

    expect(meta.totalExtracted).toBeGreaterThanOrEqual(4);
  });
});

describe("buildMetaFromSections", () => {
  it("treats all sections as extracted with xml-agent method", () => {
    const sections: ExtractedSections = {
      "Firewall Rules": {
        tables: [{ headers: ["Name"], rows: [{ Name: "Rule-1" }, { Name: "Rule-2" }] }],
        text: "",
        details: [],
      },
      Zones: {
        tables: [{ headers: ["Zone"], rows: [{ Zone: "LAN" }] }],
        text: "",
        details: [],
      },
    };

    const meta: ExtractionMeta = buildMetaFromSections(sections);

    expect(meta.totalDetected).toBe(2);
    expect(meta.totalExtracted).toBe(2);
    expect(meta.totalEmpty).toBe(0);
    expect(meta.coveragePct).toBe(100);

    const fwMeta = meta.sections.find((s) => s.key === "Firewall Rules");
    expect(fwMeta).toBeDefined();
    expect(fwMeta!.rowCount).toBe(2);
    expect(fwMeta!.tableCount).toBe(1);
    expect(fwMeta!.extractionMethod).toBe("xml-agent");
    expect(fwMeta!.plainTextFallback).toBe(false);
  });

  it("detects plain text fallback in buildMetaFromSections", () => {
    const sections: ExtractedSections = {
      "Text Only": { tables: [], text: "Some config text", details: [] },
    };

    const meta = buildMetaFromSections(sections);
    expect(meta.sections[0].plainTextFallback).toBe(true);
  });

  it("handles empty sections object", () => {
    const meta = buildMetaFromSections({});
    expect(meta.totalDetected).toBe(0);
    expect(meta.coveragePct).toBe(100);
  });
});
