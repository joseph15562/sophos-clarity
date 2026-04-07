import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getCachedFirewalls,
  getCachedTenants,
  getMdrThreatFeedMerged,
  getMissionAlertsBundle,
} from "@/lib/sophos-central";
import { readMissionAlertsBundleCache } from "@/lib/mission-alerts-bundle-cache";
import { queryKeys } from "@/hooks/queries/keys";

const PREFETCH_STALE_MS = 60_000;

/**
 * When a signed-in user has an org, warm Mission Control + Central-friendly caches in the background.
 */
export function OrgCentralPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    async function warm(orgId: string) {
      const alertsSnap = readMissionAlertsBundleCache(orgId);
      if (alertsSnap) {
        queryClient.setQueryData(queryKeys.central.missionAlertsBundle(orgId), alertsSnap.bundle);
      }
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: queryKeys.central.missionAlertsBundle(orgId),
          queryFn: () => getMissionAlertsBundle(orgId),
          staleTime: PREFETCH_STALE_MS,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.central.mdrThreatFeedMerged(orgId),
          queryFn: () => getMdrThreatFeedMerged(orgId),
          staleTime: PREFETCH_STALE_MS,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.central.cachedTenants(orgId),
          queryFn: () => getCachedTenants(orgId),
          staleTime: PREFETCH_STALE_MS,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.central.cachedFirewalls(orgId, "all"),
          queryFn: () => getCachedFirewalls(orgId),
          staleTime: PREFETCH_STALE_MS,
        }),
      ]);
    }

    async function run() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();
      if (error || !data?.org_id || cancelled) return;
      await warm(data.org_id as string);
    }

    void run();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user || cancelled) return;
      void run();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return null;
}
