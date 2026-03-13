import { useState, useEffect, useMemo, useCallback } from "react";
import { Shield, AlertTriangle, Download, ChevronDown, RefreshCw, Server, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCentral } from "@/hooks/use-central";
import { getFirewallLicences, type FirewallLicence, type FirewallSubscription } from "@/lib/sophos-central";

interface FlattenedLicence {
  serialNumber: string;
  model: string;
  modelType: "virtual" | "hardware";
  lastSeenAt?: string;
  subscription: FirewallSubscription;
  daysRemaining: number;
}

type FilterMode = "all" | "expiring" | "expired";

export function LicenceExpiryWidget() {
  const { org, isGuest } = useAuth();
  const central = useCentral();
  const orgId = org?.id ?? "";

  const [firewallLicences, setFirewallLicences] = useState<FirewallLicence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [expanded, setExpanded] = useState(true);

  const fetchLicences = useCallback(async () => {
    if (!orgId || !central.isConnected) return;
    setLoading(true);
    setError("");
    try {
      const tenantId = central.tenants.length === 1 ? central.tenants[0].id : undefined;
      const items = await getFirewallLicences(orgId, tenantId);
      setFirewallLicences(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch firewall licences");
    }
    setLoading(false);
  }, [orgId, central.isConnected, central.tenants]);

  useEffect(() => {
    if (central.isConnected && central.tenants.length > 0 && firewallLicences.length === 0 && !loading) {
      fetchLicences();
    }
  }, [central.isConnected, central.tenants.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const flattened = useMemo<FlattenedLicence[]>(() => {
    const items: FlattenedLicence[] = [];
    for (const fw of firewallLicences) {
      for (const sub of fw.licenses) {
        const days = sub.endDate
          ? Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86_400_000)
          : sub.perpetual ? 9999 : 9999;
        items.push({
          serialNumber: fw.serialNumber,
          model: fw.model,
          modelType: fw.modelType,
          lastSeenAt: fw.lastSeenAt,
          subscription: sub,
          daysRemaining: days,
        });
      }
    }
    return items;
  }, [firewallLicences]);

  const filtered = useMemo(() => {
    let items = flattened;
    if (filterMode === "expired") items = items.filter((l) => l.daysRemaining <= 0);
    else if (filterMode === "expiring") items = items.filter((l) => l.daysRemaining > 0 && l.daysRemaining <= 90);
    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [flattened, filterMode]);

  const expired = flattened.filter((l) => l.daysRemaining <= 0).length;
  const expiringSoon = flattened.filter((l) => l.daysRemaining > 0 && l.daysRemaining <= 30).length;
  const expiringMedium = flattened.filter((l) => l.daysRemaining > 30 && l.daysRemaining <= 90).length;
  const healthy = flattened.filter((l) => l.daysRemaining > 90).length;

  const handleExportCsv = useCallback(() => {
    const rows = [["Serial Number", "Model", "Type", "Product", "Licence Type", "Start Date", "End Date", "Perpetual", "Days Remaining"]];
    for (const item of filtered) {
      rows.push([
        item.serialNumber,
        item.model,
        item.modelType,
        item.subscription.product?.name || item.subscription.product?.code || "",
        item.subscription.type,
        item.subscription.startDate,
        item.subscription.endDate ?? "",
        String(item.subscription.perpetual),
        String(item.daysRemaining),
      ]);
    }
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firewall-licences-${new Date().toISOString().slice(0, 10)}.csv`;
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
        <span className="text-xs font-semibold text-foreground flex-1">Firewall Licence Monitor</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {firewallLicences.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-muted text-muted-foreground">
              {firewallLicences.length} firewall{firewallLicences.length !== 1 ? "s" : ""}
            </span>
          )}
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
              <p className="text-sm font-bold text-foreground">{flattened.length}</p>
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

          {/* Firewall licence cards (grouped by serial) */}
          {loading ? (
            <div className="flex items-center justify-center py-4 gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" /> Loading firewall licences…
            </div>
          ) : error ? (
            <div className="text-center py-3 space-y-2">
              <p className="text-xs text-[#EA0022]">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchLicences} className="gap-1 text-[10px] h-7">
                <RefreshCw className="h-3 w-3" /> Retry
              </Button>
            </div>
          ) : filtered.length > 0 ? (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[100px_1fr_90px_80px_70px] gap-2 px-3 py-1.5 bg-muted/50 text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Serial</span>
                  <span>Product</span>
                  <span>Type</span>
                  <span>Expiry</span>
                  <span className="text-right">Status</span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-border">
                  {filtered.map((item, idx) => (
                    <div key={`${item.serialNumber}-${item.subscription.id}-${idx}`} className="grid grid-cols-[100px_1fr_90px_80px_70px] gap-2 px-3 py-2 items-center hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <Server className={`h-3 w-3 shrink-0 ${item.modelType === "virtual" ? "text-[#009CFB]" : "text-muted-foreground"}`} />
                        <span className="text-[10px] font-mono text-foreground truncate" title={item.serialNumber}>
                          {item.serialNumber.slice(-8)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-medium text-foreground truncate block">
                          {item.subscription.product?.name || item.subscription.product?.code || "Unknown"}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{item.model}</span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium truncate ${
                        item.subscription.type === "trial" ? "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]" :
                        item.subscription.type === "perpetual" ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {item.subscription.perpetual ? "Perpetual" : item.subscription.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.subscription.perpetual ? "Never" :
                         item.subscription.endDate ? new Date(item.subscription.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                      </span>
                      <span className={`text-[10px] font-bold text-right ${
                        item.subscription.perpetual ? "text-[#00995a] dark:text-[#00F2B3]" :
                        item.daysRemaining <= 0 ? "text-[#EA0022]" :
                        item.daysRemaining <= 30 ? "text-[#EA0022]" :
                        item.daysRemaining <= 90 ? "text-[#F29400]" :
                        "text-[#00995a] dark:text-[#00F2B3]"
                      }`}>
                        {item.subscription.perpetual ? "OK" :
                         item.daysRemaining <= 0 ? "EXPIRED" : `${item.daysRemaining}d`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last seen info */}
              {firewallLicences.some((fw) => fw.lastSeenAt) && (
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last check-in: {(() => {
                    const latest = firewallLicences
                      .filter((fw) => fw.lastSeenAt)
                      .sort((a, b) => new Date(b.lastSeenAt!).getTime() - new Date(a.lastSeenAt!).getTime())[0];
                    return latest?.lastSeenAt ? new Date(latest.lastSeenAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "unknown";
                  })()}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={fetchLicences} disabled={loading} className="gap-1 text-[10px] h-7">
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1 text-[10px] h-7">
                  <Download className="h-3 w-3" /> Export CSV
                </Button>
              </div>

              {/* API reference note */}
              <p className="text-[8px] text-muted-foreground text-center">
                Data from Sophos Central Licensing API (/licenses/v1/licenses/firewalls)
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">
              {flattened.length === 0
                ? "No firewall licence data available. Ensure your API credentials have licensing scope."
                : "No licences match this filter."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
