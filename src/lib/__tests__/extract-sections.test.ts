import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractSections } from "../extract-sections";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "../../test/fixtures");

function loadFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf-8");
}

describe("extractSections", () => {
  describe("edge cases", () => {
    it("handles empty config (empty string) gracefully", async () => {
      const html = loadFixture("empty-config.html");
      const result = await extractSections(html);
      expect(result).toEqual({});
    });

    it("handles no-rules config (valid Sophos structure, no firewall rules table) gracefully", async () => {
      const html = loadFixture("no-rules.html");
      const result = await extractSections(html);
      expect(typeof result).toBe("object");
      expect(result).not.toBeNull();
    });

    it("handles malformed HTML gracefully", async () => {
      const html = loadFixture("malformed.html");
      const result = await extractSections(html);
      expect(typeof result).toBe("object");
      expect(result).not.toBeNull();
    });

    it("handles non-Sophos HTML (valid HTML, no Sophos markers) gracefully", async () => {
      const html = loadFixture("non-sophos.html");
      const result = await extractSections(html);
      expect(result).toEqual({});
    });
  });

  describe("short or invalid input", () => {
    it("returns empty object for empty string", async () => {
      expect(await extractSections("")).toEqual({});
    });

    it("returns empty object for string shorter than 50 chars", async () => {
      expect(await extractSections("short")).toEqual({});
    });

    it("returns empty object for non-string input", async () => {
      // @ts-expect-error - testing runtime behaviour
      expect(await extractSections(null)).toEqual({});
      // @ts-expect-error - testing runtime behaviour
      expect(await extractSections(undefined)).toEqual({});
    });
  });

  describe("fixture coverage — section presence and row-count parity", () => {
    const contentFixtures = [
      { name: "basic-firewall.html", minFirewallRules: 6, minZones: 4 },
      { name: "minimal-sophos.html", minFirewallRules: 2, minZones: 2 },
    ] as const;

    contentFixtures.forEach(({ name, minFirewallRules, minZones }) => {
      describe(name, () => {
        let sections: Awaited<ReturnType<typeof extractSections>>;

        beforeAll(async () => {
          const html = loadFixture(name);
          sections = await extractSections(html);
        });

        it("extracts firewall rules section with expected minimum row count", () => {
          const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k));
          expect(fwKey, `fixture ${name} should have firewall rules section`).toBeDefined();
          const fw = sections[fwKey!];
          expect(fw.tables.length).toBeGreaterThanOrEqual(1);
          const totalRows = fw.tables.reduce((sum, t) => sum + t.rows.length, 0);
          expect(totalRows).toBeGreaterThanOrEqual(minFirewallRules);
        });

        it("extracts zones section with expected minimum row count", () => {
          const zoneKey = Object.keys(sections).find((k) => /zone/i.test(k));
          expect(zoneKey, `fixture ${name} should have zones section`).toBeDefined();
          const zone = sections[zoneKey!];
          expect(zone.tables.length).toBeGreaterThanOrEqual(1);
          const totalRows = zone.tables.reduce((sum, t) => sum + t.rows.length, 0);
          expect(totalRows).toBeGreaterThanOrEqual(minZones);
        });

        it("produces tables with headers and rows for critical sections", () => {
          const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k));
          if (!fwKey) return;
          const fw = sections[fwKey];
          fw.tables.forEach((t) => {
            expect(t.headers.length).toBeGreaterThan(0);
            expect(Array.isArray(t.rows)).toBe(true);
          });
        });
      });
    });
  });
});
