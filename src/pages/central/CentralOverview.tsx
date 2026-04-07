import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Cloud,
  HardDrive,
  RefreshCw,
  ShieldAlert,
  KeyRound,
  Layers,
  Radar,
  Globe,
  Activity,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";
import { getCentralStatus, getCachedTenants, getCachedFirewalls } from "@/lib/sophos-central";
import { buildManagePanelSearch } from "@/lib/workspace-deeplink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { centralFirewallConnectionState } from "./central-firewall-meta";

const hubLinks = [
  { to: "/central/tenants", label: "Tenants", desc: "Cached directory", icon: Building2 },
  { to: "/central/firewalls", label: "Firewalls", desc: "Full inventory", icon: HardDrive },
  { to: "/central/alerts", label: "Alerts", desc: "Live feed", icon: ShieldAlert },
  { to: "/central/mdr", label: "MDR feed", desc: "Threat indicators", icon: Radar },
  { to: "/central/groups", label: "Groups", desc: "Firewall groups", icon: Layers },
  { to: "/central/licensing", label: "Licensing", desc: "Devices & tenant SKUs", icon: KeyRound },
  { to: "/central/sync", label: "Sync & API", desc: "Inventory + connector", icon: RefreshCw },
] as const;

export default function CentralOverview() {
  const { org } = useAuth();
  const orgId = org?.id;

  const statusQuery = useQuery({
    queryKey: orgId ? queryKeys.central.status(orgId) : ["central", "status", "none"],
    queryFn: () => getCentralStatus(orgId!),
    enabled: Boolean(orgId),
  });

  const tenantsQuery = useQuery({
    queryKey: orgId ? queryKeys.central.cachedTenants(orgId) : ["central", "tenants", "none"],
    queryFn: () => getCachedTenants(orgId!),
    enabled: Boolean(orgId),
  });

  const firewallsQuery = useQuery({
    queryKey: orgId ? queryKeys.central.cachedFirewalls(orgId, "all") : ["central", "fw", "none"],
    queryFn: () => getCachedFirewalls(orgId!),
    enabled: Boolean(orgId),
  });

  if (!orgId) {
    return (
      <EmptyState
        title="Sign in required"
        description="Open Sophos Central from a signed-in workspace."
      />
    );
  }

  const connected = statusQuery.data?.connected ?? false;
  const tenantCount = tenantsQuery.data?.length ?? 0;
  const firewallCount = firewallsQuery.data?.length ?? 0;
  const loading = statusQuery.isPending || tenantsQuery.isPending || firewallsQuery.isPending;

  const regionCount = new Set((tenantsQuery.data ?? []).map((t) => t.dataRegion).filter(Boolean))
    .size;

  let onlineFw = 0;
  let offlineFw = 0;
  for (const f of firewallsQuery.data ?? []) {
    const { connected: c } = centralFirewallConnectionState(f.status);
    if (c === true) onlineFw++;
    else if (c === false) offlineFw++;
  }

  const settingsHref = `/?${buildManagePanelSearch({ panel: "settings", section: "central" })}`;
  const apiHosts = statusQuery.data?.api_hosts;

  return (
    <div className="space-y-8">
      {!connected && (
        <Card
          className="border-amber-500/30 bg-amber-500/[0.06]"
          data-tour="tour-central-connect-banner"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Not connected</CardTitle>
            <CardDescription>
              Connect Sophos Central in workspace settings to sync tenants, firewalls, and live API
              data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="default" size="sm">
              <Link to={settingsHref}>Open Central settings</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-tour="tour-central-summary-cards"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{connected ? "Connected" : "Disconnected"}</p>
            <p className="text-xs text-muted-foreground">
              {statusQuery.data?.partner_type ? `${statusQuery.data.partner_type} scope · ` : ""}
              {statusQuery.data?.last_synced_at
                ? `Last sync ${new Date(statusQuery.data.last_synced_at).toLocaleString()}`
                : statusQuery.data?.connected_at
                  ? `Connected ${new Date(statusQuery.data.connected_at).toLocaleString()}`
                  : loading
                    ? "Loading…"
                    : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenants (cached)</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{loading ? "—" : tenantCount}</p>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0" />
              <span>
                {loading ? "—" : `${regionCount} data region${regionCount === 1 ? "" : "s"}`}
              </span>
            </div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/central/tenants">View directory</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Firewalls (cached)</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{loading ? "—" : firewallCount}</p>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <Activity className="h-3 w-3 shrink-0" />
              <span>{loading ? "—" : `Reported online ${onlineFw} · offline ${offlineFw}`}</span>
            </div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to="/central/firewalls">Browse inventory</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Refresh</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Pull latest tenants and firewalls.</p>
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <Link to="/central/sync">Sync &amp; API details</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {connected && apiHosts && Object.keys(apiHosts).length > 0 ? (
        <Card data-tour="tour-central-api-hosts">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">API hosts</CardTitle>
            <CardDescription>
              Resolved Central endpoints for this connector (read-only).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              {Object.entries(apiHosts).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-3 py-2">
                  <dt className="font-medium text-muted-foreground">{k}</dt>
                  <dd className="font-mono text-[11px] break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <div data-tour="tour-central-explore">
        <h2 className="text-sm font-semibold text-foreground mb-3">Explore</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hubLinks.map(({ to, label, desc, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-[#2006F7]/35 hover:bg-muted/30 dark:hover:border-[#00EDFF]/25"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2006F7]/10 text-[#2006F7] dark:bg-[#00EDFF]/10 dark:text-[#00EDFF]">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium text-foreground group-hover:text-[#2006F7] dark:group-hover:text-[#00EDFF]">
                  {label}
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
