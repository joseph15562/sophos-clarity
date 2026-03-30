import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";

export interface MspSetupStatus {
  centralOk: boolean;
  agentCount: number;
  assessmentCount: number;
  portalSlugOk: boolean;
}

export async function fetchMspSetupStatus(
  orgId: string,
  signal?: AbortSignal,
): Promise<MspSetupStatus> {
  const [cred, agents, assess, portals] = await Promise.all([
    supabaseWithAbort(
      supabase.from("central_credentials").select("org_id").eq("org_id", orgId).maybeSingle(),
      signal,
    ),
    supabaseWithAbort(
      supabase.from("agents").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      signal,
    ),
    supabaseWithAbort(
      supabase.from("assessments").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      signal,
    ),
    supabaseWithAbort(supabase.from("portal_config").select("slug").eq("org_id", orgId), signal),
  ]);

  if (cred.error) throw cred.error;
  if (agents.error) throw agents.error;
  if (assess.error) throw assess.error;
  if (portals.error) throw portals.error;

  const rows = portals.data ?? [];
  return {
    centralOk: !!cred.data,
    agentCount: agents.count ?? 0,
    assessmentCount: assess.count ?? 0,
    portalSlugOk: rows.some((r) => String((r as { slug?: string }).slug ?? "").trim().length > 0),
  };
}
