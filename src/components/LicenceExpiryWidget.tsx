import { useState, useEffect, useMemo, useCallback } from "react";
import { Shield, Clock, AlertTriangle, Download, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCentral } from "@/hooks/use-central";
import type { CentralLicence, CentralTenant } from "@/lib/sophos-central";
import { getLicences } from "@/lib/sophos-central";

interface TenantLicence {
  tenantName: string;
  tenantId: string;
  licence: CentralLicence;
  daysRemaining: number;
}

type FilterMode = "all" | "expiring" | "expired";

export function LicenceExpiryWidget() {
  const { org, isGuest } = useAuth();
  const central = useCentral();
  const orgId = org?.id ?? "";

  const [licences, setLicences] = useState<TenantLicence[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [expanded, setExpanded] = useState(true);

  const fetchLicences = useCallback(async () => {
    if (!orgId || !central.isConnected || central.tenants.length === 0) return;
    setLoading(true);
    const all: TenantLicence[] = [];

    for (const tenant of central.tenants) {
      try {
        const items = await getLicences(orgId, tenant.id);
        for (const lic of items) {
          const days = lic.endDate
            ? Math.ceil((new Date(lic.endDate).getTime() - Date.now()) / 86_400_000)
            : 9999;
          all.push({ tenantName: tenant.name, tenantId: tenant.id, licence: lic, daysRemaining: days });
        }
      } catch {
        /* skip tenant on error */
      }
    }

    setLicences(all);
    setLoading(false);
  }, [orgId, central.isConnected, central.tenants]);

  useEffect(() => {
    if (central.isConnected && central.tenants.length > 0 && licences.length === 0) {
      fetchLicences();
    }
  }, [central.isConnected, central.tenants.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let items = licences;
    if (filterMode === "expired") items = items.filter((l) => l.daysRemaining <= 0);
    else if (filterMode === "expiring") items = items.filter((l) => l.daysRemaining > 0 && l.daysRemaining <= 90);
    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [licences, filterMode]);

  const expired = licences.filter((l) => l.daysRemaining <= 0).length;
  const expiringSoon = licences.filter((l) => l.daysRemaining > 0 && l.daysRemaining <= 30).length;
  const expiringMedium = licences.filter((l) => l.daysRemaining > 30 && l.daysRemaining <= 90).length;
  const healthy = licences.filter((l) => l.daysRemaining > 90).length;

  const handleExportCsv = useCallback(() => {
    const rows = [["Customer", "Licence", "Type", "Start Date", "End Date", "Days Remaining"]];
    for (const item of filtered) {
      rows.push([
        item.tenantName,
        item.licence.product?.name || item.licence.product?.code || "",
        item.licence.type,
        item.licence.startDate,
        item.licence.endDate,
        String(item.daysRemaining),
      ]);
    }
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `licence-expiry-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  if (!central.isConnected || isGuest) return null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="h-6 w-6 rounded-lg bg-[#F29400]/10 flex items-center justify-center shrink-0">
          <Shield className="h-3 w-3 text-[#F29400]" />
        </div>
        <span className="text-xs font-semibold text-foreground flex-1">Licence Expiry Monitor</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {expired > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-[#EA0022]/10 text-[#EA0022]">{expired} expired</span>}
          {expiringSoon > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-[#EA0022]/10 text-[#EA0022]">{expiringSoon} &lt;30d</span>}
          {expiringMedium > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-[#F29400]/10 text-[#F29400]">{expiringMedium} &lt;90d</span>}
          {healthy > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]">{healthy} ok</span>}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-2">
            <div className={`rounded-lg px-2.5 py-2 text-center cursor-pointer transition-colors ${filterMode === "all" ? "ring-2 ring-[#2006F7]" : ""} bg-muted/40`} onClick={() => setFilterMode("all")}>
              <p className="text-sm font-bold text-foreground">{licences.length}</p>
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Total</p>
            </div>
            <div className={`rounded-lg px-2.5 py-2 text-center cursor-pointer transition-colors ${filterMode === "expired" ? "ring-2 ring-[#EA0022]" : ""} bg-[#EA0022]/5`} onClick={() => setFilterMode("expired")}>
              <p className={`text-sm font-bold ${expired > 0 ? "text-[#EA0022]" : "text-foreground"}`}>{expired}</p>
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Expired</p>
            </div>
            <div className={`rounded-lg px-2.5 py-2 text-center cursor-pointer transition-colors ${filterMode === "expiring" ? "ring-2 ring-[#F29400]" : ""} bg-[#F29400]/5`} onClick={() => setFilterMode("expiring")}>
              <p className={`text-sm font-bold ${(expiringSoon + expiringMedium) > 0 ? "text-[#F29400]" : "text-foreground"}`}>{expiringSoon + expiringMedium}</p>
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">&lt;90 Days</p>
            </div>
            <div className="rounded-lg px-2.5 py-2 text-center bg-[#00995a]/5">
              <p className="text-sm font-bold text-[#00995a] dark:text-[#00F2B3]">{healthy}</p>
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Healthy</p>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-4 gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" /> Loading licences…
            </div>
          ) : filtered.length > 0 ? (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_80px_90px] gap-2 px-3 py-1.5 bg-muted/50 text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Customer</span>
                  <span>Licence</span>
                  <span>Expiry</span>
                  <span className="text-right">Days Left</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-border">
                  {filtered.map((item, idx) => (
                    <div key={`${item.tenantId}-${item.licence.licenseIdentifier}-${idx}`} className="grid grid-cols-[1fr_1fr_80px_90px] gap-2 px-3 py-2 items-center hover:bg-muted/30 transition-colors">
                      <span className="text-xs font-medium text-foreground truncate">{item.tenantName}</span>
                      <span className="text-[10px] text-foreground truncate">{item.licence.product?.name || item.licence.product?.code || item.licence.type}</span>
                      <span className="text-[10px] text-muted-foreground">{item.licence.endDate ? new Date(item.licence.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</span>
                      <span className={`text-[10px] font-bold text-right ${
                        item.daysRemaining <= 0 ? "text-[#EA0022]" :
                        item.daysRemaining <= 30 ? "text-[#EA0022]" :
                        item.daysRemaining <= 90 ? "text-[#F29400]" :
                        "text-[#00995a] dark:text-[#00F2B3]"
                      }`}>
                        {item.daysRemaining <= 0 ? "EXPIRED" : `${item.daysRemaining}d`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={fetchLicences} disabled={loading} className="gap-1 text-[10px] h-7">
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1 text-[10px] h-7">
                  <Download className="h-3 w-3" /> Export CSV
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">
              {licences.length === 0
                ? "No licence data available. Sync tenants first."
                : "No licences match this filter."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
