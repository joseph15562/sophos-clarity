import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, expectNoSeriousAxeViolations } from "@/test/test-utils";
import { ExportCentre } from "@/components/ExportCentre";
import type { ComplianceFramework } from "@/components/BrandingSetup";
import type { AnalysisResult } from "@/lib/analyse-config";

vi.mock("@/lib/risk-register", () => ({
  downloadRiskRegisterCSV: vi.fn(),
  downloadRiskRegisterExcel: vi.fn(),
}));

const branding = { customerName: "Acme", selectedFrameworks: [] as ComplianceFramework[] };

describe("ExportCentre", () => {
  it("renders export buttons", () => {
    const stub = {
      stats: {
        totalRules: 0,
        totalSections: 0,
        totalHosts: 0,
        totalNatRules: 0,
        interfaces: 0,
        populatedSections: 0,
        emptySections: 0,
        sectionNames: [],
      },
      findings: [],
      inspectionPosture: {
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
      },
    } satisfies AnalysisResult;

    const analysisResults: Record<string, AnalysisResult> = { fw1: stub };

    renderWithProviders(<ExportCentre analysisResults={analysisResults} branding={branding} />);

    expect(screen.getByRole("heading", { name: /export centre/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /risk register csv/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /risk register excel/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /findings summary/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /config snapshot/i })).toBeEnabled();
  });

  it("disables buttons when no results", async () => {
    const { container } = renderWithProviders(
      <ExportCentre analysisResults={{}} branding={branding} />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
    await expectNoSeriousAxeViolations(container);
  });

  it("has no serious axe violations when results present", async () => {
    const stub = {
      stats: {
        totalRules: 0,
        totalSections: 0,
        totalHosts: 0,
        totalNatRules: 0,
        interfaces: 0,
        populatedSections: 0,
        emptySections: 0,
        sectionNames: [],
      },
      findings: [],
      inspectionPosture: {
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
      },
    } satisfies AnalysisResult;

    const { container } = renderWithProviders(
      <ExportCentre analysisResults={{ fw1: stub }} branding={branding} />,
    );
    await expectNoSeriousAxeViolations(container);
  });
});
