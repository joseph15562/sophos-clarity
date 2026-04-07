import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";
import {
  getCachedFirewalls,
  getCachedTenants,
  getEffectiveTenantDisplayName,
  getFirewallLicences,
  getLicences,
} from "@/lib/sophos-central";
import { mapTenantBatches } from "./central-batched";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";

type TenantLicRow = Awaited<ReturnType<typeof getLicences>>[number] & { tenantId: string };

async function fetchTenantLicencesMerged(
  orgId: string,
  tenantIds: string[],
): Promise<TenantLicRow[]> {
  const flat = await mapTenantBatches(tenantIds, async (tenantId) => {
    try {
      const licenses = await getLicences(orgId, tenantId);
      return licenses.map((l) => ({ ...l, tenantId }));
    } catch {
      return [];
    }
  });
  return flat.sort((a, b) => {
    const da = Date.parse(a.endDate);
    const db = Date.parse(b.endDate);
    if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return da - db;
    return (a.product?.name ?? a.product?.code ?? "").localeCompare(
      b.product?.name ?? b.product?.code ?? "",
    );
  });
}

export default function CentralLicensingPage() {
  const { org } = useAuth();
  const orgId = org?.id;
  const [tab, setTab] = useState("firewall");

  const tenantsQuery = useQuery({
    queryKey: orgId ? queryKeys.central.cachedTenants(orgId) : ["central", "tenants", "none"],
    queryFn: () => getCachedTenants(orgId!),
    enabled: Boolean(orgId),
  });

  const tenantIds = useMemo(() => (tenantsQuery.data ?? []).map((t) => t.id), [tenantsQuery.data]);

  const tenantKey = tenantIds.slice().sort().join("|");

  const tenantNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tenantsQuery.data ?? []) {
      m.set(t.id, getEffectiveTenantDisplayName(t, org?.name) || t.name);
    }
    return m;
  }, [tenantsQuery.data, org?.name]);

  const licencesQuery = useQuery({
    queryKey: orgId ? queryKeys.central.firewallLicences(orgId) : ["central", "lic", "none"],
    queryFn: () => getFirewallLicences(orgId!),
    enabled: Boolean(orgId) && tab === "firewall",
    staleTime: 120_000,
  });

  const firewallsQuery = useQuery({
    queryKey: orgId ? queryKeys.central.cachedFirewalls(orgId, "all") : ["central", "fw", "none"],
    queryFn: () => getCachedFirewalls(orgId!),
    enabled: Boolean(orgId) && tab === "firewall",
  });

  const tenantLicQuery = useQuery({
    queryKey:
      orgId && tenantKey
        ? queryKeys.central.tenantLicencesMerged(orgId, tenantKey)
        : ["central", "tenant_lic", "none"],
    queryFn: () => fetchTenantLicencesMerged(orgId!, tenantIds),
    enabled: Boolean(orgId) && tab === "tenant" && tenantIds.length > 0,
    staleTime: 120_000,
  });

  const firewallIdByTenantSerial = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of firewallsQuery.data ?? []) {
      m.set(`${f.centralTenantId}\0${f.serialNumber}`, f.firewallId);
    }
    return m;
  }, [firewallsQuery.data]);

  const deviceRows = useMemo(() => {
    const items = licencesQuery.data ?? [];
    return [...items].sort((a, b) =>
      (a.serialNumber ?? "").localeCompare(b.serialNumber ?? "", undefined, { numeric: true }),
    );
  }, [licencesQuery.data]);

  if (!orgId) {
    return (
      <EmptyState title="Sign in required" description="Licensing requires an organisation." />
    );
  }

  return (
    <div className="space-y-4" data-tour="tour-central-licensing-shell">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="firewall" className="text-xs">
            Firewall devices
          </TabsTrigger>
          <TabsTrigger value="tenant" className="text-xs">
            Tenant licences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="firewall" className="mt-4 space-y-4">
          {licencesQuery.isPending || firewallsQuery.isPending ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
            </div>
          ) : licencesQuery.isError ? (
            <EmptyState
              title="Could not load licensing"
              description={(licencesQuery.error as Error)?.message ?? "Try again later."}
            />
          ) : deviceRows.length === 0 ? (
            <EmptyState
              title="No firewall licence rows"
              description="Central returned no device licensing data for this connector."
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Per-device subscriptions from the Central licensing API. {deviceRows.length}{" "}
                devices.
              </p>
              <div className="rounded-xl border border-border/60 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">Subscriptions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deviceRows.map((row) => {
                      const tid = row.tenant?.id ?? row.billingTenant?.id ?? "—";
                      const fwId =
                        tid !== "—"
                          ? firewallIdByTenantSerial.get(`${tid}\0${row.serialNumber}`)
                          : undefined;
                      const fwLink =
                        tid !== "—" && fwId
                          ? `/central/firewall/${encodeURIComponent(tid)}/${encodeURIComponent(fwId)}`
                          : null;
                      return (
                        <TableRow key={`${row.serialNumber}-${tid}`}>
                          <TableCell className="font-mono text-xs">
                            {fwLink ? (
                              <Link
                                to={fwLink}
                                className="text-[#2006F7] hover:underline dark:text-[#00EDFF]"
                              >
                                {row.serialNumber}
                              </Link>
                            ) : (
                              row.serialNumber
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{row.model}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {row.modelType}
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate font-mono text-xs">
                            {tid}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.licenses?.length ?? 0}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="tenant" className="mt-4 space-y-4">
          {tenantsQuery.isPending ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
            </div>
          ) : tenantIds.length === 0 ? (
            <EmptyState
              title="No tenants"
              description="Sync Sophos Central to load tenant-level licence rows."
            />
          ) : tenantLicQuery.isPending ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
            </div>
          ) : tenantLicQuery.isError ? (
            <EmptyState
              title="Could not load tenant licences"
              description={(tenantLicQuery.error as Error)?.message ?? "Try again later."}
            />
          ) : (tenantLicQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No tenant licence rows"
              description="Central returned no legacy tenant licence records for your tenants."
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Tenant-level licence records (legacy licensing API), merged across your directory.{" "}
                {(tenantLicQuery.data ?? []).length} rows.
              </p>
              <div className="rounded-xl border border-border/60 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>End date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tenantLicQuery.data ?? []).map((row, i) => (
                      <TableRow key={`${row.tenantId}-${row.licenseIdentifier}-${i}`}>
                        <TableCell className="max-w-[160px] truncate text-sm">
                          {tenantNameById.get(row.tenantId) ?? row.tenantId}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.product?.name ?? row.product?.code ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">
                          {row.licenseIdentifier}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.type}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {row.endDate ? new Date(row.endDate).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
