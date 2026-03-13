import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./use-auth";
import {
  getCentralStatus, connectCentral, disconnectCentral,
  syncTenants, syncFirewalls, getFirewallGroups,
  getAlerts, getLicences, getMdrThreatFeed,
  getCachedTenants, getCachedFirewalls,
  type CentralStatus, type CentralTenant, type CentralFirewall,
  type CentralFirewallGroup, type CentralAlert, type CentralLicence,
} from "@/lib/sophos-central";

export interface UseCentralState {
  status: CentralStatus | null;
  tenants: CentralTenant[];
  firewalls: CentralFirewall[];
  groups: CentralFirewallGroup[];
  alerts: CentralAlert[];
  licences: CentralLicence[];
  mdrFeed: unknown[];

  isConnected: boolean;
  isLoading: boolean;
  error: string;

  connect: (clientId: string, clientSecret: string) => Promise<{ error: string | null }>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshTenants: () => Promise<void>;
  refreshFirewalls: (tenantId: string) => Promise<void>;
  refreshGroups: (tenantId: string) => Promise<void>;
  refreshAlerts: (tenantId: string) => Promise<void>;
  refreshLicences: (tenantId: string) => Promise<void>;
  refreshMdrFeed: (tenantId: string) => Promise<void>;
  loadCachedTenants: () => Promise<void>;
  loadCachedFirewalls: (tenantId?: string) => Promise<void>;
}

export function useCentral(): UseCentralState {
  const { org, isGuest } = useAuth();
  const orgId = org?.id ?? "";

  const [status, setStatus] = useState<CentralStatus | null>(null);
  const [tenants, setTenants] = useState<CentralTenant[]>([]);
  const [firewalls, setFirewalls] = useState<CentralFirewall[]>([]);
  const [groups, setGroups] = useState<CentralFirewallGroup[]>([]);
  const [alerts, setAlerts] = useState<CentralAlert[]>([]);
  const [licences, setLicences] = useState<CentralLicence[]>([]);
  const [mdrFeed, setMdrFeed] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const isConnected = status?.connected ?? false;

  const refreshStatus = useCallback(async () => {
    if (!orgId) return;
    try {
      const s = await getCentralStatus(orgId);
      setStatus(s);
    } catch {
      setStatus({ connected: false });
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId && !isGuest) refreshStatus();
  }, [orgId, isGuest, refreshStatus]);

  const connect = useCallback(async (clientId: string, clientSecret: string) => {
    if (!orgId) return { error: "No organisation" };
    setIsLoading(true);
    setError("");
    try {
      await connectCentral(orgId, clientId, clientSecret);
      await refreshStatus();
      return { error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
      return { error: msg };
    } finally {
      setIsLoading(false);
    }
  }, [orgId, refreshStatus]);

  const disconnect = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      await disconnectCentral(orgId);
      setStatus({ connected: false });
      setTenants([]);
      setFirewalls([]);
      setGroups([]);
      setAlerts([]);
      setLicences([]);
      setMdrFeed([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    }
    setIsLoading(false);
  }, [orgId]);

  const refreshTenants = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError("");
    try {
      const items = await syncTenants(orgId);
      setTenants(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sync tenants");
    }
    setIsLoading(false);
  }, [orgId]);

  const refreshFirewalls = useCallback(async (tenantId: string) => {
    if (!orgId) return;
    setIsLoading(true);
    setError("");
    try {
      const items = await syncFirewalls(orgId, tenantId);
      setFirewalls(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sync firewalls");
    }
    setIsLoading(false);
  }, [orgId]);

  const refreshGroups = useCallback(async (tenantId: string) => {
    if (!orgId) return;
    try {
      const items = await getFirewallGroups(orgId, tenantId);
      setGroups(items);
    } catch {
      setGroups([]);
    }
  }, [orgId]);

  const refreshAlerts = useCallback(async (tenantId: string) => {
    if (!orgId) return;
    try {
      const items = await getAlerts(orgId, tenantId);
      setAlerts(items);
    } catch {
      setAlerts([]);
    }
  }, [orgId]);

  const refreshLicences = useCallback(async (tenantId: string) => {
    if (!orgId) return;
    try {
      const items = await getLicences(orgId, tenantId);
      setLicences(items);
    } catch {
      setLicences([]);
    }
  }, [orgId]);

  const refreshMdrFeed = useCallback(async (tenantId: string) => {
    if (!orgId) return;
    try {
      const items = await getMdrThreatFeed(orgId, tenantId);
      setMdrFeed(items);
    } catch {
      setMdrFeed([]);
    }
  }, [orgId]);

  const loadCachedTenants = useCallback(async () => {
    if (!orgId) return;
    try {
      const items = await getCachedTenants(orgId);
      setTenants(items);
    } catch {
      /* ignore */
    }
  }, [orgId]);

  const loadCachedFirewalls = useCallback(async (tenantId?: string) => {
    if (!orgId) return;
    try {
      const items = await getCachedFirewalls(orgId, tenantId);
      setFirewalls(items.map((r) => ({
        id: r.firewallId,
        serialNumber: r.serialNumber,
        hostname: r.hostname,
        name: r.name,
        firmwareVersion: r.firmwareVersion,
        model: r.model,
        status: r.status as CentralFirewall["status"],
        cluster: r.cluster as CentralFirewall["cluster"],
        group: r.group as CentralFirewall["group"],
        externalIpv4Addresses: (r.externalIps as string[]) ?? [],
      })));
    } catch {
      /* ignore */
    }
  }, [orgId]);

  return useMemo(() => ({
    status, tenants, firewalls, groups, alerts, licences, mdrFeed,
    isConnected, isLoading, error,
    connect, disconnect, refreshStatus,
    refreshTenants, refreshFirewalls, refreshGroups,
    refreshAlerts, refreshLicences, refreshMdrFeed,
    loadCachedTenants, loadCachedFirewalls,
  }), [
    status, tenants, firewalls, groups, alerts, licences, mdrFeed,
    isConnected, isLoading, error,
    connect, disconnect, refreshStatus,
    refreshTenants, refreshFirewalls, refreshGroups,
    refreshAlerts, refreshLicences, refreshMdrFeed,
    loadCachedTenants, loadCachedFirewalls,
  ]);
}
