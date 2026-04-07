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
    ...p,
  };
}

describe("buildFleetMapSites", () => {
  it("groups firewalls by customer and lists hostnames", () => {
    const sites = buildFleetMapSites([
      fw({ id: "1", hostname: "fw-a", customer: "Acme", complianceCountry: "United Kingdom" }),
      fw({ id: "2", hostname: "fw-b", customer: "Acme", complianceCountry: "United Kingdom" }),
      fw({ id: "3", hostname: "fw-c", customer: "Beta", complianceCountry: "United States" }),
    ]);
    expect(sites).toHaveLength(2);
    const acme = sites.find((s) => s.customer === "Acme");
    expect(acme?.firewallCount).toBe(2);
    expect(acme?.firewalls.map((x) => x.hostname).sort()).toEqual(["fw-a", "fw-b"]);
    const beta = sites.find((s) => s.customer === "Beta");
    expect(beta?.countryLabel).toMatch(/United States/i);
  });
});
