import { useState, useEffect, useMemo, useCallback } from "react";
import { Link2, Search, Server, ChevronDown, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getCachedFirewalls, getCachedTenants, type CentralTenant } from "@/lib/sophos-central";
import { supabase } from "@/integrations/supabase/client";

interface CachedFw {
  firewallId: string;
  centralTenantId: string;
  serialNumber: string;
  hostname: string;
  name: string;
  firmwareVersion: string;
  model: string;
  status: unknown;
  group: unknown;
  syncedAt: string;
}

export interface FirewallLink {
  configId: string;
  firewallId: string;
  tenantId: string;
  hostname: string;
  serialNumber: string;
  model: string;
  firmwareVersion: string;
}

interface Props {
  configId: string;
  configHostname: string;
  configHash: string;
  onLinked?: (link: FirewallLink | null) => void;
}

export function FirewallLinkPicker({ configId, configHostname, configHash, onLinked }: Props) {
  const { org, isGuest } = useAuth();
  const orgId = org?.id ?? "";

  const [tenants, setTenants] = useState<CentralTenant[]>([]);
  const [firewalls, setFirewalls] = useState<CachedFw[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedFwId, setSelectedFwId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [manualSerial, setManualSerial] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [linked, setLinked] = useState<FirewallLink | null>(null);

  useEffect(() => {
    if (!orgId || isGuest) return;
    getCachedTenants(orgId).then(setTenants).catch(() => {});
  }, [orgId, isGuest]);

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
          getCachedFirewalls(orgId, data.central_tenant_id).then((fws) => {
            const fw = fws.find((f) => f.firewallId === data.central_firewall_id);
            if (fw) {
              const l: FirewallLink = {
                configId,
                firewallId: fw.firewallId,
                tenantId: data.central_tenant_id,
                hostname: fw.hostname,
                serialNumber: fw.serialNumber,
                model: fw.model,
                firmwareVersion: fw.firmwareVersion,
              };
              setLinked(l);
              onLinked?.(l);
            }
          });
        }
      });
  }, [orgId, configHash, configId, onLinked]);

  // Load firewalls when tenant changes
  useEffect(() => {
    if (!orgId || !selectedTenantId) { setFirewalls([]); return; }
    getCachedFirewalls(orgId, selectedTenantId).then((fws) => {
      setFirewalls(fws);
      // Auto-match by hostname
      if (configHostname) {
        const match = fws.find((f) =>
          f.hostname.toLowerCase() === configHostname.toLowerCase()
          || f.hostname.toLowerCase().startsWith(configHostname.split(".")[0].toLowerCase())
        );
        if (match) {
          setSelectedFwId(match.firewallId);
        }
      }
    }).catch(() => {});
  }, [orgId, selectedTenantId, configHostname]);

  const groups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const fw of firewalls) {
      const g = fw.group as { id?: string; name?: string } | null;
      if (g?.id && g?.name) seen.set(g.id, g.name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [firewalls]);

  const filtered = useMemo(() => {
    let list = firewalls;
    if (selectedGroupId) {
      list = list.filter((f) => {
        const g = f.group as { id?: string } | null;
        return g?.id === selectedGroupId;
      });
    }
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((f) =>
      f.hostname.toLowerCase().includes(q)
      || f.name.toLowerCase().includes(q)
      || f.serialNumber.toLowerCase().includes(q)
      || f.model.toLowerCase().includes(q)
    );
  }, [firewalls, search, selectedGroupId]);

  const handleSerialMatch = useCallback(() => {
    if (!manualSerial.trim()) return;
    const match = firewalls.find((f) => f.serialNumber.toLowerCase() === manualSerial.trim().toLowerCase());
    if (match) setSelectedFwId(match.firewallId);
  }, [manualSerial, firewalls]);

  const handleLink = async () => {
    const fw = firewalls.find((f) => f.firewallId === selectedFwId);
    if (!fw || !orgId) return;

    await supabase.from("firewall_config_links").upsert({
      org_id: orgId,
      config_hostname: configHostname,
      config_hash: configHash,
      central_firewall_id: fw.firewallId,
      central_tenant_id: fw.centralTenantId,
    }, { onConflict: "org_id,config_hash" });

    const l: FirewallLink = {
      configId,
      firewallId: fw.firewallId,
      tenantId: fw.centralTenantId,
      hostname: fw.hostname,
      serialNumber: fw.serialNumber,
      model: fw.model,
      firmwareVersion: fw.firmwareVersion,
    };
    setLinked(l);
    setOpen(false);
    onLinked?.(l);
  };

  const handleUnlink = async () => {
    if (!orgId || !configHash) return;
    await supabase.from("firewall_config_links").delete().eq("org_id", orgId).eq("config_hash", configHash);
    setLinked(null);
    setSelectedFwId("");
    onLinked?.(null);
  };

  if (isGuest || !orgId || tenants.length === 0) return null;

  if (linked) {
    return (
      <div className="flex items-center gap-2 mt-1 py-1 px-2 rounded bg-[#00995a]/5 dark:bg-[#00F2B3]/5 border border-[#00995a]/20 dark:border-[#00F2B3]/20">
        <CheckCircle2 className="h-3 w-3 text-[#00995a] dark:text-[#00F2B3] shrink-0" />
        <span className="text-[10px] text-foreground font-medium truncate">{linked.hostname || linked.serialNumber}</span>
        <span className="text-[9px] text-muted-foreground">{linked.model} · {linked.firmwareVersion}</span>
        <button onClick={handleUnlink} className="ml-auto text-[9px] text-muted-foreground hover:text-[#EA0022] transition-colors">Unlink</button>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] text-[#2006F7] dark:text-[#00EDFF] hover:underline"
      >
        <Link2 className="h-3 w-3" />
        Link to Central Firewall
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-card p-3 space-y-2.5 shadow-sm">
          {/* Tenant selector */}
          <div className="space-y-1">
            <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Tenant</label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2006F7]/30"
            >
              <option value="">Select tenant…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name || t.id}</option>
              ))}
            </select>
          </div>

          {firewalls.length > 0 && (
            <>
              {/* Manual serial input */}
              <div className="flex gap-1.5 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Serial Number (optional)</label>
                  <Input
                    value={manualSerial}
                    onChange={(e) => setManualSerial(e.target.value)}
                    placeholder="Paste serial from appliance / Central"
                    className="h-7 text-[11px] font-mono"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={handleSerialMatch} className="h-7 text-[10px] px-2">Match</Button>
              </div>

              {/* Group filter */}
              {groups.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Group</label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2006F7]/30"
                  >
                    <option value="">All groups ({firewalls.length})</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
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
              <div className="max-h-36 overflow-y-auto rounded border border-border divide-y divide-border">
                {filtered.map((fw) => (
                  <button
                    key={fw.firewallId}
                    onClick={() => setSelectedFwId(fw.firewallId)}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 text-[11px] hover:bg-muted/30 transition-colors ${
                      selectedFwId === fw.firewallId ? "bg-[#2006F7]/5 dark:bg-[#2006F7]/10" : ""
                    }`}
                  >
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      (fw.status as { connected?: boolean })?.connected ? "bg-[#00995a]" : "bg-[#EA0022]"
                    }`} />
                    <Server className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground truncate block">{fw.hostname || fw.name || fw.serialNumber}</span>
                      <span className="text-[9px] text-muted-foreground">{fw.model} · {fw.firmwareVersion} · {fw.serialNumber}</span>
                    </div>
                    {selectedFwId === fw.firewallId && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#2006F7] dark:text-[#00EDFF] shrink-0" />
                    )}
                    {configHostname && fw.hostname.toLowerCase().startsWith(configHostname.split(".")[0].toLowerCase()) && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3] font-semibold shrink-0">AUTO</span>
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-[10px] text-muted-foreground py-3">No firewalls found</p>
                )}
              </div>

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
            <p className="text-[10px] text-muted-foreground text-center py-2">No firewalls cached for this tenant. Sync firewalls in the Sophos Central API section first.</p>
          )}
        </div>
      )}
    </div>
  );
}
