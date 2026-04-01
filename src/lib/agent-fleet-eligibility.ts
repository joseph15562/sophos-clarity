import type { Tables } from "@/integrations/supabase/types";

/**
 * "Connected Firewalls" should list only agents whose connector has successfully
 * talked to a firewall (device identity on the row). Otherwise web-registered agents
 * appear as soon as the connector heartbeats with an API key — before setup finishes.
 */
export function isAgentFleetEligible(agent: Tables<"agents">): boolean {
  return Boolean(agent.serial_number?.trim()) || Boolean(agent.firmware_version?.trim());
}
