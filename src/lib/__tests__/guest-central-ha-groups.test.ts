import { describe, expect, it } from "vitest";
import { buildGuestCentralHaGroups, guestHaGroupSelectValue } from "../guest-central-ha-groups";

describe("buildGuestCentralHaGroups", () => {
  it("merges same hostname into one group with both serials as peers", () => {
    const rows = [
      { id: "a", hostname: "firewall.example.com", serialNumber: "SN1", cluster: { status: "primary" } },
      { id: "b", hostname: "firewall.example.com", serialNumber: "SN2", cluster: { status: "auxiliary" } },
    ];
    const g = buildGuestCentralHaGroups(rows);
    expect(g).toHaveLength(1);
    expect(g[0].isHA).toBe(true);
    expect(g[0].primary.serialNumber).toBe("SN1");
    expect(g[0].peers.map((p) => p.serialNumber)).toEqual(["SN2"]);
  });

  it("picks primary by cluster.status when not first in list", () => {
    const rows = [
      { id: "b", hostname: "fw.test", serialNumber: "S2", cluster: { status: "auxiliary" } },
      { id: "a", hostname: "fw.test", serialNumber: "S1", cluster: { status: "primary" } },
    ];
    const g = buildGuestCentralHaGroups(rows);
    expect(g[0].primary.serialNumber).toBe("S1");
    expect(g[0].peers).toHaveLength(1);
  });

  it("keeps different hostnames separate", () => {
    const rows = [
      { hostname: "a.example", serialNumber: "A1" },
      { hostname: "b.example", serialNumber: "B1" },
    ];
    expect(buildGuestCentralHaGroups(rows)).toHaveLength(2);
  });
});

describe("guestHaGroupSelectValue", () => {
  it("uses id when present", () => {
    expect(
      guestHaGroupSelectValue({
        primary: { id: "fw-1", serialNumber: "X" },
        peers: [],
        isHA: false,
      }),
    ).toBe("id:fw-1");
  });
});
