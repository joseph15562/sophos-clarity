/**
 * `customer_name` on agent_submissions / assessments is the **customer / tenant bucket**
 * (for directory, reports). **Site / location** labels belong on `agents.customer_name` only.
 * Optional `assigned_customer_name` overrides Central tenant so multiple connectors can share
 * one customer. When unset and the agent is linked to Sophos Central, bucket by `tenant_name`.
 */
export function persistedAssessmentCustomerName(
  agent: {
    assigned_customer_name?: unknown;
    tenant_name?: unknown;
    customer_name?: unknown;
  },
  bodyCustomerName?: unknown,
): string {
  const assigned = String(agent.assigned_customer_name ?? "").trim();
  if (assigned.length > 0) return assigned;
  const tenant = String(agent.tenant_name ?? "").trim();
  if (tenant.length > 0) return tenant;
  const raw = bodyCustomerName ?? agent.customer_name;
  const s = String(raw ?? "Unnamed").trim();
  return s.length === 0 ? "Unnamed" : s;
}
