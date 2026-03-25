import { describe, it, expect } from "vitest";
import { sanitizePdfFilenamePart } from "@/lib/pdf-utils";

describe("sanitizePdfFilenamePart", () => {
  it("strips unsafe characters and collapses whitespace", () => {
    expect(sanitizePdfFilenamePart("Acme Corp")).toBe("Acme-Corp");
    expect(sanitizePdfFilenamePart("  evil/../../x  ")).toBe("evilx");
  });

  it("falls back to report when empty", () => {
    expect(sanitizePdfFilenamePart("")).toBe("report");
    expect(sanitizePdfFilenamePart("!!!")).toBe("report");
  });
});
