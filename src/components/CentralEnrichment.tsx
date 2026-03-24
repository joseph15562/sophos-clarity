import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, AlertTriangle, Clock, Server, RefreshCw, ChevronDown, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getCentralStatus, getCachedFirewalls, getAlerts, getFirewallLicences,
  type CentralStatus, type CentralAlert,
} from "@/lib/sophos-central";

interface CentralEnrichmentProps {
  configMetas: Array<{ label: string; hostname?: string; configHash: string }>;
  customerName: string;
}

interface FirewallInfo {
  firewallId: string;
  hostname: string;
  serialNumber: string;
  firmwareVersion: string;
  model: string;
  status: { connected?: boolean } | null;
  cluster: { mode?: string; status?: string } | null;
}

interface LicenceSummary {
  product: string;
  type: string;
  endDate: string;
  perpetual: boolean;
  daysRemaining: number;
}

interface LinkedFirewallData {
  configLabel: string;
  firewall: FirewallInfo | null;
  alerts: CentralAlert[];
  licences: LicenceSummary[];
}

export function CentralEnrichment({ configMetas, customerName: _customerName }: CentralEnrichmentProps) {
  const { org, isGuest } = useAuth();
  const orgId = org?.id ?? "";

  const [status, setStatus] = useState<CentralStatus | null>(null);
  const [enrichedData, setEnrichedData] = useState<LinkedFirewallData[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [loadAttempted, setLoadAttempted] = useState(false);

  // Check connection status
  useEffect(() => {
    if (!orgId || isGuest) return;
    getCentralStatus(orgId).then(setStatus).catch(() => setStatus(null));
  }, [orgId, isGuest]);

  const loadEnrichment = useCallback(async () => {
    if (!status?.connected || !orgId || configMetas.length === 0) return;
    setLoading(true);

    const hashes = configMetas.map((c) => c.configHash);
    const { data: links } = await supabase
      .from("firewall_config_links")
      .select("config_hash, central_firewall_id, central_tenant_id")
      .eq("org_id", orgId)
      .in("config_hash", hashes);

    if (!links || links.length === 0) {
      setEnrichedData([]);
      setLoading(false);
      setLoadAttempted(true);
      return;
    }

    // Load cached firewalls from DB
    const cachedFws = await getCachedFirewalls(orgId);

    const tenantIds = [...new Set(links.map((l) => l.central_tenant_id))];

    // Fetch per-firewall licence data — try each tenant
    const licencesBySerial: Record<string, LicenceSummary[]> = {};
    for (const tenantId of tenantIds) {
      try {
        const fwLicences = await getFirewallLicences(orgId, tenantId);
        for (const fwl of fwLicences) {
          licencesBySerial[fwl.serialNumber] = fwl.licenses.map((l) => ({
            product: l.product?.name || l.product?.code || l.type,
            type: l.type,
            endDate: l.endDate ?? "",
            perpetual: l.perpetual,
            daysRemaining: l.endDate
              ? Math.ceil((new Date(l.endDate).getTime() - Date.now()) / 86_400_000)
              : l.perpetual ? 9999 : 9999,
          }));
        }
      } catch (err) {
        console.warn("[loadEnrichment] licensing API may not be available for tenant", err);
      }
    }

    const results: LinkedFirewallData[] = [];

    for (const tenantId of tenantIds) {
      const tenantLinks = links.filter((l) => l.central_tenant_id === tenantId);

      let alerts: CentralAlert[] = [];
      try { alerts = await getAlerts(orgId, tenantId); } catch (err) { console.warn("[loadEnrichment] getAlerts", err); }

      for (const link of tenantLinks) {
        const config = configMetas.find((c) => c.configHash === link.config_hash);
        const cached = cachedFws.find((f) => f.firewallId === link.central_firewall_id);
        const fw: FirewallInfo | null = cached ? {
          firewallId: cached.firewallId,
          hostname: cached.hostname,
          serialNumber: cached.serialNumber,
          firmwareVersion: cached.firmwareVersion,
          model: cached.model,
          status: cached.status as FirewallInfo["status"],
          cluster: cached.cluster as FirewallInfo["cluster"],
        } : null;

        results.push({
          configLabel: config?.label ?? link.config_hash,
          firewall: fw,
          alerts: alerts.filter((a) => a.managedAgent?.id === link.central_firewall_id),
          licences: fw?.serialNumber ? (licencesBySerial[fw.serialNumber] ?? []) : [],
        });
      }
    }

    setEnrichedData(results);
    setLoading(false);
    setLoadAttempted(true);
  }, [status?.connected, orgId, configMetas]);

  // Load on mount and when status/configs change
  useEffect(() => {
    if (status?.connected && !loadAttempted) loadEnrichment();
  }, [status?.connected, loadAttempted, loadEnrichment]);

  // Also poll for links every few seconds until we find some (in case user just linked)
  useEffect(() => {
    if (!status?.connected || enrichedData.length > 0 || !loadAttempted) return;
    const interval = setInterval(() => { loadEnrichment(); }, 5000);
    return () => clearInterval(interval);
  }, [status?.connected, enrichedData.length, loadAttempted, loadEnrichment]);

  if (!status?.connected || isGuest) return null;
  if (loading && enrichedData.length === 0) {
    return (
      <div className="rounded-lg border border-[#005BC8]/20 dark:border-[#00EDFF]/20 bg-[#005BC8]/[0.03] dark:bg-[#00EDFF]/[0.03] px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="h-3 w-3 animate-spin" /> Loading Central data…
      </div>
    );
  }
  if (enrichedData.length === 0) return null;

  const totalAlerts = enrichedData.reduce((s, d) => s + d.alerts.length, 0);
  const allConnected = enrichedData.every((d) => d.firewall?.status?.connected);

  const timeAgo = (iso: string | undefined | null) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3_600_000)}h ago`;
  };

  return (
    <div className="rounded-lg border border-[#005BC8]/20 dark:border-[#00EDFF]/20 bg-[#005BC8]/[0.03] dark:bg-[#00EDFF]/[0.03] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="h-6 w-6 rounded-lg bg-[#005BC8]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0">
          <Wifi className="h-3 w-3 text-[#005BC8] dark:text-[#00EDFF]" />
        </div>
        <span className="text-xs font-semibold text-foreground flex-1">
          Sophos Central Live Data
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${allConnected ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]" : "bg-[#EA0022]/10 text-[#EA0022]"}`}>
            {allConnected ? "All Online" : "Offline Detected"}
          </span>
          {totalAlerts > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[#F29400]/10 text-[#F29400]">
              {totalAlerts} Alert{totalAlerts !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); loadEnrichment(); }}
            className="p-0.5 hover:bg-muted/50 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {enrichedData.map((data) => (
            <div key={data.configLabel} className="rounded-xl border border-border/70 bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">{data.configLabel}</span>
                {data.firewall && (
                  <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    data.firewall.status?.connected
                      ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]"
                      : "bg-[#EA0022]/10 text-[#EA0022]"
                  }`}>
                    {data.firewall.status?.connected ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
                    {data.firewall.status?.connected ? "Online" : "Offline"}
                  </span>
                )}
              </div>

              {data.firewall && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded border border-border bg-muted/30 px-2.5 py-2">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block">Firmware</span>
                    <span className="text-xs font-mono font-medium text-foreground">{data.firewall.firmwareVersion || "—"}</span>
                  </div>
                  <div className="rounded border border-border bg-muted/30 px-2.5 py-2">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block">Model</span>
                    <span className="text-xs font-medium text-foreground truncate block">{data.firewall.model?.replace(/SFVUNL_SO01_|_SO01_/g, "") || "—"}</span>
                  </div>
                  <div className="rounded border border-border bg-muted/30 px-2.5 py-2">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block">Serial</span>
                    <span className="text-xs font-mono font-medium text-foreground">{data.firewall.serialNumber || "—"}</span>
                  </div>
                  <div className="rounded border border-border bg-muted/30 px-2.5 py-2">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block">HA</span>
                    <span className="text-xs font-medium text-foreground">
                      {data.firewall.cluster ? `${data.firewall.cluster.mode} (${data.firewall.cluster.status})` : "Standalone"}
                    </span>
                  </div>
                </div>
              )}

              {data.licences.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <Shield className="h-3 w-3 text-[#009CFB]" /> Licences ({data.licences.length})
                  </span>
                  <div className="grid gap-1.5">
                    {data.licences.map((lic, i) => {
                      const isExpired = !lic.perpetual && lic.daysRemaining <= 0;
                      const isExpiring = !lic.perpetual && lic.daysRemaining > 0 && lic.daysRemaining <= 90;
                      return (
                        <div key={`${lic.product}-${i}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-border bg-muted/20">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-medium text-foreground block truncate">{lic.product}</span>
                            <span className="text-[9px] text-muted-foreground">
                              {lic.perpetual ? "Perpetual" : lic.type}
                              {lic.endDate && !lic.perpetual && ` · Expires ${new Date(lic.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            lic.perpetual ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]" :
                            isExpired ? "bg-[#EA0022]/10 text-[#EA0022]" :
                            isExpiring ? "bg-[#F29400]/10 text-[#F29400]" :
                            "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]"
                          }`}>
                            {lic.perpetual ? "Active" : isExpired ? "EXPIRED" : `${lic.daysRemaining}d`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {data.alerts.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-[#F29400]" /> Active Alerts ({data.alerts.length})
                  </span>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {data.alerts.slice(0, 5).map((a) => (
                      <div key={a.id} className={`text-[10px] px-2 py-1 rounded border-l-2 ${
                        a.severity === "high" ? "border-l-[#EA0022] bg-[#EA0022]/5" :
                        a.severity === "medium" ? "border-l-[#F29400] bg-[#F29400]/5" :
                        "border-l-[#F8E300] bg-[#F8E300]/5"
                      }`}>
                        <span className="text-foreground font-medium">{a.description}</span>
                        <span className="text-muted-foreground ml-1.5">{a.category}</span>
                      </div>
                    ))}
                    {data.alerts.length > 5 && (
                      <p className="text-[9px] text-muted-foreground">+{data.alerts.length - 5} more alerts</p>
                    )}
                  </div>
                </div>
              )}

            </div>
          ))}

          <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              Data from Sophos Central · Last synced {timeAgo(status?.last_synced_at) || "unknown"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
