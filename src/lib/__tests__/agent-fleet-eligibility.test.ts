import { describe, it, expect } from "vitest";
import { isAgentFleetEligible } from "@/lib/agent-fleet-eligibility";
import type { Tables } from "@/integrations/supabase/types";

function row(partial: Partial<Tables<"agents">>): Tables<"agents"> {
  return {
    api_key_hash: "x",
    api_key_prefix: "12345678",
    central_firewall_id: null,
    connector_version: null,
    created_at: "",
    customer_name: "Unnamed",
    environment: "Unknown",
    error_message: null,
    firewall_host: "1.1.1.1",
    firewall_port: 4444,
    firmware_version: null,
    firmware_version_override: null,
    hardware_model: null,
    id: "id",
    last_grade: null,
    last_score: null,
    last_seen_at: new Date().toISOString(),
    name: "Agent",
    org_id: "org",
    pending_command: null,
    schedule_cron: "0 2 * * *",
    serial_number: null,
    status: "online",
    tenant_id: null,
    tenant_name: null,
    ...partial,
  };
}

describe("isAgentFleetEligible", () => {
  it("is false when only heartbeat metadata exists", () => {
    expect(
      isAgentFleetEligible(row({ last_seen_at: new Date().toISOString(), status: "online" })),
    ).toBe(false);
  });

  it("is true when serial is set", () => {
    expect(isAgentFleetEligible(row({ serial_number: "ABC123" }))).toBe(true);
  });

  it("is true when firmware_version is set", () => {
    expect(isAgentFleetEligible(row({ firmware_version: "v20.0" }))).toBe(true);
  });
});
