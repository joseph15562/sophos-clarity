import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import type { AnalysisResult, InspectionPosture } from "@/lib/analyse-config";
import type { BrandingData } from "@/components/BrandingSetup";
import type { ParsedFile } from "@/hooks/use-report-generation";

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabase({}) };
});

function minimalInspectionPosture(): InspectionPosture {
  return {
    totalWanRules: 0,
    enabledWanRules: 0,
    disabledWanRules: 0,
    webFilterableRules: 0,
    withWebFilter: 0,
    withoutWebFilter: 0,
    withAppControl: 0,
    withIps: 0,
    withSslInspection: 0,
    sslDecryptRules: 0,
    sslExclusionRules: 0,
    sslRules: [],
    sslUncoveredZones: [],
    sslUncoveredNetworks: [],
    allWanSourceZones: [],
    allWanSourceNetworks: [],
    wanRuleNames: [],
    wanWebServiceRuleNames: [],
    wanMissingWebFilterRuleNames: [],
    totalDisabledRules: 0,
    dpiEngineEnabled: false,
  };
}

/** Minimal valid `AnalysisResult` aligned with `src/lib/analysis/types.ts`. */
function minimalAnalysisResult(): AnalysisResult {
  return {
    stats: {
      totalRules: 5,
      totalSections: 10,
      totalHosts: 0,
      totalNatRules: 1,
      interfaces: 3,
      populatedSections: 8,
      emptySections: 2,
      sectionNames: [],
    },
    findings: [],
    inspectionPosture: minimalInspectionPosture(),
    hostname: "test-fw",
  };
}

const brandingFixture: BrandingData = {
  companyName: "Test Co",
  customerName: "",
  logoUrl: null,
  environment: "Private Sector",
  country: "United Kingdom",
  selectedFrameworks: [],
};

const minimalFile: ParsedFile = {
  id: "f1",
  label: "FW1",
  fileName: "test.html",
  content: "",
  extractedData: {},
};

function baseProps() {
  const ar = minimalAnalysisResult();
  return {
    analysisResult: { fw1: ar } as Record<string, AnalysisResult>,
    files: [minimalFile],
    branding: brandingFixture,
    activeTab: "overview",
    setActiveTab: vi.fn(),
    totalFindings: 0,
    totalRules: ar.stats.totalRules,
    totalSections: ar.stats.totalSections,
    totalPopulated: ar.stats.populatedSections,
    extractionPct: 80,
    aggregatedPosture: minimalInspectionPosture(),
    securityStats: null,
    configMetas: [{ label: "FW1", hostname: "test-fw", configHash: "h1" }],
    diffSelection: null as const,
    setDiffSelection: vi.fn(),
    projectedScore: null,
    setProjectedScore: vi.fn(),
    isGuest: false,
    localMode: true,
    onExplainFinding: vi.fn(),
    hasReports: false,
  };
}

describe("AnalysisTabs", () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders tab triggers", () => {
    renderWithProviders(<AnalysisTabs {...baseProps()} />);
    expect(screen.getByRole("tab", { name: /overview/i })).toBeVisible();
    expect(screen.getByRole("tab", { name: /security analysis/i })).toBeVisible();
    expect(screen.getByRole("tab", { name: /^compliance$/i })).toBeVisible();
  });

  it("renders without crashing with empty data", () => {
    const posture = minimalInspectionPosture();
    renderWithProviders(
      <AnalysisTabs
        {...baseProps()}
        analysisResult={{}}
        files={[]}
        branding={{ ...brandingFixture, selectedFrameworks: [] }}
        totalFindings={0}
        totalRules={0}
        totalSections={0}
        totalPopulated={0}
        extractionPct={0}
        aggregatedPosture={posture}
        configMetas={[]}
      />,
    );
    expect(screen.getByRole("tab", { name: /overview/i })).toBeVisible();
  });
});
