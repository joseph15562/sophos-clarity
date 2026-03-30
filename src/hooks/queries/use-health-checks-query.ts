import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";
import { queryKeys } from "./keys";

interface HealthCheckRow {
  id: string;
  customer_name: string | null;
  overall_score: number | null;
  overall_grade: string | null;
  findings_count: number | null;
  firewall_count: number | null;
  checked_at: string;
  summary_json: Record<string, unknown> | null;
  se_user_id: string;
  se_profiles?: { display_name: string | null } | null;
}

async function fetchHealthChecks(teamId: string, signal?: AbortSignal): Promise<HealthCheckRow[]> {
  const { data, error } = await supabaseWithAbort(
    supabase
      .from("se_health_checks")
      .select(
        "id, customer_name, overall_score, overall_grade, findings_count, firewall_count, checked_at, summary_json, se_user_id, se_profiles(display_name)",
      )
      .eq("team_id", teamId)
      .order("checked_at", { ascending: false })
      .limit(200),
    signal,
  );

  if (error) throw error;
  return (data ?? []) as unknown as HealthCheckRow[];
}

export function useHealthChecksQuery(teamId: string | null) {
  return useQuery({
    queryKey: queryKeys.healthChecks.list(teamId ?? ""),
    queryFn: ({ signal }) => fetchHealthChecks(teamId!, signal),
    enabled: !!teamId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
