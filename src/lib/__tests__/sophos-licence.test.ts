import { describe, it, expect } from "vitest";
import { getActiveModules, computeSophosBPScore, type ModuleId } from "../sophos-licence";
import type { AnalysisResult, InspectionPosture, ConfigStats } from "@/lib/analyse-config";

function mockInspectionPosture(overrides: Partial<InspectionPosture> = {}): InspectionPosture {
  return {
    totalWanRules: 10,
    enabledWanRules: 10,
    disabledWanRules: 0,
    webFilterableRules: 10,
    withWebFilter: 10,
    withoutWebFilter: 0,
    withAppControl: 10,
    withIps: 10,
    withSslInspection: 1,
    sslDecryptRules: 1,
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
    ...overrides,
  };
}

function mockStats(overrides: Partial<ConfigStats> = {}): ConfigStats {
  return {
    totalRules: 10,
    totalSections: 5,
    totalHosts: 5,
    totalNatRules: 2,
    interfaces: 4,
    populatedSections: 5,
    emptySections: 0,
    sectionNames: ["Firewall Rules", "NAT", "Zones", "Hosts", "SSL/TLS"],
    ...overrides,
  };
}

function mockAnalysisResult(overrides: {
  stats?: Partial<ConfigStats>;
  inspectionPosture?: Partial<InspectionPosture>;
  findings?: AnalysisResult["findings"];
} = {}): AnalysisResult {
  const stats = mockStats(overrides.stats);
  const inspectionPosture = mockInspectionPosture(overrides.inspectionPosture);
  const findings = overrides.findings ?? [];
  return { stats, findings, inspectionPosture };
}

describe("getActiveModules", () => {
  it("returns networkProtection and webProtection for standard tier", () => {
    const modules = getActiveModules({ tier: "standard", modules: [] });
    expect(modules).toEqual(["networkProtection", "webProtection"]);
  });

  it("returns all five modules for xstream tier", () => {
    const modules = getActiveModules({ tier: "xstream", modules: [] });
    expect(modules).toEqual([
      "networkProtection",
      "webProtection",
      "zeroDayProtection",
      "centralOrchestration",
      "dnsProtection",
    ]);
  });

  it("returns selected modules for individual tier", () => {
    const modules = getActiveModules({
      tier: "individual",
      modules: ["networkProtection", "dnsProtection"],
    });
    expect(modules).toEqual(["networkProtection", "dnsProtection"]);
  });

  it("returns empty array for individual tier with no modules selected", () => {
    const modules = getActiveModules({ tier: "individual", modules: [] });
    expect(modules).toEqual([]);
  });
});

describe("computeSophosBPScore", () => {
  it("produces valid score and grade with sample AnalysisResult", () => {
    const result = mockAnalysisResult();
    const licence = { tier: "standard" as const, modules: [] as ModuleId[] };
    const score = computeSophosBPScore(result, licence);

    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(["A", "B", "C", "D", "F"]).toContain(score.grade);
    expect(typeof score.passed).toBe("number");
    expect(typeof score.failed).toBe("number");
    expect(typeof score.warnings).toBe("number");
    expect(typeof score.notApplicable).toBe("number");
    expect(typeof score.total).toBe("number");
    expect(Array.isArray(score.results)).toBe(true);
  });

  it("returns grade A for perfect posture with standard licence", () => {
    const result = mockAnalysisResult();
    const score = computeSophosBPScore(result, { tier: "standard", modules: [] });
    expect(score.grade).toBe("A");
    expect(score.overall).toBeGreaterThanOrEqual(90);
  });

  it("handles empty findings array without crashing", () => {
    const result = mockAnalysisResult({ findings: [] });
    const score = computeSophosBPScore(result, { tier: "xstream", modules: [] });

    expect(score.overall).toBeDefined();
    expect(score.grade).toBeDefined();
    expect(score.results).toBeDefined();
    expect(score.results.length).toBeGreaterThan(0);
  });

  it("respects manual overrides for warn-status checks", () => {
    const result = mockAnalysisResult();
    const scoreWithoutOverride = computeSophosBPScore(result, { tier: "standard", modules: [] });
    const warnCheck = scoreWithoutOverride.results.find((r) => r.status === "warn");
    if (warnCheck) {
      const scoreWithOverride = computeSophosBPScore(result, { tier: "standard", modules: [] }, new Set([warnCheck.check.id]));
      const overriddenResult = scoreWithOverride.results.find((r) => r.check.id === warnCheck.check.id);
      expect(overriddenResult?.status).toBe("pass");
      expect(overriddenResult?.manualOverride).toBe(true);
    }
  });
});
