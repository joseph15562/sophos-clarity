import { describe, it, expect } from "vitest";
import { computeRiskScore } from "../risk-score";
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

describe("computeRiskScore", () => {
  describe("full coverage (grade A)", () => {
    it("returns grade A when all categories have full coverage", () => {
      const result = mockAnalysisResult();
      const score = computeRiskScore(result);
      expect(score.grade).toBe("A");
      expect(score.overall).toBeGreaterThanOrEqual(90);
      expect(score.categories).toHaveLength(9);
    });

    it("has all category scores at 100 for perfect posture", () => {
      const result = mockAnalysisResult();
      const score = computeRiskScore(result);
      for (const cat of score.categories) {
        expect(cat.score).toBe(100);
        expect(cat.pct).toBe(100);
      }
    });
  });

  describe("no WAN rules (edge case)", () => {
    it("handles zero WAN rules without error", () => {
      const result = mockAnalysisResult({
        inspectionPosture: {
          totalWanRules: 0,
          enabledWanRules: 0,
          disabledWanRules: 0,
          webFilterableRules: 0,
          withWebFilter: 0,
          withoutWebFilter: 0,
          withAppControl: 0,
          withIps: 0,
        },
      });
      const score = computeRiskScore(result);
      expect(score.overall).toBeDefined();
      expect(score.grade).toBeDefined();
      expect(score.categories).toHaveLength(9);
    });

    it("returns 100 for Web Filtering and IPS when no WAN rules (pctScore 0/0 = 100)", () => {
      const result = mockAnalysisResult({
        inspectionPosture: {
          totalWanRules: 0,
          enabledWanRules: 0,
          disabledWanRules: 0,
          webFilterableRules: 0,
          withWebFilter: 0,
          withoutWebFilter: 0,
          withAppControl: 0,
          withIps: 0,
        },
      });
      const score = computeRiskScore(result);
      const webFilter = score.categories.find((c) => c.label === "Web Filtering");
      const ips = score.categories.find((c) => c.label === "Intrusion Prevention");
      expect(webFilter?.score).toBe(100);
      expect(ips?.score).toBe(100);
    });
  });

  describe("zero findings (perfect score)", () => {
    it("returns grade A with 0 findings and full posture", () => {
      const result = mockAnalysisResult({ findings: [] });
      const score = computeRiskScore(result);
      expect(score.grade).toBe("A");
      expect(score.overall).toBe(100);
    });
  });

  describe("grade boundaries", () => {
    it("returns grade A when overall >= 90", () => {
      const result = mockAnalysisResult();
      const score = computeRiskScore(result);
      expect(score.overall).toBeGreaterThanOrEqual(90);
      expect(score.grade).toBe("A");
    });

    it("returns grade B when overall >= 75 and < 90", () => {
      const result = mockAnalysisResult({
        inspectionPosture: {
          withWebFilter: 5,
          webFilterableRules: 10,
          withIps: 5,
          enabledWanRules: 10,
          withAppControl: 5,
        },
        findings: [
          {
            id: "f1",
            severity: "medium",
            title: "1 rule with logging disabled",
            detail: "Logging off",
            section: "Firewall Rules",
          },
        ],
      });
      const score = computeRiskScore(result);
      expect(score.grade).toBe("B");
      expect(score.overall).toBeGreaterThanOrEqual(75);
      expect(score.overall).toBeLessThan(90);
    });

    it("returns grade C when overall >= 60 and < 75", () => {
      const result = mockAnalysisResult({
        inspectionPosture: {
          withWebFilter: 3,
          webFilterableRules: 10,
          withIps: 3,
          enabledWanRules: 10,
          withAppControl: 3,
          dpiEngineEnabled: false,
          totalWanRules: 10,
        },
        findings: [
          { id: "f1", severity: "high", title: "5 rules with logging disabled", detail: "", section: "Firewall Rules" },
          { id: "f2", severity: "high", title: "MFA/OTP disabled for 1 area", detail: "", section: "Authentication & OTP" },
        ],
      });
      const score = computeRiskScore(result);
      expect(score.grade).toBe("C");
      expect(score.overall).toBeGreaterThanOrEqual(60);
      expect(score.overall).toBeLessThan(75);
    });

    it("returns grade D when overall >= 40 and < 60", () => {
      const result = mockAnalysisResult({
        inspectionPosture: {
          withWebFilter: 1,
          webFilterableRules: 10,
          withIps: 1,
          enabledWanRules: 10,
          withAppControl: 1,
          dpiEngineEnabled: false,
          totalWanRules: 10,
          sslUncoveredZones: ["lan", "dmz"],
        },
        findings: [
          { id: "f1", severity: "high", title: "8 rules with logging disabled", detail: "", section: "Firewall Rules" },
          { id: "f2", severity: "critical", title: "MFA/OTP disabled for 2 areas", detail: "", section: "Authentication & OTP" },
          { id: "f3", severity: "medium", title: "3 rules with broad source and destination", detail: "", section: "Firewall Rules" },
          { id: "f4", severity: "critical", title: "Admin console accessible from WAN", detail: "", section: "Local Service ACL" },
        ],
      });
      const score = computeRiskScore(result);
      expect(score.grade).toBe("D");
      expect(score.overall).toBeGreaterThanOrEqual(40);
      expect(score.overall).toBeLessThan(60);
    });

    it("returns grade F when overall < 40", () => {
      const result = mockAnalysisResult({
        inspectionPosture: {
          withWebFilter: 0,
          webFilterableRules: 10,
          withIps: 0,
          enabledWanRules: 10,
          withAppControl: 0,
          dpiEngineEnabled: false,
          totalWanRules: 10,
          sslUncoveredZones: ["lan", "dmz", "guest"],
        },
        stats: { totalRules: 10 },
        findings: [
          { id: "f1", severity: "high", title: "10 rules with logging disabled", detail: "", section: "Firewall Rules" },
          { id: "f2", severity: "critical", title: "MFA/OTP disabled for 3 areas", detail: "", section: "Authentication & OTP" },
          { id: "f3", severity: "critical", title: "Admin console accessible from WAN", detail: "", section: "Local Service ACL" },
          { id: "f4", severity: "critical", title: "SSH accessible from WAN", detail: "", section: "Local Service ACL" },
          { id: "f5", severity: "high", title: "Virus scanning disabled for 2 protocols", detail: "", section: "Virus Scanning" },
        ],
      });
      const score = computeRiskScore(result);
      expect(score.grade).toBe("F");
      expect(score.overall).toBeLessThan(40);
    });
  });

  describe("category structure", () => {
    it("returns expected category labels", () => {
      const result = mockAnalysisResult();
      const score = computeRiskScore(result);
      const labels = score.categories.map((c) => c.label);
      expect(labels).toContain("Web Filtering");
      expect(labels).toContain("Intrusion Prevention");
      expect(labels).toContain("Application Control");
      expect(labels).toContain("Authentication");
      expect(labels).toContain("Logging");
      expect(labels).toContain("Rule Hygiene");
      expect(labels).toContain("Admin Access");
      expect(labels).toContain("Anti-Malware");
    });

    it("each category has score, maxScore, pct, and details", () => {
      const result = mockAnalysisResult();
      const score = computeRiskScore(result);
      for (const cat of score.categories) {
        expect(typeof cat.score).toBe("number");
        expect(typeof cat.maxScore).toBe("number");
        expect(typeof cat.pct).toBe("number");
        expect(typeof cat.details).toBe("string");
        expect(cat.maxScore).toBe(100);
      }
    });
  });
});
