import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";

export interface PortalTenantBootstrapResult {
  tenants: string[];
  configRows: Array<Record<string, unknown>>;
}

export async function fetchPortalTenantBootstrap(
  orgId: string,
  initialTenantName: string | null,
  signal?: AbortSignal,
): Promise<PortalTenantBootstrapResult> {
  const [agentsRes, configsRes] = await Promise.all([
    supabaseWithAbort(
      supabase.from("agents").select("tenant_name").not("tenant_name", "is", null),
      signal,
    ),
    supabaseWithAbort(supabase.from("portal_config").select("*").eq("org_id", orgId), signal),
  ]);

  if (agentsRes.error) throw agentsRes.error;
  if (configsRes.error) throw configsRes.error;

  const tenantSet = new Set<string>();
  for (const a of (agentsRes.data ?? []) as Array<{ tenant_name: string | null }>) {
    if (a.tenant_name) tenantSet.add(a.tenant_name);
  }

  const configRows = (configsRes.data ?? []) as Array<Record<string, unknown>>;
  for (const row of configRows) {
    const tn = row.tenant_name as string | null | undefined;
    if (tn) tenantSet.add(tn);
  }

  if (initialTenantName) tenantSet.add(initialTenantName);

  const sortedTenants = [...tenantSet].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  return { tenants: sortedTenants, configRows };
}
