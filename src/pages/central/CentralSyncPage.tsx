import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";
import { getCentralStatus, syncTenants, syncFirewalls } from "@/lib/sophos-central";
import { buildManagePanelSearch } from "@/lib/workspace-deeplink";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function CentralSyncPage() {
  const { org } = useAuth();
  const orgId = org?.id;
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: orgId ? queryKeys.central.status(orgId) : ["central", "status", "none"],
    queryFn: () => getCentralStatus(orgId!),
    enabled: Boolean(orgId),
  });

  const refreshMutation = useMutation({
    mutationFn: async (id: string) => {
      const tenants = await syncTenants(id);
      for (const t of tenants) {
        try {
          await syncFirewalls(id, t.id);
        } catch (err) {
          console.warn("[CentralSync] syncFirewalls best-effort", err);
        }
      }
      return getCentralStatus(id);
    },
    onSuccess: async (status, id) => {
      queryClient.setQueryData(queryKeys.central.status(id), status);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["central", id], exact: false }),
        queryClient.invalidateQueries({ queryKey: queryKeys.org.fleetBundle(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.org.mspSetupStatus(id) }),
      ]);
      toast.success("Central inventory refreshed.");
    },
    onError: (err) => {
      toast.error((err as Error)?.message ?? "Sync failed.");
    },
  });

  if (!orgId) {
    return <EmptyState title="Sign in required" description="Sync requires an organisation." />;
  }

  const connected = statusQuery.data?.connected ?? false;
  const settingsHref = `/?${buildManagePanelSearch({ panel: "settings", section: "central" })}`;
  const apiHosts = statusQuery.data?.api_hosts;

  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-2" data-tour="tour-central-sync-shell">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Re-fetch tenants and firewalls from Sophos Central and update cached tables used by Fleet,
          this hub, and customer cards. Same inventory pass as the refresh control in the app
          header.
        </p>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inventory sync</CardTitle>
            <CardDescription>
              Writes to cached tenant and firewall tables in your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Status: </span>
              <span className="font-medium">{connected ? "Connected" : "Not connected"}</span>
            </div>
            {statusQuery.data?.last_synced_at ? (
              <div className="text-xs text-muted-foreground">
                Last synced (API): {new Date(statusQuery.data.last_synced_at).toLocaleString()}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!connected || refreshMutation.isPending}
                onClick={() => refreshMutation.mutate(orgId)}
                className="gap-2"
              >
                {refreshMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh tenants &amp; firewalls
              </Button>
              <Button type="button" variant="outline" size="default" className="gap-2" asChild>
                <Link to={settingsHref}>
                  <Settings className="h-4 w-4" />
                  Credentials
                </Link>
              </Button>
            </div>
            {!connected ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Connect Sophos Central under workspace settings before syncing.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Connector context</CardTitle>
          <CardDescription>
            Read-only snapshot from the Central connector (partner scope and API hosts).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {statusQuery.isPending ? (
            <p className="text-muted-foreground text-xs">Loading…</p>
          ) : (
            <>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Partner type</div>
                <div>{statusQuery.data?.partner_type ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Partner ID</div>
                <div className="font-mono text-[11px] break-all">
                  {statusQuery.data?.partner_id ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Connected at</div>
                <div className="text-xs">
                  {statusQuery.data?.connected_at
                    ? new Date(statusQuery.data.connected_at).toLocaleString()
                    : "—"}
                </div>
              </div>
              {apiHosts && Object.keys(apiHosts).length > 0 ? (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">API hosts</div>
                  <dl className="space-y-2">
                    {Object.entries(apiHosts).map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-muted/40 px-3 py-2">
                        <dt className="text-[10px] font-medium text-muted-foreground">{k}</dt>
                        <dd className="font-mono text-[11px] break-all">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No API host map returned (typical when disconnected).
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
