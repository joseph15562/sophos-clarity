import { useMemo, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";
import {
  getCachedFirewalls,
  getCachedTenants,
  getEffectiveTenantDisplayName,
  getFirewallDisplayName,
} from "@/lib/sophos-central";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import {
  centralFirewallConnectionState,
  centralClusterSummary,
  centralGroupLabel,
  formatExternalIps,
} from "./central-firewall-meta";

export default function CentralFirewallsPage() {
  const { org } = useAuth();
  const orgId = org?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantParam = searchParams.get("tenant") ?? "";

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

  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebouncedValue(searchRaw, 300);
  const [filterTenant, setFilterTenant] = useState<string>("__all__");

  useEffect(() => {
    if (tenantParam) setFilterTenant(tenantParam);
    else setFilterTenant("__all__");
  }, [tenantParam]);

  const tenantNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tenantsQuery.data ?? []) {
      m.set(t.id, getEffectiveTenantDisplayName(t, org?.name) || t.name);
    }
    return m;
  }, [tenantsQuery.data, org?.name]);

  const filtered = useMemo(() => {
    let list = firewallsQuery.data ?? [];
    if (filterTenant !== "__all__") {
      list = list.filter((f) => f.centralTenantId === filterTenant);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((f) => {
        const dn = getFirewallDisplayName(f).toLowerCase();
        const serial = (f.serialNumber ?? "").toLowerCase();
        const host = (f.hostname ?? "").toLowerCase();
        return dn.includes(q) || serial.includes(q) || host.includes(q);
      });
    }
    return list;
  }, [firewallsQuery.data, filterTenant, search]);

  const stats = useMemo(() => {
    const all = firewallsQuery.data ?? [];
    let online = 0;
    let offline = 0;
    let unknown = 0;
    for (const f of all) {
      const { connected } = centralFirewallConnectionState(f.status);
      if (connected === true) online++;
      else if (connected === false) offline++;
      else unknown++;
    }
    return { total: all.length, online, offline, unknown };
  }, [firewallsQuery.data]);

  if (!orgId) {
    return (
      <EmptyState
        title="Sign in required"
        description="Firewall inventory needs an organisation."
      />
    );
  }

  if (tenantsQuery.isPending || firewallsQuery.isPending) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
      </div>
    );
  }

  if ((firewallsQuery.data ?? []).length === 0) {
    return (
      <EmptyState
        title="No cached firewalls"
        description="Run an inventory sync from the Sync tab after connecting Sophos Central."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4" data-tour="tour-central-fw-intro">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 min-w-[200px]">
            <Label htmlFor="central-fw-tenant">Tenant</Label>
            <Select
              value={filterTenant}
              onValueChange={(v) => {
                setFilterTenant(v);
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev);
                  if (v === "__all__") p.delete("tenant");
                  else p.set("tenant", v);
                  return p;
                });
              }}
            >
              <SelectTrigger id="central-fw-tenant">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All tenants</SelectItem>
                {(tenantsQuery.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {getEffectiveTenantDisplayName(t, org?.name) || t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px] max-w-md">
            <Label htmlFor="central-fw-search">Search</Label>
            <Input
              id="central-fw-search"
              placeholder="Hostname, serial, display name…"
              defaultValue=""
              onChange={(e) => setSearchRaw(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Cached inventory: {stats.total} devices · reported online {stats.online} · offline{" "}
          {stats.offline}
          {stats.unknown ? ` · unknown ${stats.unknown}` : ""}. Showing {filtered.length} row
          {filtered.length === 1 ? "" : "s"}.
        </p>
      </div>
      <div
        className="rounded-xl border border-border/60 overflow-x-auto"
        data-tour="tour-central-fw-table"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Firewall</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Model / firmware</TableHead>
              <TableHead>External IP</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>HA</TableHead>
              <TableHead>State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((f) => {
              const dn = getFirewallDisplayName(f);
              const { connected, suspended } = centralFirewallConnectionState(f.status);
              const href = `/central/firewall/${encodeURIComponent(f.centralTenantId)}/${encodeURIComponent(f.firewallId)}`;
              return (
                <TableRow key={f.firewallId}>
                  <TableCell>
                    <Link
                      to={href}
                      className="font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
                    >
                      {dn}
                    </Link>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {f.serialNumber}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                    {tenantNameById.get(f.centralTenantId) ?? f.centralTenantId}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{f.model}</div>
                    <div className="text-muted-foreground font-mono">{f.firmwareVersion}</div>
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">
                    {formatExternalIps(f.externalIps)}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-xs">
                    {centralGroupLabel(f.group)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {centralClusterSummary(f.cluster)}
                  </TableCell>
                  <TableCell>
                    {suspended ? (
                      <Badge variant="destructive" className="font-normal text-[10px]">
                        Suspended
                      </Badge>
                    ) : connected === true ? (
                      <Badge
                        variant="outline"
                        className="font-normal text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                      >
                        Online
                      </Badge>
                    ) : connected === false ? (
                      <Badge variant="outline" className="font-normal text-[10px]">
                        Offline
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
