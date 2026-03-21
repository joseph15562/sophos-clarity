import { describe, it, expect } from "vitest";
import { mapToFramework, findingToFrameworks } from "../compliance-map";
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

describe("mapToFramework", () => {
  describe("return structure", () => {
    it("returns correct structure with framework, controls, and summary", () => {
      const result = mockAnalysisResult();
      const mapping = mapToFramework("NCSC Guidelines", result);
      expect(mapping).toHaveProperty("framework", "NCSC Guidelines");
      expect(mapping).toHaveProperty("controls");
      expect(mapping).toHaveProperty("summary");
      expect(Array.isArray(mapping.controls)).toBe(true);
      expect(mapping.summary).toHaveProperty("pass");
      expect(mapping.summary).toHaveProperty("partial");
      expect(mapping.summary).toHaveProperty("fail");
      expect(mapping.summary).toHaveProperty("na");
    });

    it("each control has controlId, controlName, category, status, relatedFindings, evidence", () => {
      const result = mockAnalysisResult();
      const mapping = mapToFramework("NCSC Guidelines", result);
      for (const control of mapping.controls) {
        expect(control).toHaveProperty("controlId");
        expect(control).toHaveProperty("controlName");
        expect(control).toHaveProperty("category");
        expect(control).toHaveProperty("status");
        expect(control).toHaveProperty("relatedFindings");
        expect(control).toHaveProperty("evidence");
        expect(["pass", "partial", "fail", "na"]).toContain(control.status);
      }
    });

    it("controlIds are prefixed with framework abbreviation", () => {
      const result = mockAnalysisResult();
      const mapping = mapToFramework("NCSC Guidelines", result);
      expect(mapping.controls.some((c) => c.controlId.startsWith("NCS"))).toBe(true);
    });
  });

  describe("control status determination", () => {
    it("returns pass for controls when no relevant findings exist", () => {
      const result = mockAnalysisResult({ findings: [] });
      const mapping = mapToFramework("NCSC Guidelines", result);
      const loggingControl = mapping.controls.find((c) => c.controlName === "Audit Logging");
      const mfaControl = mapping.controls.find((c) => c.controlName === "Multi-Factor Authentication");
      expect(loggingControl?.status).toBe("pass");
      expect(mfaControl?.status).toBe("pass");
    });

    it("returns fail for logging control when critical findings exist (logging disabled)", () => {
      const result = mockAnalysisResult({
        findings: [
          {
            id: "f1",
            severity: "high",
            title: "5 rules with logging disabled",
            detail: "Logging is turned off on several rules",
            section: "Firewall Rules",
          },
        ],
      });
      const mapping = mapToFramework("NCSC Guidelines", result);
      const loggingControl = mapping.controls.find((c) => c.controlName === "Audit Logging");
      expect(loggingControl?.status).toBe("fail");
      expect(loggingControl?.relatedFindings).toContain("f1");
    });

    it("returns fail for MFA control when MFA/OTP findings exist", () => {
      const result = mockAnalysisResult({
        findings: [
          {
            id: "f1",
            severity: "high",
            title: "MFA/OTP disabled for 2 areas",
            detail: "Multi-factor authentication is not enabled",
            section: "Authentication & OTP",
          },
        ],
      });
      const mapping = mapToFramework("NCSC Guidelines", result);
      const mfaControl = mapping.controls.find((c) => c.controlName === "Multi-Factor Authentication");
      expect(mfaControl?.status).toBe("fail");
    });

    it("returns fail for admin access when critical findings exist (admin console from WAN)", () => {
      const result = mockAnalysisResult({
        findings: [
          {
            id: "f1",
            severity: "critical",
            title: "Admin console accessible from WAN",
            detail: "Management services enabled on WAN zone",
            section: "Local Service ACL",
          },
        ],
      });
      const mapping = mapToFramework("NCSC Guidelines", result);
      const adminControl = mapping.controls.find((c) => c.controlName === "Admin Access Restriction");
      expect(adminControl?.status).toBe("fail");
    });

    it("returns fail for web filter when missing web filtering findings exist", () => {
      const result = mockAnalysisResult({
        inspectionPosture: {
          webFilterableRules: 10,
          withWebFilter: 2,
          withoutWebFilter: 8,
        },
        findings: [
          {
            id: "f1",
            severity: "critical",
            title: "8 enabled WAN rules missing web filtering",
            detail: "Active rules with no Web Filter applied",
            section: "Firewall Rules",
          },
        ],
      });
      const mapping = mapToFramework("NCSC Guidelines", result);
      const webFilterControl = mapping.controls.find((c) => c.controlName === "Web Content Filtering");
      expect(webFilterControl?.status).toBe("fail");
    });

    it("summary counts match control statuses", () => {
      const result = mockAnalysisResult();
      const mapping = mapToFramework("NCSC Guidelines", result);
      const passCount = mapping.controls.filter((c) => c.status === "pass").length;
      const partialCount = mapping.controls.filter((c) => c.status === "partial").length;
      const failCount = mapping.controls.filter((c) => c.status === "fail").length;
      const naCount = mapping.controls.filter((c) => c.status === "na").length;
      expect(mapping.summary.pass).toBe(passCount);
      expect(mapping.summary.partial).toBe(partialCount);
      expect(mapping.summary.fail).toBe(failCount);
      expect(mapping.summary.na).toBe(naCount);
    });
  });

  describe("unknown framework", () => {
    it("returns controls for unknown framework using all shared controls", () => {
      const result = mockAnalysisResult();
      const mapping = mapToFramework("Unknown Framework XYZ", result);
      expect(mapping.framework).toBe("Unknown Framework XYZ");
      expect(mapping.controls.length).toBeGreaterThan(0);
    });
  });
});

describe("findingToFrameworks", () => {
  it("returns empty array for unmapped finding title", () => {
    const frameworks = ["NCSC Guidelines", "ISO 27001"];
    const result = findingToFrameworks("Some unrelated finding title", frameworks);
    expect(result).toEqual([]);
  });

  it("maps missing web filtering finding to frameworks that include webFilter", () => {
    const frameworks = ["NCSC Guidelines", "DfE / KCSIE", "ISO 27001"];
    const result = findingToFrameworks("5 enabled WAN rules missing web filtering", frameworks);
    expect(result).toContain("NCSC Guidelines");
    expect(result).toContain("DfE / KCSIE");
    expect(result).toContain("ISO 27001");
  });

  it("maps SSL/TLS inspection finding to frameworks with dpiEngine or sslInspection", () => {
    const frameworks = ["NCSC Guidelines", "DfE / KCSIE", "ISO 27001"];
    const result = findingToFrameworks("No SSL/TLS inspection rules configured (DPI inactive)", frameworks);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("NCSC Guidelines");
    expect(result).toContain("DfE / KCSIE");
  });

  it("maps logging disabled finding to frameworks with logging control", () => {
    const frameworks = ["NCSC Guidelines", "ISO 27001", "GDPR"];
    const result = findingToFrameworks("3 rules with logging disabled", frameworks);
    expect(result).toContain("NCSC Guidelines");
    expect(result).toContain("ISO 27001");
    expect(result).toContain("GDPR");
  });

  it("maps MFA/OTP finding to frameworks with mfa control", () => {
    const frameworks = ["NCSC Guidelines", "Cyber Essentials / CE+", "GDPR"];
    const result = findingToFrameworks("MFA/OTP disabled for 1 area", frameworks);
    expect(result).toContain("NCSC Guidelines");
    expect(result).toContain("Cyber Essentials / CE+");
    expect(result).toContain("GDPR");
  });

  it("maps admin console finding to frameworks with adminAccess control", () => {
    const frameworks = ["NCSC Guidelines", "ISO 27001"];
    const result = findingToFrameworks("Admin console accessible from WAN", frameworks);
    expect(result).toContain("NCSC Guidelines");
    expect(result).toContain("ISO 27001");
  });

  it("filters to only selected frameworks that include the control", () => {
    const frameworks = ["NCSC Guidelines", "SOX"];
    const result = findingToFrameworks("5 rules with logging disabled", frameworks);
    expect(result).toContain("NCSC Guidelines");
    expect(result).toContain("SOX");
  });
});
