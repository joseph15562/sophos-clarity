import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type AuditAction =
  | "report.generated"
  | "report.saved"
  | "report.deleted"
  | "config.uploaded"
  | "assessment.saved"
  | "central.linked"
  | "central.synced"
  | "connectwise.linked"
  | "connectwise.disconnected"
  | "service_key.issued"
  | "service_key.revoked"
  | "psa.connectwise_ticket_created"
  | "psa.autotask_ticket_created"
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
      metadata: metadata as Json,
    });
  } catch (err) {
    console.warn("[logAudit]", err);
  }
}

export async function loadAuditLog(
  orgId: string,
  limit = 50,
  offset = 0,
  options?: { fromDate?: string; toDate?: string },
): Promise<AuditEntry[]> {
  let query = supabase
    .from("audit_log")
    .select("id, action, resource_type, resource_id, metadata, created_at, user_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.fromDate) query = query.gte("created_at", options.fromDate);
  if (options?.toDate) query = query.lte("created_at", options.toDate);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as AuditEntry[];
}
