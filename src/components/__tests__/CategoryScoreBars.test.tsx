import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import type { AnalysisResult, Finding, InspectionPosture } from "@/lib/analyse-config";
import { CategoryScoreBars } from "@/components/CategoryScoreBars";

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

describe("CategoryScoreBars", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <CategoryScoreBars analysisResults={{ fw1: minimalAnalysisResult() }} />,
    );

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /category scores/i })).toBeInTheDocument();
  });

  it("renders category labels", () => {
    render(
      <CategoryScoreBars analysisResults={{ fw1: minimalAnalysisResult() }} />,
    );

    expect(screen.getByText("Web Filtering")).toBeInTheDocument();
    expect(screen.getByText("Intrusion Prevention")).toBeInTheDocument();
    expect(screen.getByText("Application Control")).toBeInTheDocument();
    expect(screen.getByText("Authentication")).toBeInTheDocument();
    expect(screen.getByText("Logging")).toBeInTheDocument();
    expect(screen.getByText("Rule Hygiene")).toBeInTheDocument();
    expect(screen.getByText("Admin Access")).toBeInTheDocument();
    expect(screen.getByText("Anti-Malware")).toBeInTheDocument();
    expect(screen.getByText("Network Security")).toBeInTheDocument();
  });

  it("renders bars for each category", () => {
    const { container } = render(
      <CategoryScoreBars analysisResults={{ fw1: minimalAnalysisResult() }} />,
    );

    const tracks = container.querySelectorAll(".overflow-hidden.rounded-full.bg-muted");
    expect(tracks.length).toBe(9);

    const innerBars = container.querySelectorAll(
      ".overflow-hidden.rounded-full.bg-muted > div[style]",
    );
    expect(innerBars.length).toBe(9);
  });
});
