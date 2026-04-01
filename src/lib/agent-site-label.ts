import type { Tables } from "@/integrations/supabase/types";

type AgentRow = Pick<
  Tables<"agents">,
  "customer_name" | "assigned_customer_name" | "tenant_name" | "name" | "firewall_host"
>;

/**
 * Label for “customer / site” in fleet and agent lists. Matches server-side
 * resolution when submissions use Central tenant instead of a stored customer name.
 */
export function agentSiteLabelForList(agent: AgentRow): string | null {
  const cn = (agent.customer_name ?? "").trim();
  if (cn && cn !== "Unnamed") return cn;
  const tn = (agent.tenant_name ?? "").trim();
  if (tn) return tn;
  return null;
}

/** Non-empty name for assessments / exports when submission row still says Unnamed. */
export function resolveAgentCustomerDisplayName(
  agent: AgentRow,
  submissionCustomerName?: string | null,
): string {
  const assigned = (agent.assigned_customer_name ?? "").trim();
  if (assigned) return assigned;
  const raw = (submissionCustomerName ?? agent.customer_name ?? "").trim();
  if (raw && raw !== "Unnamed") return raw;
  const tn = (agent.tenant_name ?? "").trim();
  if (tn) return tn;
  const nm = (agent.name ?? "").trim();
  if (nm) return nm;
  return agent.firewall_host?.trim() || "Site";
}
