import { describe, expect, it } from "vitest";
import { agentSiteLabelForList, resolveAgentCustomerDisplayName } from "@/lib/agent-site-label";

const baseAgent = {
  customer_name: "Unnamed",
  tenant_name: null as string | null,
  name: "HQ Connector",
  firewall_host: "192.168.1.1",
};

describe("agentSiteLabelForList", () => {
  it("returns custom customer name when set", () => {
    expect(agentSiteLabelForList({ ...baseAgent, customer_name: "Acme Ltd" })).toBe("Acme Ltd");
  });

  it("uses Central tenant when customer is Unnamed", () => {
    expect(
      agentSiteLabelForList({
        ...baseAgent,
        tenant_name: "Contoso (EU)",
      }),
    ).toBe("Contoso (EU)");
  });

  it("returns null when only Unnamed and no tenant", () => {
    expect(agentSiteLabelForList(baseAgent)).toBeNull();
  });
});

describe("resolveAgentCustomerDisplayName", () => {
  it("prefers submission customer when set", () => {
    expect(resolveAgentCustomerDisplayName(baseAgent, "From submission")).toBe("From submission");
  });

  it("falls back through tenant, name, host", () => {
    expect(resolveAgentCustomerDisplayName(baseAgent, "Unnamed")).toBe("HQ Connector");
    expect(resolveAgentCustomerDisplayName({ ...baseAgent, tenant_name: "T1" }, "Unnamed")).toBe(
      "T1",
    );
    expect(
      resolveAgentCustomerDisplayName({ ...baseAgent, name: "", tenant_name: null }, null),
    ).toBe("192.168.1.1");
  });
});
