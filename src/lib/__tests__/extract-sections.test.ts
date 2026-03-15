import { describe, it, expect } from "vitest";
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
    it("handles empty config (empty string) gracefully", () => {
      const html = loadFixture("empty-config.html");
      const result = extractSections(html);
      expect(result).toEqual({});
    });

    it("handles no-rules config (valid Sophos structure, no firewall rules table) gracefully", () => {
      const html = loadFixture("no-rules.html");
      expect(() => extractSections(html)).not.toThrow();
      const result = extractSections(html);
      expect(typeof result).toBe("object");
      expect(result).not.toBeNull();
    });

    it("handles malformed HTML gracefully", () => {
      const html = loadFixture("malformed.html");
      expect(() => extractSections(html)).not.toThrow();
      const result = extractSections(html);
      expect(typeof result).toBe("object");
      expect(result).not.toBeNull();
    });

    it("handles non-Sophos HTML (valid HTML, no Sophos markers) gracefully", () => {
      const html = loadFixture("non-sophos.html");
      const result = extractSections(html);
      expect(result).toEqual({});
    });
  });

  describe("short or invalid input", () => {
    it("returns empty object for empty string", () => {
      expect(extractSections("")).toEqual({});
    });

    it("returns empty object for string shorter than 50 chars", () => {
      expect(extractSections("short")).toEqual({});
    });

    it("returns empty object for non-string input", () => {
      // @ts-expect-error - testing runtime behaviour
      expect(extractSections(null)).toEqual({});
      // @ts-expect-error - testing runtime behaviour
      expect(extractSections(undefined)).toEqual({});
    });
  });
});
