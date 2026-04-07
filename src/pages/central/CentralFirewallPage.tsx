import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, HardDrive, LayoutGrid } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";
import { getCachedFirewalls, getFirewallDisplayName } from "@/lib/sophos-central";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  centralClusterSummary,
  centralGroupLabel,
  formatExternalIps,
} from "./central-firewall-meta";

export default function CentralFirewallPage() {
  const { tenantId: tenantIdParam, firewallId: firewallIdParam } = useParams<{
    tenantId: string;
    firewallId: string;
  }>();
  const { org } = useAuth();
  const orgId = org?.id;

  const tenantId = tenantIdParam ? decodeURIComponent(tenantIdParam) : "";
  const firewallId = firewallIdParam ? decodeURIComponent(firewallIdParam) : "";

  const firewallsQuery = useQuery({
    queryKey:
      orgId && tenantId
        ? queryKeys.central.cachedFirewalls(orgId, tenantId)
        : ["central", "fw", "none"],
    queryFn: () => getCachedFirewalls(orgId!, tenantId),
    enabled: Boolean(orgId && tenantId),
  });

  const fw = (firewallsQuery.data ?? []).find((f) => f.firewallId === firewallId);

  const fleetHref =
    fw && org?.name
      ? `/?${new URLSearchParams({
          customer: org.name,
          fleetContext: fw.rowId,
        }).toString()}`
      : fw
        ? `/?${new URLSearchParams({ fleetContext: fw.rowId }).toString()}`
        : "/command";

  if (!orgId) {
    return (
      <EmptyState
        title="Sign in required"
        description="Open this page from a signed-in workspace."
      />
    );
  }

  if (!tenantId || !firewallId) {
    return <EmptyState title="Invalid link" description="Missing tenant or firewall id." />;
  }

  if (firewallsQuery.isPending) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
      </div>
    );
  }

  if (!fw) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Firewall not in cache"
          description="Run a sync from the Sync tab, or confirm the firewall still exists in Sophos Central."
        />
        <Button variant="outline" size="sm" asChild>
          <Link to="/central/tenants">Back to tenants</Link>
        </Button>
      </div>
    );
  }

  const displayName = getFirewallDisplayName({
    name: fw.name,
    hostname: fw.hostname,
    serialNumber: fw.serialNumber,
  });

  return (
    <div className="space-y-6" data-tour="tour-central-fw-detail-shell">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link to="/central/tenants">
            <ArrowLeft className="h-4 w-4" />
            Tenants
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link to={`/central/firewalls?tenant=${encodeURIComponent(tenantId)}`}>
            <HardDrive className="h-4 w-4" />
            Tenant firewalls
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link to={fleetHref}>
            <LayoutGrid className="h-4 w-4" />
            Open in Fleet
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HardDrive className="h-5 w-5 text-[#00EDFF]" />
            {displayName}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-mono">
            {fw.firewallId} · Tenant {tenantId}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Serial</div>
            <div className="font-mono text-xs">{fw.serialNumber}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Hostname</div>
            <div>{fw.hostname || "—"}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Model</div>
            <div>{fw.model}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Firmware</div>
            <div className="font-mono text-xs">{fw.firmwareVersion}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs font-medium text-muted-foreground">External IPv4</div>
            <div className="font-mono text-xs">{formatExternalIps(fw.externalIps)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Group</div>
            <div>{centralGroupLabel(fw.group)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Cluster</div>
            <div className="text-muted-foreground">{centralClusterSummary(fw.cluster)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Synced at</div>
            <div className="text-xs text-muted-foreground">
              {fw.syncedAt ? new Date(fw.syncedAt).toLocaleString() : "—"}
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs font-medium text-muted-foreground mb-1">Status (JSON)</div>
            <pre className="max-h-48 overflow-auto rounded-lg bg-muted/50 p-3 text-[11px] leading-relaxed">
              {JSON.stringify(fw.status ?? {}, null, 2)}
            </pre>
          </div>
          {fw.cluster != null && typeof fw.cluster === "object" ? (
            <div className="sm:col-span-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">Cluster (JSON)</div>
              <pre className="max-h-40 overflow-auto rounded-lg bg-muted/50 p-3 text-[11px] leading-relaxed">
                {JSON.stringify(fw.cluster, null, 2)}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
