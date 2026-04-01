import { resolveCustomerName } from "@/lib/customer-name";

/** Map key for agents with no tenant and no assigned customer. */
export const UNASSIGNED_AGENT_GROUP = "__unassigned__";

type AgentLike = {
  assigned_customer_name?: string | null;
  tenant_name?: string | null;
};

/**
 * Raw bucket string shared by agents that should appear under one customer group.
 * Assigned customer (if set) wins over Sophos Central tenant.
 */
export function agentCustomerGroupingKey(agent: AgentLike): string {
  const a = String(agent.assigned_customer_name ?? "").trim();
  if (a) return a;
  const t = String(agent.tenant_name ?? "").trim();
  if (t) return t;
  return UNASSIGNED_AGENT_GROUP;
}

/** Group header in Management / Connected Firewalls (placeholders → org name, etc.). */
export function agentCustomerGroupTitle(
  groupKey: string,
  orgDisplayName: string | undefined | null,
): string {
  if (groupKey === UNASSIGNED_AGENT_GROUP) return "Unassigned";
  return resolveCustomerName(groupKey, orgDisplayName ?? "");
}

/** Resolved customer label for Fleet Command / reports (same bucket order as submissions). */
export function agentFleetCustomerLabel(
  agent: AgentLike & {
    customer_name?: string | null;
    name?: string | null;
    firewall_host?: string | null;
  },
  orgDisplayName: string | undefined,
): string {
  const a = String(agent.assigned_customer_name ?? "").trim();
  if (a) return resolveCustomerName(a, orgDisplayName ?? "");
  const t = String(agent.tenant_name ?? "").trim();
  if (t) return resolveCustomerName(t, orgDisplayName ?? "");
  const cn = String(agent.customer_name ?? "").trim();
  if (cn && cn !== "Unnamed") return resolveCustomerName(cn, orgDisplayName ?? "");
  const fallback = String(agent.name ?? "").trim() || String(agent.firewall_host ?? "").trim();
  return resolveCustomerName(fallback, orgDisplayName ?? "");
}
