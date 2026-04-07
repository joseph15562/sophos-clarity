import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";
import {
  getEffectiveTenantDisplayName,
  getFirewallGroupsMerged,
  type CentralFirewallGroup,
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

type GroupRow = { tenantId: string; group: CentralFirewallGroup; members: number };

function normalizeGroupRow(raw: {
  tenantId?: string;
  group?: unknown;
  members?: unknown;
}): GroupRow | null {
  const tenantId = typeof raw.tenantId === "string" ? raw.tenantId.trim() : "";
  if (!tenantId) return null;
  const g = raw.group;
  if (!g || typeof g !== "object") return null;
  const group = g as CentralFirewallGroup;
  const id = String(group.id ?? "").trim();
  if (!id) return null;
  const members =
    typeof raw.members === "number" && Number.isFinite(raw.members)
      ? raw.members
      : (group.firewalls?.items?.length ?? 0);
  return { tenantId, group, members };
}

export default function CentralGroupsPage() {
  const { org } = useAuth();
  const orgId = org?.id;

  const groupsQuery = useQuery({
    queryKey: orgId ? queryKeys.central.firewallGroupsMerged(orgId) : ["central", "groups", "none"],
    queryFn: () => getFirewallGroupsMerged(orgId!),
    enabled: Boolean(orgId),
    staleTime: 120_000,
  });

  const bundleTenants = groupsQuery.data?.tenants ?? [];

  const tenantNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of bundleTenants) {
      m.set(t.id, getEffectiveTenantDisplayName(t, org?.name) || t.name);
    }
    return m;
  }, [bundleTenants, org?.name]);

  const rows = useMemo(() => {
    const raw = groupsQuery.data?.items ?? [];
    const out: GroupRow[] = [];
    for (const item of raw) {
      const row = normalizeGroupRow(
        item as { tenantId?: string; group?: unknown; members?: unknown },
      );
      if (row) out.push(row);
    }
    return out.sort((a, b) => {
      const na = tenantNameById.get(a.tenantId) ?? a.tenantId;
      const nb = tenantNameById.get(b.tenantId) ?? b.tenantId;
      const c = na.localeCompare(nb);
      if (c !== 0) return c;
      return (a.group.name ?? "").localeCompare(b.group.name ?? "");
    });
  }, [groupsQuery.data, tenantNameById]);

  if (!orgId) {
    return (
      <EmptyState title="Sign in required" description="Firewall groups require an organisation." />
    );
  }

  if (groupsQuery.isLoading && !groupsQuery.data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Loading firewall groups…</p>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (groupsQuery.isError) {
    return (
      <EmptyState
        title="Could not load groups"
        description={(groupsQuery.error as Error)?.message ?? "Try again later."}
      />
    );
  }

  if (bundleTenants.length === 0) {
    return (
      <EmptyState
        title="No tenants to query"
        description="Sync your Sophos Central directory first. Firewall groups are loaded per tenant on the server."
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No firewall groups"
        description="Central returned no groups for your tenants, or groups are not used in this estate."
      />
    );
  }

  return (
    <div className="space-y-4" data-tour="tour-central-groups-shell">
      <p className="text-sm text-muted-foreground">
        Live Sophos Central firewall groups in one workspace request (parallel on the server).
        Member counts use the group&apos;s firewall list when the API provides it.
      </p>
      <div className="rounded-xl border border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Group</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="font-mono text-xs">Group ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.tenantId}-${r.group.id}`}>
                <TableCell className="max-w-[180px] truncate text-sm">
                  {tenantNameById.get(r.tenantId) ?? r.tenantId}
                </TableCell>
                <TableCell className="font-medium">{r.group.name || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.members}</TableCell>
                <TableCell className="font-mono text-[10px] text-muted-foreground">
                  {r.group.id}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
