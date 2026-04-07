import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";
import { useMissionAlertsBundleQuery } from "@/hooks/queries/use-mission-alerts-bundle-query";
import { getEffectiveTenantDisplayName, type CentralAlert } from "@/lib/sophos-central";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";

type AlertRow = CentralAlert & { tenantId: string };

export default function CentralAlertsPage() {
  const { org } = useAuth();
  const orgId = org?.id;
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>("__all__");
  const [tenantFilter, setTenantFilter] = useState<string>("__all__");
  const [searchRaw, setSearchRaw] = useState("");

  const alertsQuery = useMissionAlertsBundleQuery(orgId, Boolean(orgId));

  const bundleTenants = alertsQuery.data?.tenants ?? [];
  const tenantIds = useMemo(() => bundleTenants.map((t) => t.id), [bundleTenants]);

  const tenantNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of bundleTenants) {
      m.set(t.id, getEffectiveTenantDisplayName(t, org?.name) || t.name);
    }
    return m;
  }, [bundleTenants, org?.name]);

  const allRows: AlertRow[] = alertsQuery.data?.items ?? [];

  const severities = useMemo(() => {
    const s = new Set<string>();
    for (const a of allRows) {
      if (a.severity) s.add(String(a.severity));
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const filtered = useMemo(() => {
    let list = [...allRows];
    if (severityFilter !== "__all__") {
      list = list.filter((a) => String(a.severity) === severityFilter);
    }
    if (tenantFilter !== "__all__") {
      list = list.filter((a) => a.tenantId === tenantFilter);
    }
    const q = searchRaw.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const desc = (a.description ?? "").toLowerCase();
        const cat = (a.category ?? "").toLowerCase();
        const prod = (a.product ?? "").toLowerCase();
        return desc.includes(q) || cat.includes(q) || prod.includes(q);
      });
    }
    return list;
  }, [allRows, severityFilter, tenantFilter, searchRaw]);

  const refetchAlerts = () => {
    if (orgId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.central.missionAlertsBundle(orgId),
      });
    }
  };

  if (!orgId) {
    return <EmptyState title="Sign in required" description="Alerts require an organisation." />;
  }

  if (alertsQuery.isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Loading alerts from Central…</p>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (alertsQuery.isError) {
    return (
      <EmptyState
        title="Could not load alerts"
        description={(alertsQuery.error as Error)?.message ?? "Try again in a moment."}
      />
    );
  }

  if (tenantIds.length === 0) {
    return (
      <EmptyState
        title="No tenants to query"
        description="Sync your Sophos Central directory first, then return here for alerts."
      />
    );
  }

  if (allRows.length === 0) {
    return (
      <EmptyState
        title="No open alerts"
        description="Central returned no alerts for your tenants (or the request failed silently per tenant)."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4" data-tour="tour-central-alerts-controls">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Live data from Sophos Central in a single workspace request (same feed as Mission
            control when prefetched). Up to 300 rows; use filters to narrow the view.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => refetchAlerts()}
            disabled={alertsQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${alertsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 min-w-[160px]">
            <Label htmlFor="central-alert-sev">Severity</Label>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger id="central-alert-sev">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All severities</SelectItem>
                {severities.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[200px]">
            <Label htmlFor="central-alert-tenant">Tenant</Label>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger id="central-alert-tenant">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All tenants</SelectItem>
                {bundleTenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {getEffectiveTenantDisplayName(t, org?.name) || t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px] max-w-md">
            <Label htmlFor="central-alert-q">Search</Label>
            <Input
              id="central-alert-q"
              placeholder="Description, category, product…"
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {allRows.length} loaded alerts.
        </p>
      </div>

      <div
        className="rounded-xl border border-border/60 overflow-x-auto"
        data-tour="tour-central-alerts-table"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Raised</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Product</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={`${a.tenantId}-${a.id}`}>
                <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                  {a.raisedAt ? new Date(a.raisedAt).toLocaleString() : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {a.severity}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[140px] truncate text-sm">
                  {tenantNameById.get(a.tenantId) ?? a.tenantId}
                </TableCell>
                <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
                  {a.category || "—"}
                </TableCell>
                <TableCell className="max-w-md text-sm">{a.description}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{a.product ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
