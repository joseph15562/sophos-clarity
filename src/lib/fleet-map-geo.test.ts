import { describe, expect, it } from "vitest";
import { buildFleetMapSites } from "./fleet-map-geo";
import type { FleetFirewall } from "./fleet-command-data";

function fw(
  p: Partial<FleetFirewall> & Pick<FleetFirewall, "id" | "hostname" | "customer">,
): FleetFirewall {
  return {
    score: 80,
    grade: "B",
    findings: 0,
    criticalFindings: 0,
    lastAssessed: null,
    status: "online",
    firmware: "",
    model: "XGS 2100",
    serialNumber: "",
    source: "central",
    configLinked: true,
    complianceCountry: "United Kingdom",
    complianceState: "",
    complianceEnvironment: "",
    customerComplianceCountry: "",
    mapLatitude: null,
    mapLongitude: null,
    centralGeoLatitude: null,
    centralGeoLongitude: null,
    ...p,
  };
}

describe("buildFleetMapSites", () => {
  it("creates one site per firewall", () => {
    const sites = buildFleetMapSites([
      fw({ id: "1", hostname: "fw-a", customer: "Acme", complianceCountry: "United Kingdom" }),
      fw({ id: "2", hostname: "fw-b", customer: "Acme", complianceCountry: "United Kingdom" }),
      fw({ id: "3", hostname: "fw-c", customer: "Beta", complianceCountry: "United States" }),
    ]);
    expect(sites).toHaveLength(3);
    expect(sites.every((s) => s.firewallCount === 1)).toBe(true);
    const acmeA = sites.find((s) => s.id === "1");
    expect(acmeA?.firewalls[0].hostname).toBe("fw-a");
    const beta = sites.find((s) => s.id === "3");
    expect(beta?.countryLabel).toMatch(/United States|Map pin|Sophos|Unknown/i);
  });

  it("uses MSP map coordinates when set", () => {
    const sites = buildFleetMapSites([
      fw({
        id: "p1",
        hostname: "pinned",
        customer: "Acme",
        complianceCountry: "United Kingdom",
        mapLatitude: 48.8566,
        mapLongitude: 2.3522,
      }),
    ]);
    expect(sites).toHaveLength(1);
    expect(sites[0].lat).toBeCloseTo(48.8566, 4);
    expect(sites[0].lng).toBeCloseTo(2.3522, 4);
    expect(sites[0].countryLabel).toContain("Map pin");
  });

  it("passes through Sophos tenant name for map hover", () => {
    const sites = buildFleetMapSites([
      fw({
        id: "t1",
        hostname: "fw-1",
        customer: "Acme Ltd",
        tenantName: "Acme Sophos Tenant",
        complianceCountry: "United Kingdom",
      }),
    ]);
    expect(sites[0].tenantName).toBe("Acme Sophos Tenant");
  });
});
