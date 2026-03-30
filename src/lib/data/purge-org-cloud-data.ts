import { supabase } from "@/integrations/supabase/client";

/**
 * Deletes org-scoped cloud rows in FK-safe order (data governance purge).
 * RLS must allow the current user to delete these tables for the given org.
 */
export async function purgeOrgCloudData(orgId: string): Promise<void> {
  const steps = [
    () => supabase.from("finding_snapshots").delete().eq("org_id", orgId),
    () => supabase.from("remediation_status").delete().eq("org_id", orgId),
    () => supabase.from("shared_reports").delete().eq("org_id", orgId),
    () => supabase.from("alert_rules").delete().eq("org_id", orgId),
    () => supabase.from("audit_log").delete().eq("org_id", orgId),
    () => supabase.from("saved_reports").delete().eq("org_id", orgId),
    () => supabase.from("assessments").delete().eq("org_id", orgId),
    () => supabase.from("central_firewalls").delete().eq("org_id", orgId),
    () => supabase.from("central_tenants").delete().eq("org_id", orgId),
    () => supabase.from("central_credentials").delete().eq("org_id", orgId),
  ] as const;

  for (const run of steps) {
    const { error } = await run();
    if (error) throw error;
  }
}
