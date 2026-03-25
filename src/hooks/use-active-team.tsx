import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSeTeamsQuery } from "@/hooks/queries/use-se-teams-query";
import { queryKeys } from "@/hooks/queries/keys";

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

export function ActiveTeamProvider({
  seProfileId,
  children,
}: {
  seProfileId: string | null;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { data: teams = [], isLoading } = useSeTeamsQuery(seProfileId);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!teams.length) return;
    if (!initialized) {
      const primary = teams.find((t) => t.is_primary) ?? teams[0];
      setActiveTeamId(primary?.id ?? null);
      setInitialized(true);
    } else if (!teams.some((t) => t.id === activeTeamId)) {
      const primary = teams.find((t) => t.is_primary) ?? teams[0];
      setActiveTeamId(primary?.id ?? null);
    }
  }, [teams, initialized, activeTeamId]);

  const reload = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.seTeams.all });
  }, [queryClient]);

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) ?? null,
    [teams, activeTeamId],
  );

  const value = useMemo<ActiveTeamContextValue>(
    () => ({ teams, activeTeam, activeTeamId, setActiveTeamId, loading: isLoading, reload }),
    [teams, activeTeam, activeTeamId, isLoading, reload],
  );

  return <ActiveTeamContext.Provider value={value}>{children}</ActiveTeamContext.Provider>;
}
