import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMissionAlertsBundle } from "@/lib/sophos-central";
import {
  readMissionAlertsBundleCache,
  writeMissionAlertsBundleCache,
} from "@/lib/mission-alerts-bundle-cache";
import { queryKeys } from "./keys";

export type UseMissionAlertsBundleQueryOptions = {
  /** Background poll (Mission control only). Omit or false to disable. */
  refetchIntervalMs?: number | false;
};

/**
 * Shared Sophos Central open-alerts bundle: one Edge call, optional localStorage rehydrate, persist on success.
 *
 * In **development** we skip reading the mission-alerts cache for `initialData`. Safari, Cursor Simple
 * Browser, Chrome, etc. each use a separate storage partition even for `localhost`, so a bad bundle
 * written in one (e.g. before Edge pagination/sort fixes) never poisons another — but Cursor could
 * keep showing that snapshot if refetches fail silently. Forcing a network-first load in dev keeps
 * all local browsers aligned. Production still rehydrates from localStorage for fast return visits.
 */
export function useMissionAlertsBundleQuery(
  orgId: string | undefined,
  enabled: boolean,
  options?: UseMissionAlertsBundleQueryOptions,
) {
  const rehydrateFromLs = !import.meta.env.DEV;
  const cached =
    rehydrateFromLs && orgId && typeof window !== "undefined"
      ? readMissionAlertsBundleCache(orgId)
      : null;
  const refetchInterval =
    options?.refetchIntervalMs === undefined ? false : options.refetchIntervalMs;

  const query = useQuery({
    queryKey: orgId
      ? queryKeys.central.missionAlertsBundle(orgId)
      : (["central", "mission_alerts", "none"] as const),
    queryFn: () => getMissionAlertsBundle(orgId!),
    enabled: Boolean(enabled && orgId),
    initialData: cached?.bundle,
    initialDataUpdatedAt: cached ? cached.updatedAt : undefined,
    staleTime: 120_000,
    gcTime: 1000 * 60 * 60 * 6,
    refetchOnMount: import.meta.env.DEV ? "always" : true,
    refetchInterval: enabled && orgId ? refetchInterval : false,
    refetchIntervalInBackground: false,
    retry: false,
  });

  useEffect(() => {
    if (!orgId || !query.data || !query.isSuccess) return;
    writeMissionAlertsBundleCache(orgId, query.data);
  }, [orgId, query.data, query.isSuccess]);

  return query;
}
