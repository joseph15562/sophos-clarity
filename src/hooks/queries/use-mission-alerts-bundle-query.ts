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
 */
export function useMissionAlertsBundleQuery(
  orgId: string | undefined,
  enabled: boolean,
  options?: UseMissionAlertsBundleQueryOptions,
) {
  const cached =
    orgId && typeof window !== "undefined" ? readMissionAlertsBundleCache(orgId) : null;
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
