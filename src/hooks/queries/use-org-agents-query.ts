import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";
import type { Tables } from "@/integrations/supabase/types";
import { queryKeys } from "./keys";

export type OrgAgentRow = Tables<"agents">;

async function fetchOrgAgents(orgId: string, signal?: AbortSignal): Promise<OrgAgentRow[]> {
  const { data, error } = await supabaseWithAbort(
    supabase
      .from("agents")
      .select("*")
      .eq("org_id", orgId)
      .order("customer_name")
      .order("name")
      .limit(500),
    signal,
  );

  if (error) throw error;
  return (data ?? []) as OrgAgentRow[];
}

export function useOrgAgentsQuery(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.org.agents(orgId ?? ""),
    queryFn: ({ signal }) => fetchOrgAgents(orgId!, signal),
    enabled: !!orgId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
