import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Search, Server, ChevronDown, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthOptional } from "@/hooks/use-auth";
import {
  getCachedFirewalls,
  getCachedTenants,
  getFirewallDisplayName,
  type CentralTenant,
} from "@/lib/sophos-central";
import { supabase } from "@/integrations/supabase/client";
import { invalidateFleetRelatedQueries } from "@/lib/invalidate-org-queries";
import {
  fetchLinkedCentralFirewallCompliance,
  fetchTenantFirewallFleetContextMap,
  mergeLinkedCentralCustomerContext,
  resolveLinkedTenantCustomerName,
} from "@/lib/linked-firewall-compliance";
import { countryFlagEmoji } from "@/lib/compliance-context-options";

const linkedFwComplianceKey = (orgId: string, fwId: string, tenantId: string, orgName: string) =>
  ["linkedFwCompliance", orgId, fwId, tenantId, orgName] as const;

interface CachedFw {
  firewallId: string;
  centralTenantId: string;
  serialNumber: string;
  hostname: string;
  name: string;
  firmwareVersion: string;
  model: string;
  status: unknown;
  cluster: unknown;
  group: unknown;
  syncedAt: string;
}

interface HaGroup {
  primary: CachedFw;
  peers: CachedFw[];
  isHa: boolean;
}

export interface FirewallLink {
  configId: string;
  firewallId: string;
  tenantId: string;
  hostname: string;
  serialNumber: string;
  model: string;
  firmwareVersion: string;
  /** Fleet Customer Context (tenant + device overrides), after link resolves. */
  complianceContext?: {
    country: string;
    state: string;
    environment: string;
  };
  /** Sophos tenant label for Customer Name (matches Fleet / connector naming). */
  tenantCustomerDisplayName?: string;
}

interface Props {
  configId: string;
  configHostname: string;
  configHash: string;
  configSerialNumber?: string;
  /** When true, skip serial auto-link and hostname pre-selection (manual uploads). Only agent/connector configs should leave this false. */
  disableAutoLink?: boolean;
  onLinked?: (link: FirewallLink | null) => void;
}

function PickerRowFleetLine({
  fwId,
  fleetByFw,
  listFleetReady,
}: {
  fwId: string;
  fleetByFw: Record<string, { country: string; state: string; environment: string }>;
  listFleetReady: boolean;
}) {
  if (!listFleetReady) {
    return (
      <span className="text-[8px] text-muted-foreground/55 mt-0.5 tabular-nums" aria-hidden>
        …
      </span>
    );
  }
  const row = fleetByFw[fwId];
  const env = (row?.environment ?? "").trim() || "—";
  const country = (row?.country ?? "").trim();
  const usState = country === "United States" ? (row?.state ?? "").trim() : "";
  const flag = country ? countryFlagEmoji(country) : "";
  return (
    <span className="text-[8px] text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
      <span className="rounded border border-[#008F69]/20 dark:border-[#00F2B3]/15 bg-[#008F69]/[0.06] dark:bg-[#00F2B3]/5 px-1 py-px font-medium text-foreground/80">
        {env}
      </span>
      <span className="text-muted-foreground/60">·</span>
      {country ? (
        <span className="inline-flex items-center gap-0.5 text-foreground/75">
          <span aria-hidden>{flag}</span>
          <span>
            {country}
            {usState ? ` · ${usState}` : ""}
          </span>
        </span>
      ) : (
        <span>—</span>
      )}
    </span>
  );
}

async function enrichFirewallLinkWithCompliance(
  orgId: string,
  orgDisplayName: string | undefined,
  base: Omit<FirewallLink, "complianceContext" | "tenantCustomerDisplayName">,
): Promise<FirewallLink> {
  try {
    const raw = await fetchLinkedCentralFirewallCompliance(orgId, base.tenantId, base.firewallId);
    const complianceContext = mergeLinkedCentralCustomerContext(raw);
    const tenantCustomerDisplayName = resolveLinkedTenantCustomerName(raw, orgDisplayName).trim();
    return {
      ...base,
      complianceContext,
      ...(tenantCustomerDisplayName ? { tenantCustomerDisplayName } : {}),
    };
  } catch {
    return { ...base };
  }
}

export function FirewallLinkPicker({
  configId,
  configHostname,
  configHash,
  configSerialNumber,
  disableAutoLink,
  onLinked,
}: Props) {
  const auth = useAuthOptional();
  const org = auth?.org ?? null;
  const isGuest = auth?.isGuest ?? true;
  const orgId = org?.id ?? "";
  const queryClient = useQueryClient();

  const linkUpsertMutation = useMutation({
    mutationFn: async (row: {
      org_id: string;
      config_hostname: string;
      config_hash: string;
      central_firewall_id: string;
      central_tenant_id: string;
    }) => {
      const { error } = await supabase
        .from("firewall_config_links")
        .upsert(row, { onConflict: "org_id,config_hash" });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void invalidateFleetRelatedQueries(queryClient, variables.org_id);
    },
  });

  const linkDeleteMutation = useMutation({
    mutationFn: async (vars: { orgId: string; configHash: string }) => {
      const { error } = await supabase
        .from("firewall_config_links")
        .delete()
        .eq("org_id", vars.orgId)
        .eq("config_hash", vars.configHash);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void invalidateFleetRelatedQueries(queryClient, variables.orgId);
    },
  });

  const [tenants, setTenants] = useState<CentralTenant[]>([]);
  const [firewalls, setFirewalls] = useState<CachedFw[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedFwId, setSelectedFwId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [manualSerial, setManualSerial] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [linked, setLinked] = useState<FirewallLink | null>(null);
  const [selectedFleetContext, setSelectedFleetContext] = useState<{
    country: string;
    state: string;
    environment: string;
  } | null>(null);
  const [fleetByFw, setFleetByFw] = useState<
    Record<string, { country: string; state: string; environment: string }>
  >({});
  const [listFleetReady, setListFleetReady] = useState(false);

  const firewallsFingerprint = useMemo(
    () =>
      firewalls
        .map((f) => f.firewallId)
        .sort()
        .join(","),
    [firewalls],
  );

  useEffect(() => {
    if (!orgId || !selectedTenantId) {
      setFleetByFw({});
      setListFleetReady(false);
      return;
    }
    let cancelled = false;
    setListFleetReady(false);
    void fetchTenantFirewallFleetContextMap(orgId, selectedTenantId)
      .then((map) => {
        if (cancelled) return;
        const rec: Record<string, { country: string; state: string; environment: string }> = {};
        for (const [k, v] of map) rec[k] = v;
        setFleetByFw(rec);
        setListFleetReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setFleetByFw({});
          setListFleetReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, selectedTenantId, firewallsFingerprint]);

  const linkedFwId = linked?.firewallId ?? "";
  const linkedTenantId = linked?.tenantId ?? "";
  const orgNameKey = org?.name?.trim() ?? "";

  const linkedComplianceQuery = useQuery({
    queryKey: linkedFwComplianceKey(orgId, linkedFwId, linkedTenantId, orgNameKey),
    queryFn: async () => {
      const raw = await fetchLinkedCentralFirewallCompliance(orgId, linkedTenantId, linkedFwId);
      return {
        complianceContext: mergeLinkedCentralCustomerContext(raw),
        tenantCustomerDisplayName: resolveLinkedTenantCustomerName(raw, org?.name).trim(),
      };
    },
    enabled: Boolean(orgId && linkedFwId && linkedTenantId && !isGuest),
    staleTime: 20_000,
  });

  /** Parent often passes an inline `onLinked` — keep a ref so effects do not re-run every render. */
  const onLinkedRef = useRef(onLinked);
  onLinkedRef.current = onLinked;

  const linkedSnapshotRef = useRef(linked);
  linkedSnapshotRef.current = linked;

  const lastComplianceNotifySig = useRef<string>("");

  useEffect(() => {
    if (!linkedFwId || !linkedTenantId) {
      lastComplianceNotifySig.current = "";
      return;
    }
    if (!linkedComplianceQuery.isSuccess || !linkedComplianceQuery.data) return;
    const snap = linkedSnapshotRef.current;
    if (!snap || snap.firewallId !== linkedFwId || snap.tenantId !== linkedTenantId) return;

    const { complianceContext, tenantCustomerDisplayName } = linkedComplianceQuery.data;
    const hasScope =
      !!complianceContext.country || !!complianceContext.environment || !!tenantCustomerDisplayName;
    if (!hasScope) return;

    const sig = `${linkedFwId}\0${linkedTenantId}\0${complianceContext.country}\0${complianceContext.environment}\0${tenantCustomerDisplayName}\0${tenantCustomerDisplayName}`;
    if (lastComplianceNotifySig.current === sig) return;
    lastComplianceNotifySig.current = sig;

    onLinkedRef.current?.({
      ...snap,
      complianceContext,
      ...(tenantCustomerDisplayName ? { tenantCustomerDisplayName } : {}),
    });
  }, [linkedComplianceQuery.isSuccess, linkedComplianceQuery.data, linkedFwId, linkedTenantId]);

  useEffect(() => {
    if (!orgId || isGuest) return;
    getCachedTenants(orgId)
      .then((t) => {
        setTenants(t);
        if (t.length === 1 && !selectedTenantId) {
          setSelectedTenantId(t[0].id);
        }
      })
      .catch(() => {});
  }, [orgId, isGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing link
  useEffect(() => {
    if (!orgId || !configHash) return;
    supabase
      .from("firewall_config_links")
      .select("*")
      .eq("org_id", orgId)
      .eq("config_hash", configHash)
      .single()
      .then(({ data }) => {
        if (data) {
          void getCachedFirewalls(orgId, data.central_tenant_id).then(async (fws) => {
            const fw = fws.find((f) => f.firewallId === data.central_firewall_id);
            if (fw) {
              const base: Omit<FirewallLink, "complianceContext" | "tenantCustomerDisplayName"> = {
                configId,
                firewallId: fw.firewallId,
                tenantId: data.central_tenant_id,
                hostname: fw.hostname,
                serialNumber: fw.serialNumber,
                model: fw.model,
                firmwareVersion: fw.firmwareVersion,
              };
              const enriched = await enrichFirewallLinkWithCompliance(orgId, org?.name, base);
              setLinked(enriched);
              onLinkedRef.current?.(enriched);
            }
          });
        }
      });
  }, [orgId, configHash, configId, org?.name]);

  // Auto-link helper: persists the link and updates state
  const autoLink = useCallback(
    async (fw: CachedFw) => {
      if (!orgId) return;
      await linkUpsertMutation.mutateAsync({
        org_id: orgId,
        config_hostname: configHostname,
        config_hash: configHash,
        central_firewall_id: fw.firewallId,
        central_tenant_id: fw.centralTenantId,
      });
      const base: Omit<FirewallLink, "complianceContext" | "tenantCustomerDisplayName"> = {
        configId,
        firewallId: fw.firewallId,
        tenantId: fw.centralTenantId,
        hostname: fw.hostname,
        serialNumber: fw.serialNumber,
        model: fw.model,
        firmwareVersion: fw.firmwareVersion,
      };
      const enriched = await enrichFirewallLinkWithCompliance(orgId, org?.name, base);
      setLinked(enriched);
      setOpen(false);
      onLinkedRef.current?.(enriched);
    },
    [orgId, configId, configHostname, configHash, linkUpsertMutation, org?.name],
  );

  const autoLinkRef = useRef(autoLink);
  autoLinkRef.current = autoLink;

  /** Prevents duplicate upserts if the firewalls effect re-runs (e.g. after query invalidation). */
  const serialAutoPersistKeyRef = useRef<string | null>(null);

  // Load firewalls when tenant changes
  useEffect(() => {
    if (!orgId || !selectedTenantId) {
      setFirewalls([]);
      return;
    }
    getCachedFirewalls(orgId, selectedTenantId)
      .then((fws) => {
        setFirewalls(fws);
        // Auto-link by serial: Sophos connector (agent) only — never for manual HTML/XML uploads.
        if (configSerialNumber && !disableAutoLink) {
          const match = fws.find(
            (f) => f.serialNumber.toLowerCase() === configSerialNumber.toLowerCase(),
          );
          if (match) {
            const dedupeKey = `${orgId}:${configHash}:${match.firewallId}`;
            if (serialAutoPersistKeyRef.current !== dedupeKey) {
              serialAutoPersistKeyRef.current = dedupeKey;
              void autoLinkRef.current(match);
            }
            return;
          }
        }
        // Hostname pre-select: same rule — manual exports can match the wrong tenant or fuzzy hostname.
        if (configHostname && !disableAutoLink) {
          const match = fws.find(
            (f) =>
              f.hostname.toLowerCase() === configHostname.toLowerCase() ||
              f.hostname.toLowerCase().startsWith(configHostname.split(".")[0].toLowerCase()),
          );
          if (match) {
            setSelectedFwId(match.firewallId);
          }
        }
      })
      .catch(() => {});
  }, [orgId, selectedTenantId, configHostname, configSerialNumber, disableAutoLink, configHash]);

  useEffect(() => {
    if (!orgId || !selectedFwId) {
      setSelectedFleetContext(null);
      return;
    }
    const fw = firewalls.find((f) => f.firewallId === selectedFwId);
    if (!fw) {
      setSelectedFleetContext(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const raw = await fetchLinkedCentralFirewallCompliance(
          orgId,
          fw.centralTenantId,
          fw.firewallId,
        );
        if (!cancelled) setSelectedFleetContext(mergeLinkedCentralCustomerContext(raw));
      } catch {
        if (!cancelled) setSelectedFleetContext(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, selectedFwId, firewalls]);

  useEffect(() => {
    serialAutoPersistKeyRef.current = null;
  }, [configHash, orgId]);

  const groups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const fw of firewalls) {
      const g = fw.group as { id?: string; name?: string } | null;
      if (g?.id && g?.name) seen.set(g.id, g.name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [firewalls]);

  const haGroups = useMemo(() => {
    const clusterMap = new Map<string, CachedFw[]>();
    const standalone: CachedFw[] = [];

    for (const fw of firewalls) {
      const c = fw.cluster as { id?: string } | null;
      if (c?.id) {
        if (!clusterMap.has(c.id)) clusterMap.set(c.id, []);
        clusterMap.get(c.id)!.push(fw);
      } else {
        standalone.push(fw);
      }
    }

    const result: HaGroup[] = [];
    for (const [, peers] of clusterMap) {
      const sorted = peers.sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
      result.push({ primary: sorted[0], peers: sorted.slice(1), isHa: sorted.length > 1 });
    }
    for (const fw of standalone) {
      result.push({ primary: fw, peers: [], isHa: false });
    }
    return result;
  }, [firewalls]);

  const filtered = useMemo(() => {
    let list = haGroups;
    if (selectedGroupId) {
      list = list.filter((h) => {
        const g = h.primary.group as { id?: string } | null;
        return g?.id === selectedGroupId;
      });
    }
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((h) => {
      const allFws = [h.primary, ...h.peers];
      return allFws.some(
        (f) =>
          f.hostname.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          f.serialNumber.toLowerCase().includes(q) ||
          f.model.toLowerCase().includes(q),
      );
    });
  }, [haGroups, search, selectedGroupId]);

  const handleSerialMatch = useCallback(() => {
    if (!manualSerial.trim()) return;
    const q = manualSerial.trim().toLowerCase();
    for (const h of haGroups) {
      const allFws = [h.primary, ...h.peers];
      if (allFws.some((f) => f.serialNumber.toLowerCase() === q)) {
        setSelectedFwId(h.primary.firewallId);
        return;
      }
    }
  }, [manualSerial, haGroups]);

  const handleLink = async () => {
    const fw = firewalls.find((f) => f.firewallId === selectedFwId);
    if (!fw || !orgId) return;

    await linkUpsertMutation.mutateAsync({
      org_id: orgId,
      config_hostname: configHostname,
      config_hash: configHash,
      central_firewall_id: fw.firewallId,
      central_tenant_id: fw.centralTenantId,
    });

    const base: Omit<FirewallLink, "complianceContext" | "tenantCustomerDisplayName"> = {
      configId,
      firewallId: fw.firewallId,
      tenantId: fw.centralTenantId,
      hostname: fw.hostname,
      serialNumber: fw.serialNumber,
      model: fw.model,
      firmwareVersion: fw.firmwareVersion,
    };
    const enriched = await enrichFirewallLinkWithCompliance(orgId, org?.name, base);
    setLinked(enriched);
    setOpen(false);
    onLinkedRef.current?.(enriched);
  };

  const handleUnlink = async () => {
    if (!orgId || !configHash) return;
    await linkDeleteMutation.mutateAsync({ orgId, configHash });
    setLinked(null);
    setSelectedFwId("");
    onLinkedRef.current?.(null);
  };

  if (isGuest || !orgId || tenants.length === 0) return null;

  if (linked) {
    const cc = linkedComplianceQuery.data?.complianceContext ?? linked.complianceContext;
    const envLabel = (cc?.environment ?? "").trim() || "—";
    const country = (cc?.country ?? "").trim();
    const usState = country === "United States" ? (cc?.state ?? "").trim() : "";
    const flag = country ? countryFlagEmoji(country) : "";
    const fleetRowLoading = linkedComplianceQuery.isPending;
    const fleetMissingDefaults = !fleetRowLoading && !country && !(cc?.environment ?? "").trim();

    return (
      <div className="mt-1 py-1.5 px-2 rounded bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 dark:bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 border border-[#008F69]/30 dark:border-[#00F2B3]/20 dark:border-[#008F69]/30 dark:border-[#00F2B3]/20 space-y-1">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="h-3 w-3 text-[#007A5A] dark:text-[#00F2B3] shrink-0" />
          <span className="text-[10px] text-foreground font-medium truncate min-w-0">
            {linked.hostname || linked.serialNumber}
          </span>
          <span className="text-[9px] text-muted-foreground shrink-0 hidden sm:inline">
            {linked.model} · {linked.firmwareVersion}
          </span>
          <button
            type="button"
            onClick={handleUnlink}
            className="ml-auto text-[9px] text-muted-foreground hover:text-[#EA0022] transition-colors shrink-0"
          >
            Unlink
          </button>
        </div>
        <div className="text-[9px] text-muted-foreground pl-5 pr-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold text-[#007A5A]/90 dark:text-[#00F2B3]/90">Fleet</span>
          <span className="rounded-md border border-[#008F69]/25 dark:border-[#00F2B3]/25 bg-white/50 dark:bg-black/20 px-1.5 py-0.5 text-foreground/90">
            {envLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            {country ? (
              <>
                <span aria-hidden>{flag}</span>
                <span>
                  {country}
                  {usState ? ` · ${usState}` : ""}
                </span>
              </>
            ) : (
              <span>—</span>
            )}
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground pl-5 sm:hidden">
          {linked.model} · {linked.firmwareVersion}
        </p>
        {fleetRowLoading && (
          <p className="text-[9px] text-muted-foreground pl-5">Loading fleet context…</p>
        )}
        {fleetMissingDefaults && (
          <p className="text-[9px] text-muted-foreground pl-5 leading-snug">
            No country or sector saved for this customer in Fleet Command yet — set{" "}
            <span className="font-medium text-foreground/80">customer defaults</span> there to see
            them here and in reports.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md border border-brand-accent/30 dark:border-[#00EDFF]/30 bg-brand-accent/[0.06] dark:bg-[#00EDFF]/[0.08] px-2 py-1 text-[11px] font-semibold tracking-tight text-brand-accent hover:bg-brand-accent/10 dark:hover:bg-[#00EDFF]/12 transition-colors"
      >
        <Link2 className="h-3 w-3" />
        Link to Central Firewall
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-border/50 bg-card p-3 space-y-2.5 shadow-sm">
          {/* Tenant selector */}
          <div className="space-y-1">
            <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tenant
            </label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="w-full rounded-xl border border-border/50 bg-card px-2.5 py-2 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
            >
              <option value="">Select tenant…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || t.id}
                </option>
              ))}
            </select>
          </div>

          {firewalls.length > 0 && (
            <>
              {/* Manual serial input */}
              <div className="flex gap-1.5 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Serial Number (optional)
                  </label>
                  <Input
                    value={manualSerial}
                    onChange={(e) => setManualSerial(e.target.value)}
                    placeholder="Paste serial from appliance / Central"
                    className="h-7 text-[11px] font-mono"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSerialMatch}
                  className="h-7 text-[10px] px-2"
                >
                  Match
                </Button>
              </div>

              {/* Group filter */}
              {groups.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Group
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full rounded-xl border border-border/50 bg-card px-2.5 py-2 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
                  >
                    <option value="">All groups ({firewalls.length})</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search firewalls…"
                  className="h-7 text-[11px] pl-7"
                />
              </div>

              {/* Firewall list */}
              <div className="max-h-44 overflow-y-auto rounded border border-border divide-y divide-border">
                {filtered.map((haGroup) => {
                  const allFws = [haGroup.primary, ...haGroup.peers];
                  const isSelected = allFws.some((f) => f.firewallId === selectedFwId);
                  const autoMatch =
                    !disableAutoLink &&
                    configHostname &&
                    haGroup.primary.hostname
                      .toLowerCase()
                      .startsWith(configHostname.split(".")[0].toLowerCase());

                  return (
                    <button
                      key={haGroup.primary.firewallId}
                      onClick={() => setSelectedFwId(haGroup.primary.firewallId)}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 text-[11px] hover:bg-muted/30 transition-colors ${
                        isSelected ? "bg-brand-accent/5 dark:bg-brand-accent/10" : ""
                      }`}
                    >
                      <div
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          (haGroup.primary.status as { connected?: boolean })?.connected
                            ? "bg-[#00F2B3]"
                            : "bg-[#EA0022]"
                        }`}
                      />
                      <Server className="h-3 w-3 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground truncate">
                            {getFirewallDisplayName(haGroup.primary)}
                          </span>
                          {haGroup.isHa && (
                            <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-[#5A00FF]/10 text-[#5A00FF] dark:text-[#B529F7] shrink-0">
                              HA PAIR
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground block">
                          {haGroup.primary.model} · {haGroup.primary.firmwareVersion} ·{" "}
                          {allFws.map((f) => f.serialNumber).join(" / ")}
                        </span>
                        <PickerRowFleetLine
                          fwId={haGroup.primary.firewallId}
                          fleetByFw={fleetByFw}
                          listFleetReady={listFleetReady}
                        />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                      )}
                      {autoMatch && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3] font-semibold shrink-0">
                          AUTO
                        </span>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <EmptyState
                    className="!py-6"
                    icon={<Search className="h-5 w-5 text-muted-foreground/50" />}
                    title="No firewalls found"
                    description="Try another search term."
                  />
                )}
              </div>

              {selectedFwId && selectedFleetContext && (
                <p className="text-[9px] text-muted-foreground leading-snug px-0.5">
                  <span className="font-semibold text-foreground/80">Fleet context</span>
                  {" · "}
                  <span className="rounded border border-border/60 px-1 py-px">
                    {(selectedFleetContext.environment || "—").trim()}
                  </span>
                  {" · "}
                  {selectedFleetContext.country ? (
                    <span className="inline-flex items-center gap-0.5">
                      <span aria-hidden>{countryFlagEmoji(selectedFleetContext.country)}</span>
                      {selectedFleetContext.country}
                      {selectedFleetContext.country === "United States" &&
                      selectedFleetContext.state
                        ? ` · ${selectedFleetContext.state}`
                        : ""}
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </p>
              )}

              {/* Confirm */}
              <Button
                size="sm"
                onClick={handleLink}
                disabled={!selectedFwId}
                className="w-full h-7 text-[11px] gap-1.5 bg-gradient-to-r from-[#2006F7] to-[#5A00FF] hover:from-[#10037C] hover:to-[#2006F7] text-white"
              >
                <Link2 className="h-3 w-3" />
                Link Firewall
              </Button>
            </>
          )}

          {selectedTenantId && firewalls.length === 0 && (
            <EmptyState
              className="!py-4"
              icon={<Server className="h-5 w-5 text-muted-foreground/50" />}
              title="No cached firewalls"
              description="Sync firewalls in the Sophos Central API section first."
            />
          )}
        </div>
      )}
    </div>
  );
}
