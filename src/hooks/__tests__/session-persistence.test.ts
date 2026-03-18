import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { saveSession, loadSession, clearSession } from "../use-session-persistence";

const STORAGE_KEY = "sophos-firecomply-session";

describe("session persistence", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saveSession writes to localStorage", () => {
    saveSession(
      { companyName: "", logoUrl: null, customerName: "Acme", environment: "", country: "", selectedFrameworks: [] },
      [{ id: "r1", label: "Report 1", markdown: "# Hi" }],
      "r1"
    );
    expect(storage[STORAGE_KEY]).toBeDefined();
    const parsed = JSON.parse(storage[STORAGE_KEY]);
    expect(parsed.branding.customerName).toBe("Acme");
    expect(parsed.reports).toHaveLength(1);
    expect(parsed.activeReportId).toBe("r1");
  });

  it("loadSession returns null when nothing saved", () => {
    expect(loadSession()).toBeNull();
  });

  it("loadSession returns saved data when valid and not expired", () => {
    saveSession(
      { companyName: "", logoUrl: null, customerName: "Acme", environment: "Prod", country: "", selectedFrameworks: [] },
      [{ id: "r1", label: "R1", markdown: "x" }],
      "r1"
    );
    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded!.branding.customerName).toBe("Acme");
    expect(loaded!.reports[0].id).toBe("r1");
    expect(loaded!.activeReportId).toBe("r1");
  });

  it("clearSession removes storage", () => {
    saveSession(
      { companyName: "", logoUrl: null, customerName: "", environment: "", country: "", selectedFrameworks: [] },
      [{ id: "r1", label: "R", markdown: "" }],
      "r1"
    );
    clearSession();
    expect(storage[STORAGE_KEY]).toBeUndefined();
  });
});
