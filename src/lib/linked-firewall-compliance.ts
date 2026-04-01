import { supabase } from "@/integrations/supabase/client";
import { isThisTenantPlaceholder } from "@/lib/sophos-central";

/** Raw rows for a Central-linked firewall + its Sophos tenant (same merge rules as Fleet Command). */
export type LinkedCentralComplianceRaw = {
  fwCountry: string;
  fwState: string;
  fwLegacyEnv: string;
  tenantCountry: string;
  tenantEnvironment: string;
  /** `central_tenants.name` (may be "(This tenant)" placeholder). */
  tenantNameRaw: string;
};

export async function fetchLinkedCentralFirewallCompliance(
  orgId: string,
  centralTenantId: string,
  centralFirewallId: string,
): Promise<LinkedCentralComplianceRaw> {
  const [fwRes, tenRes] = await Promise.all([
    // Match by org + Sophos firewall id only — `central_tenant_id` on the row can drift from the
    // link row; filtering on both returned no row and empty Fleet context in the UI.
    supabase
      .from("central_firewalls")
      .select("compliance_country, compliance_state, compliance_environment")
      .eq("org_id", orgId)
      .eq("firewall_id", centralFirewallId)
      .maybeSingle(),
    supabase
      .from("central_tenants")
      .select("compliance_country, compliance_environment, name")
      .eq("org_id", orgId)
      .eq("central_tenant_id", centralTenantId)
      .maybeSingle(),
  ]);

  const row = fwRes.data;
  const ten = tenRes.data;

  return {
    fwCountry: String(row?.compliance_country ?? "").trim(),
    fwState: String(row?.compliance_state ?? "").trim(),
    fwLegacyEnv: String(row?.compliance_environment ?? "").trim(),
    tenantCountry: String(ten?.compliance_country ?? "").trim(),
    tenantEnvironment: String(ten?.compliance_environment ?? "").trim(),
    tenantNameRaw: String(ten?.name ?? "").trim(),
  };
}

/** Customer Name field / select: org name when Central returns the single-tenant placeholder. */
export function resolveLinkedTenantCustomerName(
  raw: Pick<LinkedCentralComplianceRaw, "tenantNameRaw">,
  orgDisplayName?: string | null,
): string {
  const name = (raw.tenantNameRaw ?? "").trim();
  if (!name) return (orgDisplayName ?? "").trim();
  if (isThisTenantPlaceholder(name) && (orgDisplayName ?? "").trim()) {
    return (orgDisplayName ?? "").trim();
  }
  return name;
}

/** Effective Customer Context fields for Assess / branding (device override, then tenant; sector from tenant then legacy row). */
export function mergeLinkedCentralCustomerContext(raw: LinkedCentralComplianceRaw): {
  country: string;
  state: string;
  environment: string;
} {
  const country = (raw.fwCountry || raw.tenantCountry).trim();
  const state = country === "United States" ? raw.fwState.trim() : "";
  const environment = (raw.tenantEnvironment || raw.fwLegacyEnv).trim();
  return { country, state, environment };
}

/** Merged fleet sector + country per Sophos `firewall_id` for a tenant (link picker list). */
export async function fetchTenantFirewallFleetContextMap(
  orgId: string,
  centralTenantId: string,
): Promise<Map<string, { country: string; state: string; environment: string }>> {
  const out = new Map<string, { country: string; state: string; environment: string }>();

  const [fwRes, tenRes] = await Promise.all([
    supabase
      .from("central_firewalls")
      .select("firewall_id, compliance_country, compliance_state, compliance_environment")
      .eq("org_id", orgId)
      .eq("central_tenant_id", centralTenantId),
    supabase
      .from("central_tenants")
      .select("compliance_country, compliance_environment")
      .eq("org_id", orgId)
      .eq("central_tenant_id", centralTenantId)
      .maybeSingle(),
  ]);

  if (fwRes.error) {
    console.warn(
      "[linked-firewall-compliance] fetchTenantFirewallFleetContextMap firewalls",
      fwRes.error,
    );
    return out;
  }

  const tenantCountry = String(tenRes.data?.compliance_country ?? "").trim();
  const tenantEnvironment = String(tenRes.data?.compliance_environment ?? "").trim();

  for (const row of fwRes.data ?? []) {
    const fid = String((row as { firewall_id?: string }).firewall_id ?? "").trim();
    if (!fid) continue;
    const raw: LinkedCentralComplianceRaw = {
      fwCountry: String((row as { compliance_country?: string }).compliance_country ?? "").trim(),
      fwState: String((row as { compliance_state?: string }).compliance_state ?? "").trim(),
      fwLegacyEnv: String(
        (row as { compliance_environment?: string }).compliance_environment ?? "",
      ).trim(),
      tenantCountry,
      tenantEnvironment,
      tenantNameRaw: "",
    };
    out.set(fid, mergeLinkedCentralCustomerContext(raw));
  }

  return out;
}
