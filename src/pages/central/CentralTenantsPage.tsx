import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";
import {
  getCachedTenants,
  getCachedFirewalls,
  getEffectiveTenantDisplayName,
} from "@/lib/sophos-central";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";

export default function CentralTenantsPage() {
  const { org } = useAuth();
  const orgId = org?.id;

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

  const countsByTenant = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of firewallsQuery.data ?? []) {
      m.set(f.centralTenantId, (m.get(f.centralTenantId) ?? 0) + 1);
    }
    return m;
  }, [firewallsQuery.data]);

  if (!orgId) {
    return (
      <EmptyState
        title="Sign in required"
        description="Tenant list needs an organisation context."
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

  const tenants = tenantsQuery.data ?? [];

  if (tenants.length === 0) {
    return (
      <EmptyState
        title="No cached tenants"
        description="Connect Sophos Central and run a sync from the Sync tab (or the header refresh) to pull your tenant directory."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" data-tour="tour-central-tenants-intro">
        Rows come from the last successful sync stored in your workspace (not a live directory
        listing).
      </p>
      <div className="rounded-xl border border-border/60" data-tour="tour-central-tenants-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead className="text-right">Firewalls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => {
              const display = getEffectiveTenantDisplayName(t, org?.name);
              const n = countsByTenant.get(t.id) ?? 0;
              const sampleFw = (firewallsQuery.data ?? []).find((f) => f.centralTenantId === t.id);
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/central/firewalls?tenant=${encodeURIComponent(t.id)}`}
                      className="text-[#2006F7] hover:underline dark:text-[#00EDFF]"
                    >
                      {display || t.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.dataRegion}</TableCell>
                  <TableCell className="text-muted-foreground">{t.billingType}</TableCell>
                  <TableCell className="text-right">
                    {sampleFw && n > 0 ? (
                      <Link
                        to={`/central/firewall/${encodeURIComponent(t.id)}/${encodeURIComponent(sampleFw.firewallId)}`}
                        className="text-[#2006F7] hover:underline dark:text-[#00EDFF]"
                      >
                        {n}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{n}</span>
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
