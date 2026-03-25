import { describe, it, expect, vi } from "vitest";
import { screen, renderWithProviders } from "@/test/test-utils";
import type { AnalysisResult, Finding, InspectionPosture } from "@/lib/analyse-config";
import type { FrameworkMapping } from "@/lib/compliance-map";
import { ComplianceHeatmap } from "@/components/ComplianceHeatmap";

const mockMappings: FrameworkMapping[] = [
  {
    framework: "NCSC Guidelines",
    controls: [
      {
        controlId: "NCSC-WF",
        controlName: "Web Content Filtering",
        category: "Traffic Inspection",
        status: "pass",
        relatedFindings: [],
        evidence: "All WAN rules filtered",
      },
      {
        controlId: "NCSC-IPS",
        controlName: "Intrusion Prevention System",
        category: "Traffic Inspection",
        status: "partial",
        relatedFindings: [],
        evidence: "Some rules without IPS",
      },
      {
        controlId: "NCSC-LOG",
        controlName: "Audit Logging",
        category: "Monitoring & Logging",
        status: "fail",
        relatedFindings: [],
        evidence: "Logging gaps",
      },
    ],
    summary: { pass: 1, partial: 1, fail: 1, na: 0 },
  },
];

vi.mock("@/lib/compliance-map", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/compliance-map")>();
  return {
    ...actual,
    mapToAllFrameworks: vi.fn(() => mockMappings),
  };
});

function emptyInspectionPosture(): InspectionPosture {
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

function minimalAnalysisResult(overrides: { findings?: Finding[] } = {}): AnalysisResult {
  return {
    stats: {
      totalRules: 5,
      totalSections: 10,
      totalHosts: 0,
      totalNatRules: 0,
      interfaces: 2,
      populatedSections: 8,
      emptySections: 2,
      sectionNames: ["Firewall Rules"],
    },
    findings: overrides.findings ?? [],
    inspectionPosture: emptyInspectionPosture(),
  };
}

describe("ComplianceHeatmap", () => {
  it("renders without crashing", () => {
    const { container } = renderWithProviders(
      <ComplianceHeatmap
        analysisResults={{ fw1: minimalAnalysisResult() }}
        selectedFrameworks={["NCSC Guidelines"]}
      />,
    );

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Compliance Heatmap/i })).toBeInTheDocument();
  });

  it("renders framework name", () => {
    renderWithProviders(
      <ComplianceHeatmap
        analysisResults={{ fw1: minimalAnalysisResult() }}
        selectedFrameworks={["NCSC Guidelines"]}
      />,
    );

    expect(screen.getAllByText("NCSC Guidelines").length).toBeGreaterThan(0);
  });

  it("renders nothing useful with empty results", () => {
    const { container } = renderWithProviders(
      <ComplianceHeatmap analysisResults={{}} selectedFrameworks={["NCSC Guidelines"]} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading", { name: /Compliance Heatmap/i })).not.toBeInTheDocument();
  });
});
