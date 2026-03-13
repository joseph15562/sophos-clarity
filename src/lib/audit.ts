import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "report.generated"
  | "report.saved"
  | "report.deleted"
  | "config.uploaded"
  | "assessment.saved"
  | "central.linked"
  | "central.synced"
  | "team.invited"
  | "team.removed"
  | "auth.login"
  | "auth.logout";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
}

export async function logAudit(
  orgId: string,
  action: AuditAction,
  resourceType = "",
  resourceId = "",
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      org_id: orgId,
      user_id: userData?.user?.id ?? null,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
    });
  } catch {
    // Audit logging is best-effort — never block the main flow
  }
}

export async function loadAuditLog(
  orgId: string,
  limit = 50,
  offset = 0,
): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action, resource_type, resource_id, metadata, created_at, user_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return [];
  return data as unknown as AuditEntry[];
}
