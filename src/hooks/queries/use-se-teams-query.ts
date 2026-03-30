import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "./keys";
import type { SETeam } from "@/hooks/use-active-team";

async function fetchSeTeams(seProfileId: string, signal?: AbortSignal): Promise<SETeam[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/se-teams`, {
    signal,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

export function useSeTeamsQuery(seProfileId: string | null) {
  return useQuery({
    queryKey: queryKeys.seTeams.list(seProfileId ?? ""),
    queryFn: ({ signal }) => fetchSeTeams(seProfileId!, signal),
    enabled: !!seProfileId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
