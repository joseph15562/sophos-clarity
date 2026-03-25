import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Link2,
  Unlink,
  Search,
  Server,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useCentral } from "@/hooks/use-central";
import {
  getFirewallDisplayName,
  getEffectiveTenantDisplayName,
  type CentralFirewall,
} from "@/lib/sophos-central";
import type { AnalysisResult } from "@/lib/analyse-config";
import { supabase } from "@/integrations/supabase/client";

interface FirewallLinkerProps {
  configs: Array<{
    label: string;
    hostname?: string;
    serialNumber?: string;
    configHash: string;
    fromUpload?: boolean;
  }>;
  customerName: string;
  analysisResults: Record<string, AnalysisResult>;
  onLink?: () => void;
}

interface LinkState {
  firewallId: string;
  tenantId: string;
  firewall?: CentralFirewall;
  method: "auto" | "serial" | "manual";
}

export function FirewallLinker({
  configs,
  customerName,
  analysisResults: _analysisResults,
  onLink,
}: FirewallLinkerProps) {
  const { org, isGuest } = useAuth();
  const central = useCentral();

  const [links, setLinks] = useState<Record<string, LinkState>>({});
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);
  const [serialInput, setSerialInput] = useState<Record<string, string>>({});
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);

  const orgId = org?.id ?? "";

  const matchedTenant = useMemo(() => {
    if (!central.isConnected) return null;
    if (central.status?.partner_type === "tenant") {
      // For single-tenant accounts, use cached tenant or fall back to status partner_id. Use customerName when API returns "(This tenant)".
      const single =
        central.tenants[0] ??
        (central.status?.partner_id
          ? {
              id: central.status.partner_id,
              name: "(This tenant)",
              dataRegion: "",
              apiHost: "",
              billingType: "",
            }
          : null);
      if (single && customerName?.trim()) {
        return {
          ...single,
          name: getEffectiveTenantDisplayName(single, customerName) || single.name,
        };
      }
      return single;
    }
    if (!customerName) return null;
    return central.tenants.find((t) => t.name.toLowerCase() === customerName.toLowerCase()) ?? null;
  }, [
    central.isConnected,
    central.tenants,
    customerName,
    central.status?.partner_type,
    central.status?.partner_id,
  ]);

  useEffect(() => {
    if (matchedTenant && central.firewalls.length === 0) {
      central.refreshFirewalls(matchedTenant.id);
      central.refreshGroups(matchedTenant.id);
    }
  }, [matchedTenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load persisted links on mount
  useEffect(() => {
    if (!orgId) return;
    const load = async () => {
      const hashes = configs.map((c) => c.configHash);
      const { data } = await supabase
        .from("firewall_config_links")
        .select("config_hash, central_firewall_id, central_tenant_id")
        .eq("org_id", orgId)
        .in("config_hash", hashes);
      if (data) {
        const loaded: Record<string, LinkState> = {};
        for (const row of data) {
          const fw = central.firewalls.find((f) => f.id === row.central_firewall_id);
          loaded[row.config_hash] = {
            firewallId: row.central_firewall_id,
            tenantId: row.central_tenant_id,
            firewall: fw,
            method: "manual",
          };
        }
        setLinks((prev) => ({ ...prev, ...loaded }));
      }
    };
    load();
  }, [orgId, configs, central.firewalls]);

  // Auto-match by serial number then hostname (skip configs from manual upload — do not link to a different Central firewall)
  useEffect(() => {
    if (central.firewalls.length === 0 || !matchedTenant) return;
    setLinks((prev) => {
      const next = { ...prev };
      for (const config of configs) {
        if (config.fromUpload || next[config.configHash]) continue;
        let match: CentralFirewall | undefined;
        if (config.serialNumber) {
          match = central.firewalls.find(
            (fw) => fw.serialNumber?.toLowerCase() === config.serialNumber!.toLowerCase(),
          );
        }
        if (!match && config.hostname) {
          match = central.firewalls.find(
            (fw) => fw.hostname?.toLowerCase() === config.hostname?.toLowerCase(),
          );
        }
        if (match) {
          next[config.configHash] = {
            firewallId: match.id,
            tenantId: matchedTenant.id,
            firewall: match,
            method: "auto",
          };
        }
      }
      return next;
    });
  }, [central.firewalls, matchedTenant, configs]);

  const handleLink = useCallback(
    async (configHash: string, fw: CentralFirewall, method: "serial" | "manual") => {
      if (!matchedTenant || !orgId) return;
      const hostname = configs.find((c) => c.configHash === configHash)?.hostname ?? "";
      setLinks((prev) => ({
        ...prev,
        [configHash]: { firewallId: fw.id, tenantId: matchedTenant.id, firewall: fw, method },
      }));
      await supabase.from("firewall_config_links").upsert(
        {
          org_id: orgId,
          config_hash: configHash,
          config_hostname: hostname,
          central_firewall_id: fw.id,
          central_tenant_id: matchedTenant.id,
        },
        { onConflict: "org_id,config_hash" },
      );
      onLink?.();
    },
    [matchedTenant, orgId, configs, onLink],
  );

  const handleUnlink = useCallback(
    async (configHash: string) => {
      setLinks((prev) => {
        const next = { ...prev };
        delete next[configHash];
        return next;
      });
      if (orgId) {
        await supabase
          .from("firewall_config_links")
          .delete()
          .eq("org_id", orgId)
          .eq("config_hash", configHash);
      }
    },
    [orgId],
  );

  const handleSerialSearch = useCallback(
    (configHash: string) => {
      const serial = serialInput[configHash]?.trim();
      if (!serial) return;
      const fw = central.firewalls.find(
        (f) => f.serialNumber.toLowerCase() === serial.toLowerCase(),
      );
      if (fw) {
        handleLink(configHash, fw, "serial");
        setSerialInput((prev) => ({ ...prev, [configHash]: "" }));
      }
    },
    [serialInput, central.firewalls, handleLink],
  );

  const handleRefreshFirewalls = useCallback(async () => {
    setSyncing(true);
    let tenant = matchedTenant;
    // For tenant accounts, sync tenants first if we don't have one yet
    if (!tenant) {
      await central.refreshTenants();
      tenant = central.tenants[0] ?? null;
    }
    if (tenant) {
      await central.refreshFirewalls(tenant.id);
      await central.refreshGroups(tenant.id);
    }
    setSyncing(false);
  }, [matchedTenant, central]);

  // Group HA pairs by hostname so they appear as a single entry
  interface FirewallEntry {
    primary: CentralFirewall;
    peers: CentralFirewall[];
    isHA: boolean;
  }

  const filteredFirewalls = useMemo((): FirewallEntry[] => {
    let fws = central.firewalls;
    if (filterGroup === "ungrouped") fws = fws.filter((fw) => !fw.group?.id);
    else if (filterGroup !== "all") fws = fws.filter((fw) => fw.group?.id === filterGroup);

    const byHostname = new Map<string, CentralFirewall[]>();
    for (const fw of fws) {
      const key = (fw.hostname || fw.id).toLowerCase();
      if (!byHostname.has(key)) byHostname.set(key, []);
      byHostname.get(key)!.push(fw);
    }

    return Array.from(byHostname.values()).map((group) => {
      const primary = group.find((f) => f.cluster?.status === "primary") ?? group[0];
      const peers = group.filter((f) => f.id !== primary.id);
      return { primary, peers, isHA: group.length > 1 || !!primary.cluster };
    });
  }, [central.firewalls, filterGroup]);

  if (!central.isConnected || isGuest) return null;
  if (!matchedTenant && central.status?.partner_type !== "tenant") return null;
  if (configs.length === 0) return null;

  const linkedCount = Object.keys(links).length;
  const allLinked = linkedCount === configs.length;

  return (
    <Card className="overflow-hidden rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.08),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.99),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.08),transparent_28%),linear-gradient(135deg,rgba(8,13,26,0.98),rgba(12,18,34,0.98))] shadow-[0_18px_55px_rgba(32,6,247,0.08)]">
      <div className="h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />
      <CardContent className="pt-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
                Live enrichment
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link2 className="h-4 w-4 text-brand-accent" />
                <h3 className="text-lg font-display font-black text-foreground tracking-tight">
                  Link to Sophos Central
                </h3>
                {matchedTenant && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent font-medium">
                    {matchedTenant.name}
                  </span>
                )}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    allLinked
                      ? "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {linkedCount}/{configs.length} linked
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Match uploaded configs to live Sophos Central firewalls to enrich reports with
                current device context, firmware visibility, and managed-estate accuracy.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {central.groups.length > 0 && (
                <Select value={filterGroup} onValueChange={setFilterGroup}>
                  <SelectTrigger className="h-8 min-w-[140px] text-[10px] bg-background/80">
                    <SelectValue placeholder="All groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All groups</SelectItem>
                    {central.groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="ungrouped">Ungrouped</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshFirewalls}
                disabled={syncing}
                className="gap-1 text-[10px] h-8 bg-background/70"
              >
                <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                Sync Central
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="info-pill">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                Why link
              </p>
              <p className="text-sm font-semibold text-foreground mt-1">
                Tie exports to live managed firewalls
              </p>
            </div>
            <div className="info-pill">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                What it adds
              </p>
              <p className="text-sm font-semibold text-foreground mt-1">
                Current device context, tenancy, and estate metadata
              </p>
            </div>
            <div className="info-pill">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                Best for
              </p>
              <p className="text-sm font-semibold text-foreground mt-1">
                MSP workflows and customer-ready reporting
              </p>
            </div>
          </div>

          {central.firewalls.length === 0 && !syncing && (
            <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-4 text-center">
              <p className="text-xs text-muted-foreground">
                No firewalls found for this tenant. Click{" "}
                <span className="font-medium text-foreground">Sync Central</span> to pull the latest
                estate inventory from Sophos Central.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {configs.map((config) => {
              const link = links[config.configHash];
              const isExpanded = expandedConfig === config.configHash;

              return (
                <div
                  key={config.configHash}
                  className={`rounded-2xl border ${link ? "border-[#008F69]/30 dark:border-[#00F2B3]/20 dark:border-[#008F69]/30 dark:border-[#00F2B3]/20 bg-[#00F2B3]/[0.03]" : "border-border bg-card/70"} overflow-hidden shadow-sm`}
                >
                  {/* Config Header Row */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <Server className="h-4 w-4 text-brand-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-display font-bold tracking-tight text-foreground truncate block">
                        {config.label}
                      </span>
                      <span className="text-[11px] font-medium text-foreground/70 dark:text-white/60 font-mono">
                        {[config.hostname, config.serialNumber && `S/N: ${config.serialNumber}`]
                          .filter(Boolean)
                          .join(" · ") || null}
                      </span>
                    </div>

                    {link ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#007A5A] dark:text-[#00F2B3]" />
                          <div className="text-right">
                            <span className="text-[10px] font-medium text-foreground block">
                              {link.firewall
                                ? getFirewallDisplayName(link.firewall)
                                : link.firewallId}
                            </span>
                            <span className="text-[9px] text-muted-foreground block">
                              {link.firewall?.serialNumber && (
                                <span className="font-mono">{link.firewall.serialNumber} · </span>
                              )}
                              {link.firewall?.firmwareVersion}
                              {link.method === "auto" && " · auto-matched"}
                            </span>
                          </div>
                          <span
                            className={`inline-block w-2 h-2 rounded-full shrink-0 ${link.firewall?.status?.connected ? "bg-[#00F2B3]" : "bg-[#EA0022]"}`}
                          />
                        </div>
                        <button
                          onClick={() => handleUnlink(config.configHash)}
                          className="text-[10px] text-muted-foreground hover:text-[#EA0022] transition-colors p-1"
                          title="Unlink"
                        >
                          <Unlink className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setExpandedConfig(isExpanded ? null : config.configHash)}
                        className="flex items-center gap-1 rounded-md border border-brand-accent/30 dark:border-[#00EDFF]/30 bg-brand-accent/[0.06] dark:bg-[#00EDFF]/[0.08] px-2 py-1 text-[11px] font-semibold tracking-tight text-brand-accent hover:bg-brand-accent/10 dark:hover:bg-[#00EDFF]/12 transition-colors shrink-0"
                      >
                        <Link2 className="h-3 w-3" />
                        Link firewall
                        <ChevronDown
                          className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Expanded Link Panel */}
                  {isExpanded && !link && (
                    <div className="border-t border-border bg-muted/20 px-3 py-3 space-y-3">
                      {/* Serial search */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Paste serial number (from appliance or Central)"
                          value={serialInput[config.configHash] ?? ""}
                          onChange={(e) =>
                            setSerialInput((p) => ({ ...p, [config.configHash]: e.target.value }))
                          }
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleSerialSearch(config.configHash)
                          }
                          className="text-sm font-mono placeholder:text-foreground/55 dark:placeholder:text-white/45 flex-1 h-9"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSerialSearch(config.configHash)}
                          className="h-9 gap-1 text-sm font-semibold border-brand-accent/25 dark:border-[#00EDFF]/30 hover:bg-brand-accent/10 dark:hover:bg-[#00EDFF]/10"
                        >
                          <Search className="h-3 w-3" /> Match
                        </Button>
                      </div>

                      {serialInput[config.configHash]?.trim() &&
                        !central.firewalls.find(
                          (f) =>
                            f.serialNumber.toLowerCase() ===
                            serialInput[config.configHash]?.trim().toLowerCase(),
                        ) && (
                          <p className="text-[10px] text-[#F29400] flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> No firewall found with that serial
                            number
                          </p>
                        )}

                      {/* Firewall dropdown */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
                          Or select from Central
                        </span>
                        <div className="max-h-44 overflow-y-auto rounded border border-border divide-y divide-border bg-background">
                          {filteredFirewalls.map((entry) => {
                            const fw = entry.primary;
                            const isLinkedElsewhere = Object.values(links).some(
                              (l) =>
                                l.firewallId === fw.id ||
                                entry.peers.some((p) => p.id === l.firewallId),
                            );
                            return (
                              <button
                                key={fw.id}
                                onClick={() =>
                                  !isLinkedElsewhere && handleLink(config.configHash, fw, "manual")
                                }
                                disabled={isLinkedElsewhere}
                                className={`w-full flex items-center gap-2 px-2.5 py-2 text-left text-sm transition-colors ${
                                  isLinkedElsewhere
                                    ? "opacity-40 cursor-not-allowed"
                                    : "cursor-pointer hover:bg-brand-accent/10 dark:hover:bg-[#00EDFF]/10"
                                }`}
                              >
                                <span
                                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${fw.status?.connected ? "bg-[#00F2B3]" : "bg-[#EA0022]"}`}
                                />
                                <span className="font-semibold text-foreground truncate">
                                  {getFirewallDisplayName(fw)}
                                </span>
                                <span className="font-mono text-[11px] text-foreground/70 dark:text-white/60 shrink-0">
                                  {fw.serialNumber}
                                </span>
                                <span className="text-[11px] font-medium text-foreground/70 dark:text-white/60 shrink-0">
                                  {fw.firmwareVersion}
                                </span>
                                {entry.isHA && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#5A00FF]/10 text-[#5A00FF] dark:text-[#B98EFF] font-bold shrink-0">
                                    HA
                                    {entry.peers.length > 0
                                      ? ` (${1 + entry.peers.length} nodes)`
                                      : ""}
                                  </span>
                                )}
                                {fw.group?.name && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-accent/10 text-brand-accent shrink-0">
                                    {fw.group.name}
                                  </span>
                                )}
                                {isLinkedElsewhere && (
                                  <span className="text-[9px] text-muted-foreground ml-auto shrink-0">
                                    (linked)
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {filteredFirewalls.length === 0 && (
                            <p className="px-3 py-2 text-[10px] text-muted-foreground text-center">
                              No firewalls match this filter
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
