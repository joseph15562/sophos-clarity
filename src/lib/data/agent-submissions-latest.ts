import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";
import type { Tables } from "@/integrations/supabase/types";

export type AgentSubmissionRow = Tables<"agent_submissions">;

/** Latest submission per agent_id (org-scoped), from a single ordered query. */
export async function fetchLatestSubmissionsForAgentIds(
  orgId: string,
  agentIds: string[],
  signal?: AbortSignal,
): Promise<Record<string, AgentSubmissionRow | null>> {
  const unique = [...new Set(agentIds)].filter(Boolean);
  const out: Record<string, AgentSubmissionRow | null> = {};
  for (const id of unique) out[id] = null;
  if (unique.length === 0) return out;

  const { data, error } = await supabaseWithAbort(
    supabase
      .from("agent_submissions")
      .select("*")
      .eq("org_id", orgId)
      .in("agent_id", unique)
      .order("created_at", { ascending: false }),
    signal,
  );
  if (error) throw error;

  const latestByAgent = new Map<string, AgentSubmissionRow>();
  for (const row of data ?? []) {
    if (!latestByAgent.has(row.agent_id)) latestByAgent.set(row.agent_id, row);
  }
  for (const id of unique) {
    out[id] = latestByAgent.get(id) ?? null;
  }
  return out;
}

export async function fetchLatestSubmissionForAgent(
  orgId: string,
  agentId: string,
  signal?: AbortSignal,
): Promise<AgentSubmissionRow | null> {
  const { data, error } = await supabaseWithAbort(
    supabase
      .from("agent_submissions")
      .select("*")
      .eq("org_id", orgId)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(1),
    signal,
  );
  if (error) throw error;
  return data?.[0] ?? null;
}
