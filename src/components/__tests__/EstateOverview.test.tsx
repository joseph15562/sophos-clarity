import { describe, it, expect, vi } from "vitest";
import { screen, within, renderWithProviders, userEvent } from "@/test/test-utils";
import type { AnalysisResult, Finding, InspectionPosture } from "@/lib/analyse-config";
import { EstateOverview } from "@/components/EstateOverview";

vi.mock("@/lib/findings-export", () => ({
  downloadCsv: vi.fn(),
  downloadFindingsPdf: vi.fn(),
}));

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

/** Minimal `AnalysisResult` aligned with `ConfigStats` / `InspectionPosture` in `src/lib/analysis/types.ts`. */
function minimalAnalysisResult(
  overrides: {
    stats?: Partial<AnalysisResult["stats"]>;
    findings?: Finding[];
    inspectionPosture?: Partial<InspectionPosture>;
  } = {},
): AnalysisResult {
  const { stats: s, findings = [], inspectionPosture: ip } = overrides;
  return {
    stats: {
      totalRules: 5,
      totalSections: 10,
      totalHosts: 0,
      totalNatRules: 1,
      interfaces: 3,
      populatedSections: 8,
      emptySections: 2,
      sectionNames: ["Firewall Rules"],
      ...s,
    },
    findings,
    inspectionPosture: emptyInspectionPosture(ip ?? {}),
    ruleColumns: undefined,
    hostname: "test-fw",
  };
}

function cardRoot(label: string): HTMLElement {
  const el = screen.getByText(label);
  const root = el.closest(".rounded-xl");
  if (!root) throw new Error(`No card root for label: ${label}`);
  return root as HTMLElement;
}

describe("EstateOverview", () => {
  it("renders stat cards", () => {
    renderWithProviders(
      <EstateOverview
        fileCount={2}
        analysisResults={{ fw1: minimalAnalysisResult(), fw2: minimalAnalysisResult() }}
        totalFindings={10}
        totalRules={100}
        totalSections={20}
        totalPopulated={16}
        extractionPct={80}
        aggregatedPosture={emptyInspectionPosture()}
      />,
    );

    expect(within(cardRoot("Firewalls")).getByText("2")).toBeInTheDocument();
    expect(within(cardRoot("Issues")).getByText("10")).toBeInTheDocument();
  });

  it("renders without crashing when no results", () => {
    const { container } = renderWithProviders(
      <EstateOverview
        fileCount={0}
        analysisResults={{}}
        totalFindings={0}
        totalRules={0}
        totalSections={0}
        totalPopulated={0}
        extractionPct={0}
        aggregatedPosture={emptyInspectionPosture()}
      />,
    );

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText(/No issues detected in deterministic analysis/i)).toBeInTheDocument();
  });

  it("calls onExplainFinding when clicking a finding", async () => {
    const user = userEvent.setup();
    const onExplainFinding = vi.fn();
    const finding: Finding = {
      id: "f1",
      severity: "high",
      title: "Test finding title",
      detail: "Detail text",
      section: "Firewall Rules",
    };

    renderWithProviders(
      <EstateOverview
        fileCount={1}
        analysisResults={{ fw1: minimalAnalysisResult({ findings: [finding] }) }}
        totalFindings={1}
        totalRules={5}
        totalSections={10}
        totalPopulated={8}
        extractionPct={80}
        aggregatedPosture={emptyInspectionPosture()}
        onExplainFinding={onExplainFinding}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Expand all" }));
    await user.click(screen.getByRole("button", { name: /Explain this finding/i }));

    expect(onExplainFinding).toHaveBeenCalledTimes(1);
    expect(onExplainFinding).toHaveBeenCalledWith("Test finding title");
  });
});
