import { describe, it, expect } from "vitest";
import { render, screen, within } from "@/test/test-utils";
import type { AnalysisResult, Finding, InspectionPosture } from "@/lib/analyse-config";
import { RiskSummaryCards } from "@/components/RiskSummaryCards";

function emptyInspectionPosture(overrides: Partial<InspectionPosture> = {}): InspectionPosture {
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
    ...overrides,
  };
}

function minimalAnalysisResult(overrides: {
  stats?: Partial<AnalysisResult["stats"]>;
  findings?: Finding[];
  inspectionPosture?: Partial<InspectionPosture>;
} = {}): AnalysisResult {
  const {
    stats: statsOverrides,
    findings = [],
    inspectionPosture: postureOverrides,
  } = overrides;

  return {
    stats: {
      totalRules: 0,
      totalSections: 1,
      totalHosts: 0,
      totalNatRules: 0,
      interfaces: 0,
      populatedSections: 0,
      emptySections: 1,
      sectionNames: ["firewall"],
      ...statsOverrides,
    },
    findings,
    inspectionPosture: emptyInspectionPosture(postureOverrides ?? {}),
  };
}

/** Produces overall risk score ~70 via computeRiskScore (9 categories). */
function analysisResultOverallAbout70(): AnalysisResult {
  return minimalAnalysisResult({
    stats: { totalRules: 10 },
    inspectionPosture: {
      totalWanRules: 10,
      enabledWanRules: 10,
      disabledWanRules: 0,
      webFilterableRules: 10,
      withWebFilter: 3,
      withoutWebFilter: 7,
      withIps: 0,
      withAppControl: 0,
      dpiEngineEnabled: true,
    },
  });
}

function cardRoot(label: string): HTMLElement {
  const el = screen.getByText(label);
  const root = el.closest(".rounded-xl");
  if (!root) throw new Error(`No card root for label: ${label}`);
  return root as HTMLElement;
}

describe("RiskSummaryCards", () => {
  it("renders without crashing with minimal data", () => {
    const { container } = render(
      <RiskSummaryCards
        analysisResults={{ fw1: minimalAnalysisResult() }}
      />,
    );

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText("Overall Score")).toBeInTheDocument();
  });

  it("shows overall score", () => {
    render(
      <RiskSummaryCards
        analysisResults={{ fw1: analysisResultOverallAbout70() }}
      />,
    );

    expect(within(cardRoot("Overall Score")).getByText("70")).toBeInTheDocument();
  });

  it("shows finding counts by severity", () => {
    const findings: Finding[] = [
      {
        id: "c1",
        severity: "critical",
        title: "Critical issue one",
        detail: "d",
        section: "Test",
      },
      {
        id: "c2",
        severity: "critical",
        title: "Critical issue two",
        detail: "d",
        section: "Test",
      },
      {
        id: "h1",
        severity: "high",
        title: "High one",
        detail: "d",
        section: "Test",
      },
      {
        id: "h2",
        severity: "high",
        title: "High two",
        detail: "d",
        section: "Test",
      },
      {
        id: "h3",
        severity: "high",
        title: "High three",
        detail: "d",
        section: "Test",
      },
    ];

    render(
      <RiskSummaryCards
        analysisResults={{
          fw1: minimalAnalysisResult({
            findings,
            stats: {
              totalRules: 20,
              populatedSections: 5,
              totalSections: 10,
            },
          }),
        }}
      />,
    );

    expect(within(cardRoot("Critical Findings")).getByText("2")).toBeInTheDocument();
    expect(within(cardRoot("High Findings")).getByText("3")).toBeInTheDocument();
  });

  it("shows previous score comparison", () => {
    const { container } = render(
      <RiskSummaryCards
        analysisResults={{ fw1: analysisResultOverallAbout70() }}
        previousScore={50}
      />,
    );

    expect(container.querySelector(".lucide-trending-up")).toBeInTheDocument();
  });
});
