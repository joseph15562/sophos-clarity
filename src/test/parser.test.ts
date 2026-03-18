import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { extractSections } from "@/lib/extract-sections";
import { analyseConfig, analyseMultiConfig } from "@/lib/analyse-config";

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, "fixtures", name), "utf-8");
}

describe("extractSections", () => {
  const html = loadFixture("basic-firewall.html");
  let sections: Awaited<ReturnType<typeof extractSections>>;

  beforeAll(async () => {
    sections = await extractSections(html);
  });

  it("extracts firewall rules section", () => {
    const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k));
    expect(fwKey).toBeDefined();
    const fw = sections[fwKey!];
    expect(fw.tables.length).toBeGreaterThanOrEqual(1);
    expect(fw.tables[0].rows.length).toBe(6);
  });

  it("preserves main table header columns", () => {
    const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k))!;
    const headers = sections[fwKey].tables[0].headers;
    expect(headers).toContain("Rule Name");
    expect(headers).toContain("Services");
    expect(headers).toContain("Status");
  });

  it("merges detail block data into rule rows", () => {
    const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k))!;
    const headers = sections[fwKey].tables[0].headers;
    expect(headers).toContain("Destination Zones");
    expect(headers).toContain("Web Filter");
    expect(headers).toContain("Intrusion Prevention");
    expect(headers).toContain("Application Control");
    expect(headers).toContain("Log Traffic");
  });

  it("maps row values to header keys including detail data", () => {
    const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k))!;
    const row0 = sections[fwKey].tables[0].rows[0];
    expect(row0["Rule Name"]).toBe("Allow-Internet");
    expect(row0["Destination Zones"]).toBe("WAN");
    expect(row0["Web Filter"]).toBe("Default Policy");
    expect(row0["Log Traffic"]).toBe("Enable");
    expect(row0["Intrusion Prevention"]).toBe("GeneralPolicy");
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

  it("extracts web filter policies section", () => {
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
  let sections: Awaited<ReturnType<typeof extractSections>>;
  let result: ReturnType<typeof analyseConfig>;

  beforeAll(async () => {
    sections = await extractSections(html);
    result = analyseConfig(sections);
  });

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

  it("detects web filter coverage (enabled rules only)", () => {
    expect(result.inspectionPosture.withWebFilter).toBe(1);
    expect(result.inspectionPosture.withoutWebFilter).toBe(2);
    expect(result.inspectionPosture.enabledWanRules).toBe(3);
    expect(result.inspectionPosture.disabledWanRules).toBe(1);
  });

  it("counts web-filterable enabled WAN rules", () => {
    expect(result.inspectionPosture.webFilterableRules).toBe(3);
  });

  it("flags enabled WAN rules missing web filtering (excludes disabled)", () => {
    const finding = result.findings.find((f) => f.title.includes("missing web filtering"));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("critical");
    expect(finding!.detail).not.toContain("Guest-Web");
    expect(finding!.detail).toContain("Open-WAN");
  });

  it("flags disabled WAN rules", () => {
    const finding = result.findings.find((f) => f.title.includes("disabled"));
    expect(finding).toBeDefined();
    expect(finding!.detail).toContain("Guest-Web");
  });

  it("SSL/TLS inspection (DPI) is false when no SSL/TLS inspection rules exist", () => {
    expect(result.inspectionPosture.dpiEngineEnabled).toBe(false);
    expect(result.inspectionPosture.sslDecryptRules).toBe(0);
    expect(result.inspectionPosture.sslExclusionRules).toBe(0);
    expect(result.inspectionPosture.sslRules).toHaveLength(0);
    expect(result.inspectionPosture.sslUncoveredZones).toHaveLength(0);
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
    expect(finding!.detail).toContain("VPN-Access");
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

  it("flags MFA/OTP disabled services", () => {
    const finding = result.findings.find((f) => f.title.includes("MFA not required"));
    expect(finding).toBeDefined();
    expect(finding!.detail).toContain("VPN portal");
    expect(finding!.detail).toContain("IPsec remote access");
  });

  it("flags missing SSL/TLS inspection (DPI inactive)", () => {
    const finding = result.findings.find((f) => f.title.includes("SSL/TLS inspection"));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("critical");
    expect(finding!.title).toContain("DPI inactive");
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

describe("extractSections — minimal-sophos fixture", () => {
  const html = loadFixture("minimal-sophos.html");
  let sections: Awaited<ReturnType<typeof extractSections>>;

  beforeAll(async () => {
    sections = await extractSections(html);
  });

  it("extracts firewall rules with row-count parity", () => {
    const fwKey = Object.keys(sections).find((k) => /firewall\s*rules?/i.test(k));
    expect(fwKey).toBeDefined();
    const totalRows = sections[fwKey!].tables.reduce((sum, t) => sum + t.rows.length, 0);
    expect(totalRows).toBe(2);
  });

  it("extracts zones with row-count parity", () => {
    const zoneKey = Object.keys(sections).find((k) => /zone/i.test(k));
    expect(zoneKey).toBeDefined();
    const totalRows = sections[zoneKey!].tables.reduce((sum, t) => sum + t.rows.length, 0);
    expect(totalRows).toBe(2);
  });
});

describe("analyseConfig — minimal-sophos fixture", () => {
  const html = loadFixture("minimal-sophos.html");
  let sections: Awaited<ReturnType<typeof extractSections>>;
  let result: ReturnType<typeof analyseConfig>;

  beforeAll(async () => {
    sections = await extractSections(html);
    result = analyseConfig(sections);
  });

  it("counts rules from second fixture", () => {
    expect(result.stats.totalRules).toBe(2);
  });

  it("detects zones", () => {
    expect(result.stats.totalSections).toBeGreaterThanOrEqual(2);
  });
});

describe("analyseMultiConfig", () => {
  const html = loadFixture("basic-firewall.html");
  let sections: Awaited<ReturnType<typeof extractSections>>;

  beforeAll(async () => {
    sections = await extractSections(html);
  });

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
