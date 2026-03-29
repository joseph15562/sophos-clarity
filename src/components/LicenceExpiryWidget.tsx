import { useState, useEffect, useMemo, useCallback } from "react";
import { Shield, Download, ChevronDown, RefreshCw, Server, Clock, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCentral } from "@/hooks/use-central";
import { filterSupersededFullGuardLicences } from "@/lib/sophos-licence";
import {
  getFirewallLicences,
  getFirewallDisplayName,
  type FirewallLicence,
  type FirewallSubscription,
} from "@/lib/sophos-central";

interface FlattenedLicence {
  serialNumber: string;
  model: string;
  modelType: "virtual" | "hardware";
  lastSeenAt?: string;
  subscription: FirewallSubscription;
  daysRemaining: number;
}

interface LicenceGroup {
  key: string;
  serials: string[];
  primarySerial: string;
  isHaPair: boolean;
  model: string;
  modelType: "virtual" | "hardware";
  items: FlattenedLicence[];
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
  const [expandedSerials, setExpandedSerials] = useState<Set<string>>(new Set());

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

  const [hasFetched, setHasFetched] = useState(false);
  const [fetchedWithTenants, setFetchedWithTenants] = useState(false);

  useEffect(() => {
    if (central.isConnected && !hasFetched && !loading) {
      setHasFetched(true);
      fetchLicences();
      central.loadCachedFirewalls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [central.isConnected, hasFetched, loading, fetchLicences, central.loadCachedFirewalls]);

  useEffect(() => {
    if (
      central.isConnected &&
      hasFetched &&
      !fetchedWithTenants &&
      central.tenants.length > 0 &&
      firewallLicences.length === 0 &&
      !loading
    ) {
      setFetchedWithTenants(true);
      fetchLicences();
    }
  }, [
    central.isConnected,
    hasFetched,
    fetchedWithTenants,
    central.tenants.length,
    firewallLicences.length,
    loading,
    fetchLicences,
  ]);

  const haPartnerMap = useMemo(() => {
    const serialToGroup = new Map<string, string>();

    // Method 1: Central firewalls cluster data (most reliable when available)
    const clusterSerials = new Map<string, string[]>();
    for (const fw of central.firewalls) {
      if (fw.cluster?.id) {
        const isAP =
          /active.passive/i.test(fw.cluster.mode ?? "") ||
          /a.p/i.test(fw.cluster.mode ?? "") ||
          fw.cluster.status === "primary" ||
          fw.cluster.status === "auxiliary";
        if (isAP) {
          const list = clusterSerials.get(fw.cluster.id) ?? [];
          list.push(fw.serialNumber);
          clusterSerials.set(fw.cluster.id, list);
        }
      }
    }
    for (const [clusterId, serials] of clusterSerials) {
      if (serials.length >= 2) {
        for (const s of serials) serialToGroup.set(s, `ha:${clusterId}`);
      }
    }

    // Method 2: Licence data heuristic — same model firewalls sharing product codes
    // In HA A-P the auxiliary receives copies of the primary's subscriptions,
    // so both devices will have overlapping product codes even if the
    // licenseIdentifier values differ.
    if (serialToGroup.size === 0 && firewallLicences.length >= 2) {
      const fwByModel = new Map<string, FirewallLicence[]>();
      for (const fw of firewallLicences) {
        const list = fwByModel.get(fw.model) ?? [];
        list.push(fw);
        fwByModel.set(fw.model, list);
      }
      for (const [, fws] of fwByModel) {
        if (fws.length < 2) continue;
        const matched = new Set<string>();
        for (let i = 0; i < fws.length; i++) {
          if (matched.has(fws[i].serialNumber)) continue;
          const aCodes = new Set(
            fws[i].licenses.map((l) => l.product?.code ?? l.product?.genericCode ?? ""),
          );
          for (let j = i + 1; j < fws.length; j++) {
            if (matched.has(fws[j].serialNumber)) continue;
            const overlap = fws[j].licenses.filter((l) =>
              aCodes.has(l.product?.code ?? l.product?.genericCode ?? ""),
            ).length;
            const smaller = Math.min(fws[i].licenses.length, fws[j].licenses.length);
            if (overlap >= 2 && overlap >= smaller * 0.5) {
              const groupId = `ha-lic:${fws[i].serialNumber}`;
              serialToGroup.set(fws[i].serialNumber, groupId);
              serialToGroup.set(fws[j].serialNumber, groupId);
              matched.add(fws[i].serialNumber);
              matched.add(fws[j].serialNumber);
            }
          }
        }
      }
    }

    return serialToGroup;
  }, [central.firewalls, firewallLicences]);

  const flattened = useMemo<FlattenedLicence[]>(() => {
    const items: FlattenedLicence[] = [];
    for (const fw of firewallLicences) {
      for (const sub of fw.licenses) {
        const days = sub.endDate
          ? Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86_400_000)
          : sub.perpetual
            ? 9999
            : 9999;
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

  const flattenedForDisplay = useMemo(
    () => filterSupersededFullGuardLicences(flattened),
    [flattened],
  );

  const filtered = useMemo(() => {
    let items = flattenedForDisplay;
    if (filterMode === "expired") items = items.filter((l) => l.daysRemaining <= 0);
    else if (filterMode === "expiring")
      items = items.filter((l) => l.daysRemaining > 0 && l.daysRemaining <= 90);
    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [flattenedForDisplay, filterMode]);

  const groupKey = useCallback(
    (serial: string) => {
      return haPartnerMap.get(serial) ?? serial;
    },
    [haPartnerMap],
  );

  const serialToDisplayName = useMemo(() => {
    const map = new Map<string, string>();
    for (const fw of central.firewalls) {
      const displayName = getFirewallDisplayName(fw);
      if (displayName && displayName !== fw.serialNumber) map.set(fw.serialNumber, displayName);
    }
    return map;
  }, [central.firewalls]);

  const buildGroups = useCallback(
    (items: FlattenedLicence[]): LicenceGroup[] => {
      const map = new Map<string, LicenceGroup>();
      for (const item of items) {
        const key = groupKey(item.serialNumber);
        const existing = map.get(key);
        if (existing) {
          existing.items.push(item);
          if (!existing.serials.includes(item.serialNumber)) {
            existing.serials.push(item.serialNumber);
          }
        } else {
          map.set(key, {
            key,
            serials: [item.serialNumber],
            primarySerial: item.serialNumber,
            isHaPair: key.startsWith("ha:") || key.startsWith("ha-lic:"),
            model: item.model,
            modelType: item.modelType,
            items: [item],
          });
        }
      }
      for (const group of map.values()) {
        if (!group.isHaPair || group.serials.length < 2) continue;
        const statsBySerial = new Map<string, { worst: number; activeCount: number }>();
        for (const serial of group.serials) {
          const serialItems = group.items.filter((i) => i.serialNumber === serial);
          const worst =
            serialItems.length > 0
              ? Math.min(...serialItems.map((i) => i.daysRemaining))
              : -Infinity;
          const activeCount = serialItems.filter((i) => i.daysRemaining > 0).length;
          statsBySerial.set(serial, { worst, activeCount });
        }
        let primary = group.serials[0];
        let bestStats = statsBySerial.get(primary)!;
        for (const [serial, stats] of statsBySerial) {
          if (
            stats.activeCount > bestStats.activeCount ||
            (stats.activeCount === bestStats.activeCount && stats.worst > bestStats.worst)
          ) {
            primary = serial;
            bestStats = stats;
          }
        }
        group.primarySerial = primary;
        group.items = group.items.filter((i) => i.serialNumber === primary);

        // HA A-P: show at most two appliance serials. Central can return many
        // firewall rows sharing one cluster id (duplicates/stale inventory); licence
        // lines still use the primary serial chosen above.
        const uniqueSerials = [...new Set(group.serials)];
        if (uniqueSerials.length > 2) {
          if (group.key.startsWith("ha:")) {
            const clusterId = group.key.slice(3);
            const bySerial = new Map<string, (typeof central.firewalls)[number]>();
            for (const fw of central.firewalls) {
              if (!fw.serialNumber || fw.cluster?.id !== clusterId) continue;
              if (!bySerial.has(fw.serialNumber)) bySerial.set(fw.serialNumber, fw);
            }
            const members = [...bySerial.values()];
            const norm = (s: string | undefined) => (s ?? "").toLowerCase();
            const primaryFw = members.find((fw) => {
              const x = norm(fw.cluster?.status);
              return x === "primary" || x === "active";
            });
            const auxFw = members.find((fw) => {
              const x = norm(fw.cluster?.status);
              return (
                x === "auxiliary" ||
                x === "standby" ||
                x.includes("auxiliary") ||
                x.includes("standby") ||
                x.includes("passive")
              );
            });
            if (primaryFw && auxFw && primaryFw.serialNumber !== auxFw.serialNumber) {
              group.serials = [primaryFw.serialNumber, auxFw.serialNumber];
            } else {
              const second = uniqueSerials.find((s) => s !== primary) ?? primary;
              group.serials = [primary, second];
            }
          } else {
            const second = uniqueSerials.find((s) => s !== primary) ?? primary;
            group.serials = [primary, second];
          }
        } else {
          group.serials = uniqueSerials;
        }
      }
      return Array.from(map.values());
    },
    [groupKey, central.firewalls],
  );

  const grouped = useMemo(() => {
    const groups = buildGroups(filtered);
    return groups.sort((a, b) => {
      const worstA = Math.min(...a.items.map((l) => l.daysRemaining));
      const worstB = Math.min(...b.items.map((l) => l.daysRemaining));
      return worstA - worstB;
    });
  }, [filtered, buildGroups]);

  const toggleGroup = (key: string) => {
    setExpandedSerials((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const firewallTotals = useMemo(() => {
    const groups = buildGroups(flattenedForDisplay);
    let expired = 0,
      expiringCritical = 0,
      expiringSoon = 0,
      expiringMedium = 0,
      healthy = 0;
    for (const group of groups) {
      const worst = Math.min(...group.items.map((l) => l.daysRemaining));
      if (worst <= 0) expired++;
      else if (worst <= 7) expiringCritical++;
      else if (worst <= 30) expiringSoon++;
      else if (worst <= 90) expiringMedium++;
      else healthy++;
    }
    return {
      total: groups.length,
      expired,
      expiringCritical,
      expiringSoon,
      expiringMedium,
      healthy,
    };
  }, [flattenedForDisplay, buildGroups]);

  const {
    total: fwTotal,
    expired,
    expiringCritical,
    expiringSoon,
    expiringMedium,
    healthy,
  } = firewallTotals;
  const showBanner = expired > 0 || expiringCritical > 0 || expiringSoon > 0;
  const bannerSeverity = expired > 0 || expiringCritical > 0 ? "red" : "amber";

  const handleExportCsv = useCallback(() => {
    const rows = [
      [
        "Serial Number",
        "Model",
        "Type",
        "Product",
        "Licence Type",
        "Start Date",
        "End Date",
        "Perpetual",
        "Days Remaining",
      ],
    ];
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
    <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] overflow-hidden">
      {showBanner && (
        <div
          className={`flex items-center justify-between gap-3 px-5 py-2.5 ${
            bannerSeverity === "red"
              ? "bg-[#EA0022]/[0.06] border-b border-[#EA0022]/15"
              : "bg-[#F29400]/[0.06] border-b border-[#F29400]/15"
          }`}
        >
          <span
            className={`text-xs font-semibold ${bannerSeverity === "red" ? "text-[#EA0022]" : "text-[#F29400]"}`}
          >
            {expired > 0 || expiringCritical > 0
              ? "Licence(s) expired or expiring within 7 days"
              : "Licence(s) expiring within 30 days"}
          </span>
          <a
            href="https://central.sophos.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-brand-accent hover:underline shrink-0"
          >
            Renew via Sophos Central →
          </a>
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-3.5 px-5 py-4 text-left transition-colors group ${expanded ? "bg-brand-accent/[0.04] dark:bg-brand-accent/[0.08]" : "hover:bg-brand-accent/[0.02] dark:hover:bg-brand-accent/[0.04]"}`}
      >
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#F29400] to-[#F8E300] flex items-center justify-center shrink-0">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <span className="text-[13px] font-display font-semibold tracking-tight text-foreground flex-1">
          Firewall Licence Monitor
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {fwTotal > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-brand-accent/[0.06] text-muted-foreground">
              {fwTotal} firewall{fwTotal !== 1 ? "s" : ""}
            </span>
          )}
          {expired > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-[#EA0022]/10 text-[#EA0022]">
              {expired} expired
            </span>
          )}
          {expiringCritical > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-[#EA0022]/10 text-[#EA0022]">
              {expiringCritical} &lt;7d
            </span>
          )}
          {expiringSoon > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-[#F29400]/10 text-[#F29400]">
              {expiringSoon} &lt;30d
            </span>
          )}
          {expiringMedium > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-[#F29400]/10 text-[#F29400]">
              {expiringMedium} &lt;90d
            </span>
          )}
          {healthy > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]">
              {healthy} ok
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-all duration-200 shrink-0 ${expanded ? "rotate-180 text-brand-accent" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-brand-accent/10 bg-background/40 dark:bg-background/20 px-5 py-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-2.5">
            <div
              className={`rounded-xl px-2.5 py-2.5 text-center cursor-pointer transition-all ${filterMode === "all" ? "bg-brand-accent/10 ring-1 ring-brand-accent/20 shadow-sm" : "bg-brand-accent/[0.04] hover:bg-brand-accent/[0.08]"}`}
              onClick={() => setFilterMode("all")}
            >
              <p className="text-sm font-bold text-foreground tabular-nums">{fwTotal}</p>
              <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
                Firewalls
              </p>
            </div>
            <div
              className={`rounded-xl px-2.5 py-2.5 text-center cursor-pointer transition-all ${filterMode === "expired" ? "bg-[#EA0022]/10 ring-1 ring-[#EA0022]/25 shadow-sm" : "bg-[#EA0022]/[0.04] hover:bg-[#EA0022]/[0.08]"}`}
              onClick={() => setFilterMode("expired")}
            >
              <p
                className={`text-sm font-bold tabular-nums ${expired > 0 ? "text-[#EA0022]" : "text-foreground"}`}
              >
                {expired}
              </p>
              <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
                Expired
              </p>
            </div>
            <div
              className={`rounded-xl px-2.5 py-2.5 text-center cursor-pointer transition-all ${filterMode === "expiring" ? "bg-[#F29400]/10 ring-1 ring-[#F29400]/25 shadow-sm" : "bg-[#F29400]/[0.04] hover:bg-[#F29400]/[0.08]"}`}
              onClick={() => setFilterMode("expiring")}
            >
              <p
                className={`text-sm font-bold tabular-nums ${expiringCritical + expiringSoon + expiringMedium > 0 ? "text-[#F29400]" : "text-foreground"}`}
              >
                {expiringCritical + expiringSoon + expiringMedium}
              </p>
              <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
                &lt;90 Days
              </p>
            </div>
            <div className="rounded-xl px-2.5 py-2.5 text-center bg-[#00F2B3]/[0.06]">
              <p className="text-sm font-bold text-[#007A5A] dark:text-[#00F2B3] tabular-nums">
                {healthy}
              </p>
              <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
                Healthy
              </p>
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
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLicences}
                className="gap-1 text-[10px] h-7"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </Button>
            </div>
          ) : filtered.length > 0 || flattenedForDisplay.length > 0 ? (
            <>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {grouped.map((group) => {
                  const isOpen = expandedSerials.has(group.key);
                  const worstDays = Math.min(...group.items.map((l) => l.daysRemaining));
                  const hasExpired = group.items.some((l) => l.daysRemaining <= 0);
                  const hasExpiring = group.items.some(
                    (l) => l.daysRemaining > 0 && l.daysRemaining <= 90,
                  );
                  const statusColor = hasExpired
                    ? "text-[#EA0022]"
                    : hasExpiring
                      ? "text-[#F29400]"
                      : "text-[#007A5A] dark:text-[#00F2B3]";
                  const statusLabel = hasExpired
                    ? "EXPIRED"
                    : worstDays <= 90
                      ? `${worstDays}d`
                      : "OK";
                  const ringColor = hasExpired
                    ? "border-[#EA0022]/30"
                    : hasExpiring
                      ? "border-[#F29400]/30"
                      : "border-border";
                  const dedupedItems = group.items;

                  return (
                    <div
                      key={group.key}
                      className={`rounded-xl border ${ringColor} bg-background/60 dark:bg-background/30 overflow-hidden`}
                    >
                      <button
                        onClick={() => toggleGroup(group.key)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-brand-accent/[0.03] dark:hover:bg-brand-accent/[0.06] transition-colors"
                      >
                        <Server
                          className={`h-3.5 w-3.5 shrink-0 ${group.modelType === "virtual" ? "text-[#009CFB]" : "text-muted-foreground"}`}
                        />
                        <div className="flex-1 min-w-0">
                          {(() => {
                            const names = group.serials
                              .map((s) => serialToDisplayName.get(s))
                              .filter(Boolean) as string[];
                            const displayName =
                              names.length > 0
                                ? group.isHaPair
                                  ? names.join(" / ")
                                  : names[0]
                                : null;
                            return (
                              <>
                                {displayName && (
                                  <div
                                    className="text-[10px] font-semibold text-foreground truncate"
                                    title={displayName}
                                  >
                                    {displayName}
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold text-foreground">
                                    {group.model}
                                  </span>
                                  {group.isHaPair ? (
                                    <span
                                      className="inline-flex items-center gap-1 text-[9px] font-mono text-muted-foreground"
                                      title={group.serials.join(" / ")}
                                    >
                                      <Link2 className="h-2.5 w-2.5 text-[#009CFB]" />
                                      {group.serials.map((s) => s.slice(-8)).join(" / ")}
                                    </span>
                                  ) : (
                                    <span
                                      className="text-[9px] font-mono text-muted-foreground"
                                      title={group.serials[0]}
                                    >
                                      {group.serials[0].slice(-8)}
                                    </span>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-muted-foreground">
                              {dedupedItems.length} licence{dedupedItems.length !== 1 ? "s" : ""}
                            </span>
                            {group.isHaPair && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-[#009CFB]/10 text-[#009CFB] font-semibold">
                                HA A-P
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold ${statusColor}`}>
                          {statusLabel}
                        </span>
                        <ChevronDown
                          className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isOpen && (
                        <div className="border-t border-brand-accent/10">
                          <div className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-3.5 py-1.5 bg-brand-accent/[0.03] dark:bg-brand-accent/[0.06] text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                            <span>Product</span>
                            <span>Type</span>
                            <span>Expiry</span>
                            <span className="text-right">Status</span>
                          </div>
                          <div className="divide-y divide-brand-accent/[0.06]">
                            {dedupedItems.map((item, idx) => (
                              <div
                                key={`${item.subscription.id}-${idx}`}
                                className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-3.5 py-1.5 items-center hover:bg-brand-accent/[0.02] dark:hover:bg-brand-accent/[0.04] transition-colors"
                              >
                                <span className="text-[10px] font-medium text-foreground truncate">
                                  {item.subscription.product?.name ||
                                    item.subscription.product?.code ||
                                    "Unknown"}
                                </span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium truncate text-center ${
                                    item.subscription.type === "trial"
                                      ? "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]"
                                      : item.subscription.perpetual
                                        ? "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]"
                                        : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {item.subscription.perpetual
                                    ? "Perpetual"
                                    : item.subscription.type}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {item.subscription.perpetual
                                    ? "Never"
                                    : item.subscription.endDate
                                      ? new Date(item.subscription.endDate).toLocaleDateString(
                                          "en-GB",
                                          { day: "numeric", month: "short", year: "2-digit" },
                                        )
                                      : "—"}
                                </span>
                                <span
                                  className={`text-[10px] font-bold text-right ${
                                    item.subscription.perpetual
                                      ? "text-[#007A5A] dark:text-[#00F2B3]"
                                      : item.daysRemaining <= 0
                                        ? "text-[#EA0022]"
                                        : item.daysRemaining <= 30
                                          ? "text-[#EA0022]"
                                          : item.daysRemaining <= 90
                                            ? "text-[#F29400]"
                                            : "text-[#007A5A] dark:text-[#00F2B3]"
                                  }`}
                                >
                                  {item.subscription.perpetual
                                    ? "OK"
                                    : item.daysRemaining <= 0
                                      ? "EXPIRED"
                                      : `${item.daysRemaining}d`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Last seen info */}
              {firewallLicences.some((fw) => fw.lastSeenAt) && (
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last check-in:{" "}
                  {(() => {
                    const latest = firewallLicences
                      .filter((fw) => fw.lastSeenAt)
                      .sort(
                        (a, b) =>
                          new Date(b.lastSeenAt!).getTime() - new Date(a.lastSeenAt!).getTime(),
                      )[0];
                    return latest?.lastSeenAt
                      ? new Date(latest.lastSeenAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "unknown";
                  })()}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchLicences}
                  disabled={loading}
                  className="gap-1 text-[10px] h-7"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  className="gap-1 text-[10px] h-7"
                >
                  <Download className="h-3 w-3" /> Export CSV
                </Button>
              </div>

              {/* API reference note */}
              <p className="text-[8px] text-muted-foreground text-center">
                Data from Sophos Central Licensing API (/licenses/v1/licenses/firewalls)
              </p>
            </>
          ) : (
            <div className="text-center py-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                {flattened.length === 0
                  ? "No firewall licence data available. Ensure your API credentials have licensing scope."
                  : "No licences match this filter."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setHasFetched(false);
                }}
                disabled={loading}
                className="gap-1 text-[10px] h-7"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Retry
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
