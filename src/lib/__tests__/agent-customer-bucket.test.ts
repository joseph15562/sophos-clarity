import { describe, it, expect } from "vitest";
import {
  UNASSIGNED_AGENT_GROUP,
  agentCustomerGroupingKey,
  agentCustomerGroupTitle,
  agentFleetCustomerLabel,
} from "@/lib/agent-customer-bucket";

describe("agentCustomerGroupingKey", () => {
  it("uses assigned customer when set", () => {
    expect(
      agentCustomerGroupingKey({
        assigned_customer_name: "Contoso",
        tenant_name: "(This tenant)",
      }),
    ).toBe("Contoso");
  });

  it("falls back to tenant", () => {
    expect(agentCustomerGroupingKey({ tenant_name: "Tenant A" })).toBe("Tenant A");
  });

  it("returns unassigned sentinel when neither set", () => {
    expect(agentCustomerGroupingKey({})).toBe(UNASSIGNED_AGENT_GROUP);
  });
});

describe("agentCustomerGroupTitle", () => {
  it("labels unassigned", () => {
    expect(agentCustomerGroupTitle(UNASSIGNED_AGENT_GROUP, "MSP")).toBe("Unassigned");
  });

  it("resolves placeholders with org name", () => {
    expect(agentCustomerGroupTitle("Unnamed", "Joseph MSP")).toBe("Joseph MSP");
  });
});

describe("agentFleetCustomerLabel", () => {
  it("prefers assigned over tenant", () => {
    expect(
      agentFleetCustomerLabel(
        {
          assigned_customer_name: "Contoso",
          tenant_name: "(This tenant)",
          customer_name: "Site1",
          name: "Agent",
          firewall_host: "1.1.1.1",
        },
        "MSP",
      ),
    ).toBe("Contoso");
  });
});
