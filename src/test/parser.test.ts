import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { extractSections } from "@/lib/extract-sections";
import { analyseConfig, analyseMultiConfig } from "@/lib/analyse-config";

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, "fixtures", name), "utf-8");
}

describe("extractSections", () => {
  const html = loadFixture("basic-firewall.html");
  const sections = extractSections(html);

  it("extracts firewall rules section", () => {
    const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k));
    expect(fwKey).toBeDefined();
    const fw = sections[fwKey!];
    expect(fw.tables.length).toBeGreaterThanOrEqual(1);
    expect(fw.tables[0].rows.length).toBe(6);
  });

  it("preserves header columns", () => {
    const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k))!;
    const headers = sections[fwKey].tables[0].headers;
    expect(headers).toContain("Rule Name");
    expect(headers).toContain("Service");
    expect(headers).toContain("Web Filter");
    expect(headers).toContain("IPS");
  });

  it("maps row values to header keys", () => {
    const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k))!;
    const row0 = sections[fwKey].tables[0].rows[0];
    expect(row0["Rule Name"]).toBe("Allow-Internet");
    expect(row0["Destination Zone"]).toBe("WAN");
    expect(row0["Web Filter"]).toBe("Default Policy");
  });

  it("extracts NAT rules", () => {
    const natKey = Object.keys(sections).find((k) => /nat/i.test(k));
    expect(natKey).toBeDefined();
    expect(sections[natKey!].tables[0].rows.length).toBe(2);
  });

  it("extracts zones section", () => {
    const zoneKey = Object.keys(sections).find((k) => /zone/i.test(k));
    expect(zoneKey).toBeDefined();
    expect(sections[zoneKey!].tables[0].rows.length).toBe(4);
  });

  it("extracts OTP settings from grid layout", () => {
    const otpKey = Object.keys(sections).find((k) => /otp|authentication/i.test(k));
    expect(otpKey).toBeDefined();
    const otpRows = sections[otpKey!].tables.flatMap((t) => t.rows);
    expect(otpRows.length).toBeGreaterThanOrEqual(3);
    const vpnPortal = otpRows.find((r) => r["Setting"]?.includes("otpVPNPortal"));
    expect(vpnPortal).toBeDefined();
    expect(vpnPortal!["Value"]).toBe("Disabled");
  });

  it("extracts web filter section", () => {
    const wfKey = Object.keys(sections).find((k) => /web\s*filter/i.test(k));
    expect(wfKey).toBeDefined();
    expect(sections[wfKey!].tables[0].rows.length).toBe(1);
  });

  it("snapshot of all section keys", () => {
    expect(Object.keys(sections).sort()).toMatchSnapshot();
  });
});

describe("analyseConfig", () => {
  const html = loadFixture("basic-firewall.html");
  const sections = extractSections(html);
  const result = analyseConfig(sections);

  it("counts total rules correctly", () => {
    expect(result.stats.totalRules).toBe(6);
  });

  it("counts NAT rules", () => {
    expect(result.stats.totalNatRules).toBe(2);
  });

  it("counts sections", () => {
    expect(result.stats.totalSections).toBeGreaterThanOrEqual(5);
  });

  it("detects WAN rules", () => {
    expect(result.inspectionPosture.totalWanRules).toBe(4);
  });

  it("detects web filter coverage", () => {
    expect(result.inspectionPosture.withWebFilter).toBe(1);
    expect(result.inspectionPosture.withoutWebFilter).toBe(3);
  });

  it("flags WAN rules missing web filtering", () => {
    const finding = result.findings.find((f) => f.title.includes("missing web filtering"));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("critical");
    expect(finding!.detail).toContain("Guest-Web");
  });

  it("flags logging disabled", () => {
    const finding = result.findings.find((f) => f.title.includes("logging disabled"));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("high");
    expect(finding!.detail).toContain("Guest-Web");
  });

  it("flags ANY service rules", () => {
    const finding = result.findings.find((f) => f.title.includes('"ANY" service'));
    expect(finding).toBeDefined();
    expect(finding!.detail).toContain("Open-WAN");
  });

  it("flags broad source and destination", () => {
    const finding = result.findings.find((f) => f.title.includes("broad source and destination"));
    expect(finding).toBeDefined();
  });

  it("detects duplicate/overlapping rules", () => {
    const finding = result.findings.find((f) => f.title.includes("overlapping"));
    expect(finding).toBeDefined();
    expect(finding!.detail).toContain("Open-WAN");
    expect(finding!.detail).toContain("Duplicate-WAN");
  });

  it("flags MFA/OTP disabled", () => {
    const finding = result.findings.find((f) => f.title.includes("MFA/OTP"));
    expect(finding).toBeDefined();
    expect(finding!.detail).toContain("otpVPNPortal");
    expect(finding!.detail).toContain("otpIPsec");
  });

  it("flags missing SSL/TLS inspection", () => {
    const finding = result.findings.find((f) => f.title.includes("SSL/TLS inspection"));
    expect(finding).toBeDefined();
  });

  it("all findings have remediation text", () => {
    const actionable = result.findings.filter((f) => f.severity !== "info");
    for (const f of actionable) {
      expect(f.remediation, `Finding "${f.title}" missing remediation`).toBeDefined();
      expect(f.remediation!.length).toBeGreaterThan(10);
    }
  });

  it("snapshot of findings", () => {
    const summary = result.findings.map((f) => ({
      severity: f.severity,
      title: f.title,
      section: f.section,
    }));
    expect(summary).toMatchSnapshot();
  });
});

describe("analyseMultiConfig", () => {
  const html = loadFixture("basic-firewall.html");
  const sections = extractSections(html);

  it("aggregates across multiple firewalls", () => {
    const result = analyseMultiConfig({
      "FW-Office": sections,
      "FW-DC": sections,
    });
    expect(Object.keys(result.perFirewall)).toHaveLength(2);
    expect(result.totalRules).toBe(12);
    expect(result.totalFindings).toBeGreaterThan(0);
  });
});
