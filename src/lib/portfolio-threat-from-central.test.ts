import { describe, expect, it } from "vitest";
import {
  buildPortfolioThreatFromCentralAlerts,
  mapAlertToThreatBucket,
} from "./portfolio-threat-from-central";
import type { CentralAlert } from "./sophos-central";

function alert(partial: Partial<CentralAlert> & Pick<CentralAlert, "raisedAt">): CentralAlert {
  return {
    id: "x",
    description: partial.description ?? "",
    severity: partial.severity ?? "medium",
    category: partial.category ?? "general",
    product: partial.product ?? "firewall",
    raisedAt: partial.raisedAt,
    allowedActions: [],
    ...partial,
  };
}

describe("mapAlertToThreatBucket", () => {
  it("maps malware-like text", () => {
    expect(
      mapAlertToThreatBucket(
        alert({
          category: "x",
          description: "Troj/Agent blocked",
          raisedAt: new Date().toISOString(),
        }),
      ),
    ).toBe("Malware");
  });

  it("maps ips", () => {
    expect(
      mapAlertToThreatBucket(
        alert({
          category: "ips",
          description: "SQL injection",
          raisedAt: new Date().toISOString(),
        }),
      ),
    ).toBe("IPS");
  });

  it("maps firewall ATP / botnet copy to Malware using type + description", () => {
    expect(
      mapAlertToThreatBucket(
        alert({
          category: "security",
          product: "firewall",
          type: "Event::Firewall::FirewallAdvancedThreatProtection",
          description:
            "We detected an attempt to communicate with a botnet or command and control server.",
          raisedAt: new Date().toISOString(),
        }),
      ),
    ).toBe("Malware");
  });

  it("maps Sophos product ztna to Web", () => {
    expect(
      mapAlertToThreatBucket(
        alert({
          category: "ztnaResource",
          product: "ztna",
          description: 'Resource "http_proxy" is unreachable',
          type: "Event::ZTNA::ZTNAApplicationUnreachable",
          raisedAt: new Date().toISOString(),
        }),
      ),
    ).toBe("Web");
  });

  it("maps RED tunnel events to Other", () => {
    expect(
      mapAlertToThreatBucket(
        alert({
          category: "connectivity",
          product: "firewall",
          type: "Event::Firewall::FirewallREDTunnelDown",
          description: "JM-RED is now disconnected",
          raisedAt: new Date().toISOString(),
        }),
      ),
    ).toBe("Other");
  });
});

describe("buildPortfolioThreatFromCentralAlerts", () => {
  it("buckets alerts by local day and category", () => {
    const now = new Date("2026-04-07T12:00:00");
    const d0 = new Date("2026-04-07T10:00:00").toISOString();
    const d1 = new Date("2026-04-06T10:00:00").toISOString();
    const items = [
      alert({ id: "1", category: "malware", raisedAt: d0 }),
      alert({ id: "2", category: "malware", raisedAt: d0 }),
      alert({ id: "3", category: "ips", raisedAt: d1 }),
    ];
    const out = buildPortfolioThreatFromCentralAlerts(items, 7, now);
    expect(out.inWindowCount).toBe(3);
    expect(out.stackedRow.Malware).toBe(2);
    expect(out.stackedRow.IPS).toBe(1);
    expect(out.series.reduce((s, x) => s + x.alerts, 0)).toBe(3);
    expect(out.topTypes.length).toBeGreaterThan(0);
  });

  it("uses raised_at when raisedAt is missing (Sophos payload shape)", () => {
    const now = new Date("2026-04-07T12:00:00");
    const iso = new Date("2026-04-07T10:00:00").toISOString();
    const items = [
      {
        id: "1",
        description: "x",
        severity: "high",
        category: "malware",
        product: "fw",
        raisedAt: "",
        raised_at: iso,
        allowedActions: [] as string[],
      } as unknown as CentralAlert,
    ];
    const out = buildPortfolioThreatFromCentralAlerts(items, 7, now);
    expect(out.inWindowCount).toBe(1);
    expect(out.series.reduce((s, x) => s + x.alerts, 0)).toBe(1);
  });
});
