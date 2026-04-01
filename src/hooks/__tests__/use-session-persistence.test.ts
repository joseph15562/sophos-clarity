import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { BrandingData } from "@/components/BrandingSetup";
import type { ReportEntry } from "@/components/DocumentPreview";
import { saveSession, loadSession, clearSession } from "@/hooks/use-session-persistence";

const STORAGE_KEY = "sophos-firecomply-session";

function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

const baseBranding: BrandingData = {
  companyName: "Co",
  logoUrl: "https://example.com/logo.png",
  customerName: "Customer",
  environment: "prod",
  country: "GB",
  selectedFrameworks: [],
};

const reports: ReportEntry[] = [{ id: "r1", label: "Report 1", markdown: "# Hello" }];

describe("use-session-persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("saveSession stores data to localStorage", () => {
    saveSession(baseBranding, reports, "r1");

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.activeReportId).toBe("r1");
    expect(parsed.reports).toEqual(
      reports.map((r) => ({ id: r.id, label: r.label, markdown: r.markdown })),
    );
    expect(parsed.branding).toBeDefined();
    expect(parsed.branding).not.toHaveProperty("logoUrl");
    expect(parsed.savedAt).toEqual(expect.any(Number));
  });

  it("loadSession retrieves data from localStorage", () => {
    saveSession(baseBranding, reports, "r1");

    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded!.activeReportId).toBe("r1");
    expect(loaded!.reports).toEqual(reports);
    expect(loaded!.branding.logoUrl).toBeNull();
    expect(loaded!.branding.customerName).toBe(baseBranding.customerName);
    expect(loaded!.linkedCloudAssessmentId).toBeNull();
    expect(loaded!.configComplianceScopes).toEqual({});
  });

  it("round-trips linkedCloudAssessmentId", () => {
    saveSession(baseBranding, reports, "r1", "assess-uuid-1");
    const loaded = loadSession();
    expect(loaded?.linkedCloudAssessmentId).toBe("assess-uuid-1");
    expect(loaded?.configComplianceScopes).toEqual({});
  });

  it("round-trips configComplianceScopes", () => {
    const scopes = {
      "file-1": {
        country: "United Kingdom",
        state: "",
        environment: "Government",
        additionalFrameworks: ["PCI DSS"],
      },
    };
    saveSession(baseBranding, reports, "r1", null, scopes);
    const loaded = loadSession();
    expect(loaded?.configComplianceScopes).toEqual(scopes);
  });

  it("loadSession treats missing linkedCloudAssessmentId as null (backward compatible)", () => {
    const savedAt = Date.now();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        branding: {
          companyName: "Co",
          customerName: "Customer",
          environment: "prod",
          country: "GB",
          selectedFrameworks: [],
        },
        reports: [{ id: "r1", label: "R", markdown: "x" }],
        activeReportId: "r1",
        savedAt,
      }),
    );
    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded!.linkedCloudAssessmentId).toBeNull();
  });

  it("returns null for expired sessions", () => {
    const savedAt = 1_700_000_000_000;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        branding: {
          companyName: "Co",
          customerName: "Customer",
          environment: "prod",
          country: "GB",
          selectedFrameworks: [],
        },
        reports: [{ id: "r1", label: "R", markdown: "x" }],
        activeReportId: "r1",
        savedAt,
      }),
    );

    vi.spyOn(Date, "now").mockReturnValue(savedAt + 25 * 60 * 60 * 1000);

    expect(loadSession()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
