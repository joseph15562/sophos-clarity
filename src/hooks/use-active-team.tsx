import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SETeam {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  role: "admin" | "member";
  is_primary: boolean;
  member_count: number;
}

interface ActiveTeamContextValue {
  teams: SETeam[];
  activeTeam: SETeam | null;
  activeTeamId: string | null;
  setActiveTeamId: (id: string | null) => void;
  loading: boolean;
  reload: () => Promise<void>;
}

const ActiveTeamContext = createContext<ActiveTeamContextValue>({
  teams: [],
  activeTeam: null,
  activeTeamId: null,
  setActiveTeamId: () => {},
  loading: false,
  reload: async () => {},
});

export function useActiveTeam() {
  return useContext(ActiveTeamContext);
}

export function ActiveTeamProvider({ seProfileId, children }: { seProfileId: string | null; children: ReactNode }) {
  const [teams, setTeams] = useState<SETeam[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const fetchTeams = useCallback(async () => {
    if (!seProfileId) {
      setTeams([]);
      setActiveTeamId(null);
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/se-teams`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        },
      );
      if (!res.ok) return;
      const json = await res.json();
      const fetched: SETeam[] = json.data ?? [];
      setTeams(fetched);

      if (!initialized) {
        const primary = fetched.find((t) => t.is_primary) ?? fetched[0];
        setActiveTeamId(primary?.id ?? null);
        setInitialized(true);
      } else if (fetched.length > 0 && !fetched.some((t) => t.id === activeTeamId)) {
        const primary = fetched.find((t) => t.is_primary) ?? fetched[0];
        setActiveTeamId(primary?.id ?? null);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seProfileId, initialized]);

  useEffect(() => {
    void fetchTeams();
  }, [fetchTeams]);

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) ?? null,
    [teams, activeTeamId],
  );

  const value = useMemo<ActiveTeamContextValue>(
    () => ({ teams, activeTeam, activeTeamId, setActiveTeamId, loading, reload: fetchTeams }),
    [teams, activeTeam, activeTeamId, loading, fetchTeams],
  );

  return <ActiveTeamContext.Provider value={value}>{children}</ActiveTeamContext.Provider>;
}
