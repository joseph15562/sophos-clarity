import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import { WorkspaceSettingsStrip } from "@/components/WorkspaceSettingsStrip";
import { CentralSubnav } from "./central-subnav";
import {
  getCachedFirewalls,
  getCachedTenants,
  getMdrThreatFeedMerged,
  getMissionAlertsBundle,
} from "@/lib/sophos-central";
import { readMissionAlertsBundleCache } from "@/lib/mission-alerts-bundle-cache";
import { queryKeys } from "@/hooks/queries/keys";

const CENTRAL_PREFETCH_STALE_MS = 60_000;

function CentralHubInner() {
  const { org, isGuest } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!org?.id || isGuest) return;
    const orgId = org.id;
    const alertsSnap = readMissionAlertsBundleCache(orgId);
    if (alertsSnap) {
      queryClient.setQueryData(queryKeys.central.missionAlertsBundle(orgId), alertsSnap.bundle);
    }
    void Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: queryKeys.central.missionAlertsBundle(orgId),
        queryFn: () => getMissionAlertsBundle(orgId),
        staleTime: CENTRAL_PREFETCH_STALE_MS,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.central.mdrThreatFeedMerged(orgId),
        queryFn: () => getMdrThreatFeedMerged(orgId),
        staleTime: CENTRAL_PREFETCH_STALE_MS,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.central.cachedTenants(orgId),
        queryFn: () => getCachedTenants(orgId),
        staleTime: CENTRAL_PREFETCH_STALE_MS,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.central.cachedFirewalls(orgId, "all"),
        queryFn: () => getCachedFirewalls(orgId),
        staleTime: CENTRAL_PREFETCH_STALE_MS,
      }),
    ]);
  }, [org?.id, isGuest, queryClient]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <FireComplyWorkspaceHeader loginShell={isGuest} />
      <WorkspacePrimaryNav />
      <CentralSubnav />
      <main
        id="main-content"
        className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 assist-chrome-pad-bottom"
        tabIndex={-1}
        data-tour="tour-page-central"
      >
        {org?.id && !isGuest ? (
          <div className="mb-6">
            <WorkspaceSettingsStrip variant="fleet" />
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}

export default function CentralHub() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <CentralHubInner />
    </AuthProvider>
  );
}
