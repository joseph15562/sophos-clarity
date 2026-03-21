import { describe, it, expect } from "vitest";
import { analyseConfig } from "@/lib/analyse-config";
import type { ExtractedSections, SectionData, TableData } from "@/lib/extract-sections";

function buildSections(overrides: Partial<Record<string, SectionData>> = {}): ExtractedSections {
  const base: ExtractedSections = {};
  return { ...base, ...overrides } as ExtractedSections;
}

function buildFirewallRulesSection(
  rules: Record<string, string>[],
): { tables: TableData[]; text?: string; details?: unknown[] } {
  const headers = rules.length > 0 ? Object.keys(rules[0]) : [];
  return { tables: [{ headers, rows: rules }], text: "", details: [] };
}

describe("analyseConfig", () => {
  describe("basic structure", () => {
    it("returns valid AnalysisResult when given empty sections", () => {
      const result = analyseConfig({});
      expect(result).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.inspectionPosture).toBeDefined();
      // Empty sections produce "No firewall rules found" info finding
      expect(result.findings.some((f) => f.title.includes("No firewall rules"))).toBe(true);
    });

    it("returns correct stats shape with empty sections", () => {
      const result = analyseConfig({});
      expect(result.stats).toMatchObject({
        totalRules: 0,
        totalSections: 0,
        totalHosts: 0,
        totalNatRules: 0,
        interfaces: 0,
        populatedSections: 0,
        emptySections: 0,
        sectionNames: [],
      });
    });

    it("returns correct stats when sections have data", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Rule1",
            "Source Zone": "LAN",
            "Destination Zones": "WAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
            "Web Filter": "Default",
            IPS: "Default",
            "Application Control": "Default",
          },
        ]),
      });
      const result = analyseConfig(sections);
      expect(result.stats.totalRules).toBe(1);
      expect(result.stats.totalSections).toBe(1);
      expect(result.stats.sectionNames).toContain("Firewall Rules");
    });
  });

  describe("firewall rule analysis", () => {
    it("flags WAN rules with logging disabled", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "WAN-Web",
            "Source Zone": "LAN",
            "Destination Zones": "WAN",
            Service: "HTTP",
            Log: "Disabled",
            Status: "On",
            "Web Filter": "Default",
            IPS: "Default",
            "Application Control": "Default",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) => f.title.includes("logging disabled") && f.section === "Firewall Rules",
      );
      expect(finding).toBeDefined();
      expect(finding?.title).toContain("1 rule");
    });

    it("flags WAN rules with Service ANY", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "WAN-Any",
            "Source Zone": "LAN",
            "Destination Zones": "WAN",
            Service: "ANY",
            Log: "Enabled",
            Status: "On",
            "Web Filter": "Default",
            IPS: "Default",
            "Application Control": "Default",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) => f.title.includes('"ANY" service') && f.section === "Firewall Rules",
      );
      expect(finding).toBeDefined();
    });

    it("flags WAN rules without web filter", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "WAN-NoFilter",
            "Source Zone": "LAN",
            "Destination Zones": "WAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
            "Web Filter": "",
            IPS: "Default",
            "Application Control": "Default",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) => f.title.includes("missing web filtering") && f.section === "Firewall Rules",
      );
      expect(finding).toBeDefined();
    });

    it("omits webFilterExemptRuleNames from posture web-filter counts (baseline / BP score scope)", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "InScope",
            "Source Zone": "LAN",
            "Destination Zones": "WAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
            "Web Filter": "Default",
            IPS: "Default",
            "Application Control": "Default",
          },
          {
            "Rule Name": "Excluded-By-MSP",
            "Source Zone": "LAN",
            "Destination Zones": "WAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
            "Web Filter": "",
            IPS: "Default",
            "Application Control": "Default",
          },
        ]),
      });
      const result = analyseConfig(sections, { webFilterExemptRuleNames: ["Excluded-By-MSP"] });
      expect(result.inspectionPosture.webFilterableRules).toBe(1);
      expect(result.inspectionPosture.withWebFilter).toBe(1);
      expect(result.inspectionPosture.withoutWebFilter).toBe(0);
      const finding = result.findings.find(
        (f) => f.title.includes("missing web filtering") && f.section === "Firewall Rules",
      );
      expect(finding).toBeUndefined();
    });

    it("does NOT flag LAN-to-LAN rules without web filter", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "LAN-to-LAN",
            "Source Zone": "LAN",
            "Destination Zones": "LAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
            "Web Filter": "",
            IPS: "Default",
            "Application Control": "Default",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) => f.title.includes("missing web filtering") && f.section === "Firewall Rules",
      );
      expect(finding).toBeUndefined();
    });

    it("flags disabled WAN rules", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Disabled-WAN",
            "Source Zone": "LAN",
            "Destination Zones": "WAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "Off",
            "Web Filter": "Default",
            IPS: "Default",
            "Application Control": "Default",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) => f.title.includes("WAN rule") && f.title.includes("disabled") && f.section === "Firewall Rules",
      );
      expect(finding).toBeDefined();
    });
  });

  describe("IPS and App Control", () => {
    it("flags WAN rules without IPS", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "WAN-NoIPS",
            "Source Zone": "LAN",
            "Destination Zones": "WAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
            "Web Filter": "Default",
            IPS: "",
            "Application Control": "Default",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) => f.title.includes("without IPS") && f.section === "Intrusion Prevention",
      );
      expect(finding).toBeDefined();
    });

    it("does NOT flag WAN rules with IPS", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "WAN-WithIPS",
            "Source Zone": "LAN",
            "Destination Zones": "WAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
            "Web Filter": "Default",
            IPS: "Default",
            "Application Control": "Default",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) => f.title.includes("without IPS") && f.section === "Intrusion Prevention",
      );
      expect(finding).toBeUndefined();
    });
  });

  describe("Authentication/OTP", () => {
    it("generates MFA disabled findings when OTP is off", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Rule1",
            "Source Zone": "LAN",
            "Destination Zones": "LAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
          },
        ]),
        "Authentication & OTP Settings": {
          tables: [
            {
              headers: ["Setting", "Value"],
              rows: [
                { Setting: "otp", Value: "NoOTP" },
              ],
            },
          ],
          text: "",
          details: [],
        },
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) => f.title.includes("MFA/OTP is completely disabled") && f.section === "Authentication & OTP",
      );
      expect(finding).toBeDefined();
    });
  });

  describe("SSL/TLS inspection (DPI)", () => {
    it("flags missing DPI rules when WAN rules exist", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "WAN-Web",
            "Source Zone": "LAN",
            "Destination Zones": "WAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
            "Web Filter": "Default",
            IPS: "Default",
            "Application Control": "Default",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) =>
          (f.title.includes("No SSL/TLS inspection") || f.title.includes("DPI inactive")) &&
          f.section === "SSL/TLS Inspection",
      );
      expect(finding).toBeDefined();
    });

    it("does NOT flag when DPI rules are present", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "WAN-Web",
            "Source Zone": "LAN",
            "Destination Zones": "WAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
            "Web Filter": "Default",
            IPS: "Default",
            "Application Control": "Default",
          },
        ]),
        "SSL TLS Inspection Rules": {
          tables: [
            {
              headers: ["Rule Name", "Decrypt Action", "Source Zone", "Destination Zones", "Status"],
              rows: [
                {
                  "Rule Name": "Decrypt-LAN-WAN",
                  "Decrypt Action": "Decrypt",
                  "Source Zone": "LAN",
                  "Destination Zones": "WAN",
                  Status: "On",
                },
              ],
            },
          ],
          text: "",
          details: [],
        },
      });
      const result = analyseConfig(sections);
      const dpiFinding = result.findings.find(
        (f) =>
          (f.title.includes("No SSL/TLS inspection") || f.title.includes("DPI inactive")) &&
          f.section === "SSL/TLS Inspection",
      );
      expect(dpiFinding).toBeUndefined();
    });
  });

  describe("Admin access", () => {
    it("flags HTTPS admin on WAN as critical", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Rule1",
            "Source Zone": "LAN",
            "Destination Zones": "LAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
          },
        ]),
        "Local Service ACL": {
          tables: [
            {
              headers: ["Service", "LAN", "WAN", "DMZ"],
              rows: [
                { Service: "HTTPS", LAN: "Enabled", WAN: "Enabled", DMZ: "Disabled" },
              ],
            },
          ],
          text: "",
          details: [],
        },
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) =>
          f.title.includes("Admin console accessible from WAN") &&
          f.section === "Local Service ACL",
      );
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("critical");
    });
  });

  describe("VPN security", () => {
    it("flags used VPN profile with weak encryption", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Rule1",
            "Source Zone": "LAN",
            "Destination Zones": "LAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
          },
        ]),
        "VPN IPSec Connections": {
          tables: [
            {
              headers: ["Name", "Policy", "Authentication Type"],
              rows: [{ Name: "Site-to-Site", Policy: "WeakProfile", "Authentication Type": "Preshared" }],
            },
          ],
          text: "",
          details: [],
        },
        "VPN Profiles": {
          tables: [
            {
              headers: ["Name", "Phase 1 Encryption", "Phase 2 Encryption", "Phase 1 Auth", "Phase 2 Auth", "Phase 1 DH Groups"],
              rows: [
                {
                  Name: "WeakProfile",
                  "Phase 1 Encryption": "3DES",
                  "Phase 2 Encryption": "3DES",
                  "Phase 1 Auth": "MD5",
                  "Phase 2 Auth": "MD5",
                  "Phase 1 DH Groups": "DH2",
                },
              ],
            },
          ],
          text: "",
          details: [],
        },
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) =>
          f.title.includes("weak encryption") && f.section === "VPN Security",
      );
      expect(finding).toBeDefined();
    });

    it("does NOT flag unused VPN profile with weak encryption", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Rule1",
            "Source Zone": "LAN",
            "Destination Zones": "LAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
          },
        ]),
        "VPN IPSec Connections": {
          tables: [
            {
              headers: ["Name", "Policy", "Authentication Type"],
              rows: [{ Name: "Site-to-Site", Policy: "StrongProfile", "Authentication Type": "Certificate" }],
            },
          ],
          text: "",
          details: [],
        },
        "VPN Profiles": {
          tables: [
            {
              headers: ["Name", "Phase 1 Encryption", "Phase 2 Encryption", "Phase 1 Auth", "Phase 2 Auth", "Phase 1 DH Groups"],
              rows: [
                {
                  Name: "UnusedWeakProfile",
                  "Phase 1 Encryption": "3DES",
                  "Phase 2 Encryption": "3DES",
                  "Phase 1 Auth": "MD5",
                  "Phase 2 Auth": "MD5",
                  "Phase 1 DH Groups": "DH2",
                },
                {
                  Name: "StrongProfile",
                  "Phase 1 Encryption": "AES-256",
                  "Phase 2 Encryption": "AES-256",
                  "Phase 1 Auth": "SHA256",
                  "Phase 2 Auth": "SHA256",
                  "Phase 1 DH Groups": "DH14",
                },
              ],
            },
          ],
          text: "",
          details: [],
        },
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) =>
          f.title.includes("weak encryption") && f.section === "VPN Security",
      );
      expect(finding).toBeUndefined();
    });
  });

  describe("Wireless", () => {
    it("produces no wireless findings when no APs", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Rule1",
            "Source Zone": "LAN",
            "Destination Zones": "LAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const wirelessFindings = result.findings.filter(
        (f) => f.section === "Wireless Security",
      );
      expect(wirelessFindings).toHaveLength(0);
    });

    it("flags active APs with weak encryption", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Rule1",
            "Source Zone": "LAN",
            "Destination Zones": "LAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
          },
        ]),
        "Wireless Access Point": {
          tables: [
            {
              headers: ["Name", "Status"],
              rows: [{ Name: "AP1", Status: "Online" }],
            },
          ],
          text: "",
          details: [],
        },
        "Wireless Network": {
          tables: [
            {
              headers: ["Name", "Security Mode", "Encryption", "Status"],
              rows: [
                { Name: "GuestNet", "Security Mode": "WEP", Encryption: "WEP", Status: "Enabled" },
              ],
            },
          ],
          text: "",
          details: [],
        },
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) =>
          f.title.includes("weak encryption") && f.section === "Wireless Security",
      );
      expect(finding).toBeDefined();
    });
  });

  describe("External logging", () => {
    it("flags no syslog + no Central as finding", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Rule1",
            "Source Zone": "LAN",
            "Destination Zones": "LAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) =>
          f.title.includes("No external log forwarding") &&
          f.section === "Logging & Monitoring",
      );
      expect(finding).toBeDefined();
    });

    it("does NOT flag when Central-managed", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Central Created Rule",
            "Source Zone": "LAN",
            "Destination Zones": "LAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) =>
          f.title.includes("No external log forwarding") &&
          f.section === "Logging & Monitoring",
      );
      expect(finding).toBeUndefined();
    });
  });

  describe("D1: Rule ordering", () => {
    it("flags deny rule shadowed by earlier allow", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Allow-All",
            "Source Zone": "LAN",
            "Source Networks": "Any",
            "Destination Zones": "WAN",
            "Destination Networks": "Any",
            Service: "HTTP",
            Action: "Accept",
            Log: "Enabled",
            Status: "On",
          },
          {
            "Rule Name": "Deny-Bad",
            "Source Zone": "LAN",
            "Source Networks": "Any",
            "Destination Zones": "WAN",
            "Destination Networks": "Any",
            Service: "HTTP",
            Action: "Deny",
            Log: "Enabled",
            Status: "On",
          },
        ]),
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) =>
          f.title.includes("shadowed by earlier allow") &&
          f.section === "Rule Hygiene",
      );
      expect(finding).toBeDefined();
    });
  });

  describe("D4: WAF", () => {
    it("flags DNAT without WAF protection", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Rule1",
            "Source Zone": "LAN",
            "Destination Zones": "LAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
          },
        ]),
        "NAT Rules": {
          tables: [
            {
              headers: ["Rule Name", "Type", "Translated To"],
              rows: [
                {
                  "Rule Name": "Web-Server-DNAT",
                  Type: "DNAT",
                  "Translated To": "192.168.1.10",
                },
              ],
            },
          ],
          text: "",
          details: [],
        },
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) =>
          (f.title.includes("without WAF") || f.title.includes("Published web servers")) &&
          f.section === "Traffic Inspection",
      );
      expect(finding).toBeDefined();
    });
  });

  describe("D6: Firmware EOL", () => {
    it("flags firmware EOL when version is past EOL date", () => {
      const sections = buildSections({
        "Firewall Rules": buildFirewallRulesSection([
          {
            "Rule Name": "Rule1",
            "Source Zone": "LAN",
            "Destination Zones": "LAN",
            Service: "HTTP",
            Log: "Enabled",
            Status: "On",
          },
        ]),
        "Device Info": {
          tables: [
            {
              headers: ["Setting", "Value"],
              rows: [{ Setting: "Firmware", Value: "SFOS 18.0.0" }],
            },
          ],
          text: "",
          details: [],
        },
      });
      const result = analyseConfig(sections);
      const finding = result.findings.find(
        (f) =>
          f.title.includes("end-of-life firmware") &&
          f.section === "Device Hardening",
      );
      expect(finding).toBeDefined();
    });
  });
});
