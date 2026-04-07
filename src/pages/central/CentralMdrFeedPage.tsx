import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";
import { getEffectiveTenantDisplayName, getMdrThreatFeedMerged } from "@/lib/sophos-central";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";

type MdrRow = {
  tenantId: string;
  id: string;
  type: string;
  value: string;
  description: string;
  when: string;
};

function normalizeMdrItem(item: unknown, tenantId: string): MdrRow | null {
  if (!item || typeof item !== "object") return null;
  const r = item as Record<string, unknown>;
  const id = String(r.id ?? r.threatId ?? r.indicatorId ?? "").trim();
  const type = String(r.type ?? r.indicatorType ?? r.observableType ?? "").trim();
  const value = String(r.value ?? r.indicator ?? r.observable ?? r.address ?? "").trim();
  const description = String(r.description ?? r.title ?? r.name ?? r.summary ?? "").trim();
  const when = String(
    r.createdAt ?? r.created_at ?? r.generatedAt ?? r.firstSeenAt ?? r.timestamp ?? "",
  ).trim();
  if (!id && !value && !description) return null;
  return { tenantId, id: id || "—", type: type || "—", value: value || "—", description, when };
}

function tenantIdFromMergedPayload(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const t = (item as Record<string, unknown>).tenantId;
  return typeof t === "string" ? t.trim() : "";
}

export default function CentralMdrFeedPage() {
  const { org } = useAuth();
  const orgId = org?.id;

  const mdrQuery = useQuery({
    queryKey: orgId ? queryKeys.central.mdrThreatFeedMerged(orgId) : ["central", "mdr", "none"],
    queryFn: () => getMdrThreatFeedMerged(orgId!),
    enabled: Boolean(orgId),
    staleTime: 120_000,
  });

  const bundleTenants = mdrQuery.data?.tenants ?? [];

  const tenantNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of bundleTenants) {
      m.set(t.id, getEffectiveTenantDisplayName(t, org?.name) || t.name);
    }
    return m;
  }, [bundleTenants, org?.name]);

  const rows = useMemo(() => {
    const raw = mdrQuery.data?.items ?? [];
    const normalized: MdrRow[] = [];
    for (const it of raw) {
      const tid = tenantIdFromMergedPayload(it);
      const row = normalizeMdrItem(it, tid || "—");
      if (row) normalized.push(row);
    }
    normalized.sort((a, b) => {
      const ta = a.when ? Date.parse(a.when) : 0;
      const tb = b.when ? Date.parse(b.when) : 0;
      if (tb !== ta) return tb - ta;
      return `${a.tenantId}-${a.id}`.localeCompare(`${b.tenantId}-${b.id}`);
    });
    return normalized.slice(0, 300);
  }, [mdrQuery.data]);

  if (!orgId) {
    return <EmptyState title="Sign in required" description="MDR feed requires an organisation." />;
  }

  if (mdrQuery.isPending && !mdrQuery.data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Loading MDR threat feed…</p>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (mdrQuery.isError) {
    return (
      <EmptyState
        title="Could not load MDR feed"
        description={(mdrQuery.error as Error)?.message ?? "Try again later."}
      />
    );
  }

  if (bundleTenants.length === 0) {
    return (
      <EmptyState
        title="No tenants to query"
        description="Sync your Sophos Central directory first. MDR is requested per tenant on the server."
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No MDR indicators"
        description="Central returned no threat-feed rows for your tenants, or the feature is not enabled for this account."
      />
    );
  }

  return (
    <div className="space-y-4" data-tour="tour-central-mdr-shell">
      <p className="text-sm text-muted-foreground">
        Firewall MDR threat feed from Sophos Central, merged in one workspace request (parallel on
        the server). Normalized columns where possible; API shapes vary by region and entitlement.
        Showing up to 300 rows.
      </p>
      <div className="rounded-xl border border-border/60 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.tenantId}-${r.id}-${r.value}`}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {r.when
                    ? Number.isFinite(Date.parse(r.when))
                      ? new Date(r.when).toLocaleString()
                      : r.when
                    : "—"}
                </TableCell>
                <TableCell className="max-w-[140px] truncate text-sm">
                  {tenantNameById.get(r.tenantId) ?? r.tenantId}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal text-[10px]">
                    {r.type}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate font-mono text-xs">
                  {r.value}
                </TableCell>
                <TableCell className="max-w-md text-sm text-muted-foreground">
                  {r.description || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
