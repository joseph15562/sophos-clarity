import { describe, expect, it } from "vitest";
import { mergePortalHaFirewallsForDisplay } from "./portal-firewall-ha-merge";

describe("mergePortalHaFirewallsForDisplay", () => {
  it("merges two rows with same hostname and model and different serials", () => {
    const rows = [
      {
        agentId: "cf:a",
        label: "firewall.salesengineers.uk",
        hostname: "firewall.salesengineers.uk",
        serialNumber: "X12501GYT4YXJCD",
        model: "XGS128_XN01_SFOS 22.0.0 GA-Build365",
        score: 59,
        grade: "D",
        lastAssessed: "2026-04-01T12:00:00.000Z",
      },
      {
        agentId: "cf:b",
        label: "firewall.salesengineers.uk",
        hostname: "firewall.salesengineers.uk",
        serialNumber: "X1250294R42QJ5E",
        model: "XGS128_XN01_SFOS 22.0.0 GA-Build365",
        score: 59,
        grade: "D",
        lastAssessed: "2026-04-01T12:00:00.000Z",
      },
    ];
    const out = mergePortalHaFirewallsForDisplay(rows);
    expect(out).toHaveLength(1);
    expect(out[0].serialNumbers).toEqual(["X12501GYT4YXJCD", "X1250294R42QJ5E"]);
    expect(out[0].agentId).toBe("cf:ha:a+b");
  });

  it("does not merge different hostnames", () => {
    const rows = [
      {
        agentId: "cf:1",
        label: "a.example",
        hostname: "a.example",
        serialNumber: "S1",
        model: "M1",
        score: null,
        grade: null,
        lastAssessed: null,
      },
      {
        agentId: "cf:2",
        label: "b.example",
        hostname: "b.example",
        serialNumber: "S2",
        model: "M1",
        score: null,
        grade: null,
        lastAssessed: null,
      },
    ];
    expect(mergePortalHaFirewallsForDisplay(rows)).toHaveLength(2);
  });
});
