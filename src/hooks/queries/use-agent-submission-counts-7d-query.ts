import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";
import { queryKeys } from "./keys";

/** Count agent_submissions per agent_id in the last 7 days (org-scoped). */
export function useAgentSubmissionCounts7dQuery(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.org.agentSubmissionCounts7d(orgId ?? ""),
    queryFn: async ({ signal }) => {
      const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseWithAbort(
        supabase
          .from("agent_submissions")
          .select("agent_id")
          .eq("org_id", orgId!)
          .gte("created_at", sevenAgo),
        signal,
      );
      if (error) throw error;
      const cmap: Record<string, number> = {};
      for (const r of data ?? []) {
        cmap[r.agent_id] = (cmap[r.agent_id] ?? 0) + 1;
      }
      return cmap;
    },
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });
}
