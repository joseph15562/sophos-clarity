import { describe, it, expect } from "vitest";
import { computeDocxTableFixedColumnWidths } from "@/lib/report-export";

const GRID = 13_000;

function sumWidths(w: number[]) {
  return w.reduce((a, b) => a + b, 0);
}

describe("computeDocxTableFixedColumnWidths", () => {
  it("keeps a wide first column when the header is not a row index", () => {
    const w = computeDocxTableFixedColumnWidths(12, GRID, {
      headerFirstCell: "Rule Name",
      firstColBodySamples: ["allow_ssh", "deny_all"],
    });
    expect(w.length).toBe(12);
    expect(sumWidths(w)).toBe(GRID);
    expect(w[0]).toBeGreaterThan(3000);
  });

  it("uses a narrow first column when the header is #", () => {
    const w = computeDocxTableFixedColumnWidths(18, GRID, {
      headerFirstCell: "#",
      firstColBodySamples: ["1", "2", "3"],
    });
    expect(w.length).toBe(18);
    expect(sumWidths(w)).toBe(GRID);
    expect(w[0]).toBeLessThanOrEqual(700);
    expect(w[1]).toBeGreaterThan(w[0]);
    expect(w[1]).toBeGreaterThan(3000);
  });

  it("treats No / Index as index headers", () => {
    const a = computeDocxTableFixedColumnWidths(10, GRID, { headerFirstCell: "No." });
    const b = computeDocxTableFixedColumnWidths(10, GRID, { headerFirstCell: "Index" });
    expect(a[0]).toBeLessThan(800);
    expect(b[0]).toBeLessThan(800);
  });
});
