import { useState, useEffect, useCallback } from "react";
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  Server,
  RefreshCw,
  ChevronDown,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getCentralStatus,
  getCachedFirewalls,
  getAlerts,
  getFirewallLicences,
  type CentralStatus,
  type CentralAlert,
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

export function CentralEnrichment({
  configMetas,
  customerName: _customerName,
}: CentralEnrichmentProps) {
  const { org, isGuest } = useAuth();
  const orgId = org?.id ?? "";

  const [status, setStatus] = useState<CentralStatus | null>(null);
  const [enrichedData, setEnrichedData] = useState<LinkedFirewallData[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [loadAttempted, setLoadAttempted] = useState(false);

  useEffect(() => {
    if (!orgId || isGuest) return;
    getCentralStatus(orgId)
      .then(setStatus)
      .catch(() => setStatus(null));
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
      setEnrichedData(
        configMetas.map((c) => ({
          configLabel: c.label ?? c.configHash,
          firewall: null,
          alerts: [],
          licences: [],
        })),
      );
      setLoading(false);
      setLoadAttempted(true);
      return;
    }

    const cachedFws = await getCachedFirewalls(orgId);
    const tenantIds = [...new Set(links.map((l) => l.central_tenant_id))];

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
              : l.perpetual
                ? 9999
                : 9999,
          }));
        }
      } catch (err) {
        console.warn("[loadEnrichment] licensing API may not be available for tenant", err);
      }
    }

    const results: LinkedFirewallData[] = [];
    const linkedHashes = new Set(links.map((l) => l.config_hash));

    for (const tenantId of tenantIds) {
      const tenantLinks = links.filter((l) => l.central_tenant_id === tenantId);

      let alerts: CentralAlert[] = [];
      try {
        alerts = await getAlerts(orgId, tenantId);
      } catch (err) {
        console.warn("[loadEnrichment] getAlerts", err);
      }

      for (const link of tenantLinks) {
        const config = configMetas.find((c) => c.configHash === link.config_hash);
        const cached = cachedFws.find((f) => f.firewallId === link.central_firewall_id);
        const fw: FirewallInfo | null = cached
          ? {
              firewallId: cached.firewallId,
              hostname: cached.hostname,
              serialNumber: cached.serialNumber,
              firmwareVersion: cached.firmwareVersion,
              model: cached.model,
              status: cached.status as FirewallInfo["status"],
              cluster: cached.cluster as FirewallInfo["cluster"],
            }
          : null;

        results.push({
          configLabel: config?.label ?? link.config_hash,
          firewall: fw,
          alerts: alerts.filter((a) => a.managedAgent?.id === link.central_firewall_id),
          licences: fw?.serialNumber ? (licencesBySerial[fw.serialNumber] ?? []) : [],
        });
      }
    }

    for (const config of configMetas) {
      if (!linkedHashes.has(config.configHash)) {
        results.push({
          configLabel: config.label ?? config.configHash,
          firewall: null,
          alerts: [],
          licences: [],
        });
      }
    }

    setEnrichedData(results);
    setLoading(false);
    setLoadAttempted(true);
  }, [status?.connected, orgId, configMetas]);

  useEffect(() => {
    if (status?.connected && !loadAttempted) loadEnrichment();
  }, [status?.connected, loadAttempted, loadEnrichment]);

  if (!status?.connected || isGuest) return null;
  if (enrichedData.length === 0) return null;

  const totalAlerts = enrichedData.reduce((s, d) => s + d.alerts.length, 0);
  const linkedData = enrichedData.filter((d) => d.firewall !== null);
  const unlinkedCount = enrichedData.length - linkedData.length;
  const allConnected =
    linkedData.length > 0 && linkedData.every((d) => d.firewall?.status?.connected);

  const timeAgo = (iso: string | undefined | null) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3_600_000)}h ago`;
  };

  const CYAN = "#00EDFF";
  const statusHex = allConnected ? "#00F2B3" : "#EA0022";

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] transition-all duration-200 hover:border-slate-900/[0.14] dark:hover:border-white/[0.10] hover:shadow-[0_8px_40px_rgba(0,237,255,0.10)]"
      style={{
        background: "linear-gradient(145deg, rgba(0,237,255,0.06), rgba(0,91,200,0.025))",
        boxShadow: "0 12px 40px rgba(0,237,255,0.04), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Corner glow */}
      <div
        className="absolute -top-10 -right-10 h-28 w-28 rounded-full blur-[50px] opacity-20 transition-opacity duration-300 group-hover:opacity-35 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${CYAN} 0%, transparent 70%)` }}
      />
      {/* Top shimmer */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${CYAN}40, rgba(0,91,200,0.25), transparent)`,
        }}
      />

      {/* Header bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-950/[0.03] dark:hover:bg-white/[0.02] transition-colors"
      >
        <div
          className="h-8 w-8 rounded-xl flex items-center justify-center border border-slate-900/[0.12] dark:border-white/[0.08] shrink-0"
          style={{ background: `linear-gradient(135deg, ${CYAN}20, rgba(0,91,200,0.12))` }}
        >
          <Wifi
            className="h-3.5 w-3.5"
            style={{ color: CYAN, filter: `drop-shadow(0 0 4px ${CYAN}60)` }}
          />
        </div>
        <span className="text-xs font-display font-black text-foreground uppercase tracking-wider flex-1">
          Sophos Central Live Data
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {linkedData.length > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-md font-black border"
              style={{
                color: statusHex,
                backgroundColor: `${statusHex}12`,
                borderColor: `${statusHex}22`,
              }}
            >
              {allConnected
                ? linkedData.length === enrichedData.length
                  ? "All Online"
                  : `${linkedData.length} Online`
                : "Offline Detected"}
            </span>
          )}
          {unlinkedCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-white/75 dark:bg-white/[0.04] text-muted-foreground border border-slate-900/[0.12] dark:border-white/[0.08]">
              {unlinkedCount} Not Linked
            </span>
          )}
          {totalAlerts > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-md font-black border"
              style={{
                color: "#F29400",
                backgroundColor: "rgba(242,148,0,0.10)",
                borderColor: "rgba(242,148,0,0.20)",
              }}
            >
              {totalAlerts} Alert{totalAlerts !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              loadEnrichment();
            }}
            className="group/ref p-1.5 rounded-lg border border-slate-900/[0.10] dark:border-white/[0.06] hover:border-slate-900/[0.18] dark:hover:border-white/[0.14] transition-all"
            style={{ background: "linear-gradient(145deg, rgba(0,237,255,0.04), transparent)" }}
            title="Refresh"
          >
            <RefreshCw
              className={`h-3 w-3 transition-colors ${loading ? "animate-spin text-[#00EDFF]" : "text-muted-foreground group-hover/ref:text-[#00EDFF]"}`}
            />
          </button>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-900/[0.10] dark:border-white/[0.06] px-5 py-4 space-y-3">
          {enrichedData.map((data) => {
            const isOnline = data.firewall?.status?.connected;
            const cardHex = data.firewall ? (isOnline ? "#00F2B3" : "#EA0022") : "#888888";

            return (
              <div
                key={data.configLabel}
                className="group/card relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-4 space-y-3 transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
                style={{ background: `linear-gradient(145deg, ${cardHex}08, ${cardHex}02)` }}
              >
                {/* Card glow */}
                <div
                  className="absolute -top-6 -right-6 h-16 w-16 rounded-full blur-[24px] opacity-0 transition-opacity duration-300 group-hover/card:opacity-20 pointer-events-none"
                  style={{ backgroundColor: cardHex }}
                />
                <div
                  className="absolute inset-x-0 top-0 h-px pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${cardHex}25, transparent)`,
                  }}
                />

                {/* Firewall header */}
                <div className="relative flex items-center gap-2.5">
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center border border-slate-900/[0.12] dark:border-white/[0.08]"
                    style={{ background: `linear-gradient(135deg, ${cardHex}18, ${cardHex}08)` }}
                  >
                    <Server className="h-3.5 w-3.5" style={{ color: cardHex }} />
                  </div>
                  <span className="text-xs font-display font-bold text-foreground">
                    {data.configLabel}
                  </span>
                  {data.firewall ? (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold border"
                      style={{
                        color: cardHex,
                        backgroundColor: `${cardHex}12`,
                        borderColor: `${cardHex}22`,
                      }}
                    >
                      {isOnline ? (
                        <Wifi className="h-2.5 w-2.5" />
                      ) : (
                        <WifiOff className="h-2.5 w-2.5" />
                      )}
                      {isOnline ? "Online" : "Offline"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-white/75 dark:bg-white/[0.04] text-muted-foreground border border-slate-900/[0.12] dark:border-white/[0.08]">
                      <WifiOff className="h-2.5 w-2.5" />
                      Not linked
                    </span>
                  )}
                </div>

                {/* Info grid */}
                {data.firewall ? (
                  <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        ["Firmware", data.firewall.firmwareVersion || "—", true],
                        [
                          "Model",
                          data.firewall.model?.replace(/SFVUNL_SO01_|_SO01_/g, "") || "—",
                          false,
                        ],
                        ["Serial", data.firewall.serialNumber || "—", true],
                        [
                          "HA",
                          data.firewall.cluster
                            ? `${data.firewall.cluster.mode} (${data.firewall.cluster.status})`
                            : "Standalone",
                          false,
                        ],
                      ] as [string, string, boolean][]
                    ).map(([label, value, mono]) => (
                      <div
                        key={label}
                        className="relative overflow-hidden rounded-lg border border-slate-900/[0.10] dark:border-white/[0.06] px-3 py-2.5 transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
                        style={{ background: `linear-gradient(145deg, ${CYAN}06, ${CYAN}02)` }}
                      >
                        <div
                          className="absolute inset-x-0 top-0 h-px pointer-events-none"
                          style={{
                            background: `linear-gradient(90deg, transparent, ${CYAN}15, transparent)`,
                          }}
                        />
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-bold block">
                          {label}
                        </span>
                        <span
                          className={`text-xs font-bold text-foreground ${mono ? "font-mono" : ""} truncate block mt-0.5`}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="relative overflow-hidden rounded-xl border border-dashed border-slate-900/[0.12] dark:border-white/[0.08] px-4 py-3 flex items-center gap-3"
                    style={{
                      background: "linear-gradient(145deg, rgba(255,255,255,0.02), transparent)",
                    }}
                  >
                    <WifiOff className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                    <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                      This firewall is not linked to Sophos Central. Link it via the Management
                      panel to see live status, licences, and alerts.
                    </p>
                  </div>
                )}

                {/* Licences */}
                {data.licences.length > 0 && (
                  <div className="space-y-2">
                    <span
                      className="text-[9px] uppercase tracking-wider font-bold flex items-center gap-1.5"
                      style={{ color: "#009CFB" }}
                    >
                      <Shield
                        className="h-3 w-3"
                        style={{ filter: "drop-shadow(0 0 3px rgba(0,156,251,0.4))" }}
                      />
                      Licences ({data.licences.length})
                    </span>
                    <div className="grid gap-1.5">
                      {data.licences.map((lic, i) => {
                        const isExpired = !lic.perpetual && lic.daysRemaining <= 0;
                        const isExpiring =
                          !lic.perpetual && lic.daysRemaining > 0 && lic.daysRemaining <= 90;
                        const licHex = lic.perpetual
                          ? "#00F2B3"
                          : isExpired
                            ? "#EA0022"
                            : isExpiring
                              ? "#F29400"
                              : "#00F2B3";
                        return (
                          <div
                            key={`${lic.product}-${i}`}
                            className="relative overflow-hidden flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-900/[0.10] dark:border-white/[0.06] transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
                            style={{
                              background: `linear-gradient(145deg, ${licHex}06, ${licHex}02)`,
                            }}
                          >
                            <div
                              className="absolute inset-x-0 top-0 h-px pointer-events-none"
                              style={{
                                background: `linear-gradient(90deg, transparent, ${licHex}18, transparent)`,
                              }}
                            />
                            <div className="relative flex-1 min-w-0">
                              <span className="text-[11px] font-bold text-foreground block truncate">
                                {lic.product}
                              </span>
                              <span className="text-[9px] text-muted-foreground/60">
                                {lic.perpetual ? "Perpetual" : lic.type}
                                {lic.endDate &&
                                  !lic.perpetual &&
                                  ` · Expires ${new Date(lic.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                              </span>
                            </div>
                            <span
                              className="relative text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 border"
                              style={{
                                color: licHex,
                                backgroundColor: `${licHex}12`,
                                borderColor: `${licHex}22`,
                              }}
                            >
                              {lic.perpetual
                                ? "Active"
                                : isExpired
                                  ? "EXPIRED"
                                  : `${lic.daysRemaining}d`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Alerts */}
                {data.alerts.length > 0 && (
                  <div className="space-y-2">
                    <span
                      className="text-[9px] uppercase tracking-wider font-bold flex items-center gap-1.5"
                      style={{ color: "#F29400" }}
                    >
                      <AlertTriangle
                        className="h-3 w-3"
                        style={{ filter: "drop-shadow(0 0 3px rgba(242,148,0,0.4))" }}
                      />
                      Active Alerts ({data.alerts.length})
                    </span>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
                      {data.alerts.slice(0, 5).map((a) => {
                        const alertHex =
                          a.severity === "high"
                            ? "#EA0022"
                            : a.severity === "medium"
                              ? "#F29400"
                              : "#ca8a04";
                        return (
                          <div
                            key={a.id}
                            className="relative overflow-hidden text-[10px] px-3 py-1.5 rounded-lg border-l-[3px] border border-slate-900/[0.08] dark:border-white/[0.04] transition-all duration-200 hover:border-slate-900/[0.12] dark:hover:border-white/[0.08]"
                            style={{
                              borderLeftColor: alertHex,
                              background: `linear-gradient(135deg, ${alertHex}08, ${alertHex}02)`,
                            }}
                          >
                            <span className="text-foreground font-bold">{a.description}</span>
                            <span className="text-muted-foreground/50 ml-1.5 font-medium">
                              {a.category}
                            </span>
                          </div>
                        );
                      })}
                      {data.alerts.length > 5 && (
                        <p className="text-[9px] text-muted-foreground/50 font-medium pl-1">
                          +{data.alerts.length - 5} more alerts
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Footer */}
          <div
            className="relative overflow-hidden rounded-lg border border-slate-900/[0.08] dark:border-white/[0.04] px-3 py-2 flex items-center justify-between"
            style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.015), transparent)" }}
          >
            <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50 font-medium">
              <Clock className="h-2.5 w-2.5" style={{ color: CYAN, opacity: 0.5 }} />
              Data from Sophos Central · Last synced {timeAgo(status?.last_synced_at) || "unknown"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
