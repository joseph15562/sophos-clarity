import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, renderWithProviders, userEvent } from "@/test/test-utils";
import type { AnalysisResult, Finding, InspectionPosture } from "@/lib/analyse-config";
import type { RiskScoreResult } from "@/lib/risk-score";
import { ScoreSimulator } from "@/components/ScoreSimulator";

const fixedRiskScore: RiskScoreResult = {
  overall: 65,
  grade: "C",
  categories: [
    { label: "Web Filtering", score: 50, maxScore: 100, pct: 50, details: "" },
    { label: "Intrusion Prevention", score: 50, maxScore: 100, pct: 50, details: "" },
    { label: "Application Control", score: 50, maxScore: 100, pct: 50, details: "" },
    { label: "Authentication", score: 50, maxScore: 100, pct: 50, details: "" },
    { label: "Logging", score: 50, maxScore: 100, pct: 50, details: "" },
    { label: "Rule Hygiene", score: 50, maxScore: 100, pct: 50, details: "" },
    { label: "Admin Access", score: 50, maxScore: 100, pct: 50, details: "" },
    { label: "Anti-Malware", score: 50, maxScore: 100, pct: 50, details: "" },
    { label: "Network Security", score: 50, maxScore: 100, pct: 50, details: "" },
  ],
};

vi.mock("@/lib/risk-score", () => ({
  computeRiskScore: vi.fn(() => fixedRiskScore),
}));

function emptyInspectionPosture(): InspectionPosture {
  return {
    totalWanRules: 2,
    enabledWanRules: 2,
    disabledWanRules: 0,
    webFilterableRules: 2,
    withWebFilter: 0,
    withoutWebFilter: 2,
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

function analysisWithWebFilterFinding(): AnalysisResult {
  const finding: Finding = {
    id: "wf1",
    severity: "high",
    title: "WAN rule missing web filtering",
    detail: "A WAN rule has no web filter.",
    section: "Firewall Rules",
  };
  return {
    stats: {
      totalRules: 10,
      totalSections: 5,
      totalHosts: 0,
      totalNatRules: 0,
      interfaces: 2,
      populatedSections: 5,
      emptySections: 0,
      sectionNames: ["Firewall Rules"],
    },
    findings: [finding],
    inspectionPosture: emptyInspectionPosture(),
  };
}

describe("ScoreSimulator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when defaultOpen", () => {
    renderWithProviders(
      <ScoreSimulator analysisResults={{ fw1: analysisWithWebFilterFinding() }} defaultOpen />,
    );

    expect(screen.getByRole("heading", { name: /Remediation Impact Simulator/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Enable Web Filtering on all WAN rules/i),
    ).toBeInTheDocument();
  });

  it("renders collapsed by default", () => {
    renderWithProviders(
      <ScoreSimulator analysisResults={{ fw1: analysisWithWebFilterFinding() }} />,
    );

    expect(screen.getByRole("heading", { name: /Remediation Impact Simulator/i })).toBeInTheDocument();
    expect(screen.queryByText(/Enable Web Filtering on all WAN rules/i)).not.toBeInTheDocument();
  });

  it("calls onProjectedChange when toggle clicked", async () => {
    const user = userEvent.setup();
    const onProjectedChange = vi.fn();

    renderWithProviders(
      <ScoreSimulator
        analysisResults={{ fw1: analysisWithWebFilterFinding() }}
        onProjectedChange={onProjectedChange}
        defaultOpen
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: /Enable Web Filtering on all WAN rules/i,
    });
    await user.click(checkbox);

    expect(onProjectedChange).toHaveBeenCalled();
    expect(onProjectedChange).toHaveBeenCalledWith(
      expect.objectContaining({ overall: fixedRiskScore.overall, grade: fixedRiskScore.grade }),
    );
  });
});
