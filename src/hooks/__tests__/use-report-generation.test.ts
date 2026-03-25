import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }),
      ),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
  getSupabasePublicEdgeAuth: () => ({ url: "http://test.local", anonKey: "test" }),
}));

import type { BrandingData } from "@/components/BrandingSetup";
import type { AnalysisResult, ConfigStats, Finding, InspectionPosture } from "@/lib/analysis/types";
import {
  buildCoverPageMarkdown,
  buildExecutiveOnePagerMarkdown,
} from "@/hooks/use-report-generation";

function baseBranding(overrides: Partial<BrandingData> = {}): BrandingData {
  return {
    companyName: "Acme Corp",
    customerName: "Acme Corp",
    logoUrl: null,
    environment: "Private Sector",
    country: "United Kingdom",
    selectedFrameworks: [],
    ...overrides,
  };
}

const minimalStats: ConfigStats = {
  totalRules: 0,
  totalSections: 0,
  totalHosts: 0,
  totalNatRules: 0,
  interfaces: 0,
  populatedSections: 0,
  emptySections: 0,
  sectionNames: [],
};

const minimalInspectionPosture: InspectionPosture = {
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
  dpiEngineEnabled: true,
};

function analysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    stats: minimalStats,
    findings: [],
    inspectionPosture: minimalInspectionPosture,
    ...overrides,
  };
}

describe("buildCoverPageMarkdown", () => {
  it("includes company name as title", () => {
    const md = buildCoverPageMarkdown(baseBranding({ customerName: "Acme Corp" }));
    expect(md).toContain("# Acme Corp");
  });

  it("uses fallback title when no customerName", () => {
    const md = buildCoverPageMarkdown(baseBranding({ customerName: "" }));
    expect(md).toContain("# Firewall Configuration Assessment");
  });

  it("includes logo when provided", () => {
    const md = buildCoverPageMarkdown(
      baseBranding({ logoUrl: "https://example.com/logo.png" }),
    );
    expect(md).toContain("![Company Logo]");
    expect(md).toContain("https://example.com/logo.png");
  });

  it("includes prepared by", () => {
    const md = buildCoverPageMarkdown(baseBranding({ preparedBy: "Jane Engineer" }));
    expect(md).toContain("**Prepared by:** Jane Engineer");
  });
});

describe("buildExecutiveOnePagerMarkdown", () => {
  it("produces executive summary with score", () => {
    const finding: Finding = {
      id: "f1",
      severity: "high",
      title: "Open WAN rule",
      detail: "Detail",
      section: "Rules",
    };
    const results: Record<string, AnalysisResult> = {
      fw1: analysisResult({ findings: [finding] }),
    };
    const md = buildExecutiveOnePagerMarkdown(
      results,
      baseBranding(),
      "Acme Corp",
    );
    expect(md).toContain("Overall Score");
    expect(md).toContain("Grade");
  });

  it("handles no findings", () => {
    const md = buildExecutiveOnePagerMarkdown(
      { fw1: analysisResult({ findings: [] }) },
      baseBranding(),
      "Acme Corp",
    );
    expect(md).toContain("No findings identified");
  });
});
