import { supabase } from "@/integrations/supabase/client";
import { resolveCustomerName } from "@/lib/customer-name";

/**
 * Distinct resolved customer labels for an org (same notion as the Customers page).
 * Used for PSA mapping dropdowns and similar pickers.
 */
export async function loadOrgResolvedCustomerNames(
  orgId: string,
  orgName: string,
): Promise<string[]> {
  const [assessRes, tenantRes, agentRes, portalRes] = await Promise.all([
    supabase.from("assessments").select("customer_name").eq("org_id", orgId),
    supabase.from("central_tenants").select("name").eq("org_id", orgId),
    supabase.from("agents").select("customer_name, tenant_name, name").eq("org_id", orgId),
    supabase.from("portal_config").select("tenant_name").eq("org_id", orgId),
  ]);

  const resolved = new Set<string>();

  for (const row of assessRes.data ?? []) {
    const r = resolveCustomerName(
      String((row as { customer_name?: string }).customer_name ?? ""),
      orgName,
    );
    if (r) resolved.add(r);
  }
  for (const row of tenantRes.data ?? []) {
    const r = resolveCustomerName(String((row as { name?: string }).name ?? ""), orgName);
    if (r) resolved.add(r);
  }
  for (const row of agentRes.data ?? []) {
    const ag = row as { customer_name?: string; tenant_name?: string; name?: string };
    const raw = ag.tenant_name || ag.customer_name || ag.name || "";
    const r = resolveCustomerName(String(raw), orgName);
    if (r) resolved.add(r);
  }
  for (const row of portalRes.data ?? []) {
    const r = resolveCustomerName(
      String((row as { tenant_name?: string }).tenant_name ?? ""),
      orgName,
    );
    if (r) resolved.add(r);
  }

  return [...resolved].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
