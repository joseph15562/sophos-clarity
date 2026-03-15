import { supabase } from "@/integrations/supabase/client";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sophos-central`;

const CALL_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1_000;

async function callCentral<T = unknown>(body: Record<string, unknown>, retries = MAX_RETRIES): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);

    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch (err) {
        console.warn("[callCentral] invalid JSON", err);
        throw new Error(`Invalid JSON response (${res.status})`);
      }

      if (!res.ok || data.error) {
        const msg = (data.error as string) ?? `Request failed (${res.status})`;
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          lastError = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }

      return data as T;
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));

      if (lastError.name === "AbortError") {
        lastError = new Error("Request timed out");
      }

      if (attempt < retries && !lastError.message.includes("Not authenticated")) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("Request failed");
}

// ── Connection management ──

export interface CentralStatus {
  connected: boolean;
  partner_id?: string;
  partner_type?: "partner" | "organization" | "tenant";
  api_hosts?: Record<string, string>;
  connected_at?: string;
  last_synced_at?: string | null;
}

export async function getCentralStatus(orgId: string): Promise<CentralStatus> {
  return callCentral<CentralStatus>({ mode: "status", orgId });
}

export interface ConnectResult {
  ok: boolean;
  partnerId: string;
  partnerType: "partner" | "organization" | "tenant";
  apiHosts: Record<string, string>;
}

export async function connectCentral(orgId: string, clientId: string, clientSecret: string): Promise<ConnectResult> {
  return callCentral<ConnectResult>({ mode: "connect", orgId, clientId, clientSecret });
}

export async function disconnectCentral(orgId: string): Promise<void> {
  await callCentral({ mode: "disconnect", orgId });
}

// ── Tenants ──

export interface CentralTenant {
  id: string;
  name: string;
  dataRegion: string;
  apiHost: string;
  billingType: string;
}

export async function syncTenants(orgId: string): Promise<CentralTenant[]> {
  const res = await callCentral<{ items: CentralTenant[] }>({ mode: "tenants", orgId });
  return res.items;
}

// ── Firewalls ──

export interface CentralFirewall {
  id: string;
  serialNumber: string;
  hostname: string;
  name: string;
  firmwareVersion: string;
  model: string;
  status: { connected: boolean; managing?: string; reporting?: string; suspended: boolean };
  cluster?: { id: string; mode: string; status: string; peers?: unknown[] };
  group?: { id: string; name: string };
  externalIpv4Addresses: string[];
  geoLocation?: { latitude: string; longitude: string };
}

export async function syncFirewalls(orgId: string, tenantId: string): Promise<CentralFirewall[]> {
  const res = await callCentral<{ items: CentralFirewall[] }>({ mode: "firewalls", orgId, tenantId });
  return res.items;
}

// ── Firewall Groups ──

export interface CentralFirewallGroup {
  id: string;
  name: string;
  firewalls?: { items?: Array<{ id: string }> };
}

export async function getFirewallGroups(orgId: string, tenantId: string): Promise<CentralFirewallGroup[]> {
  const res = await callCentral<{ items: CentralFirewallGroup[] }>({ mode: "firewall-groups", orgId, tenantId });
  return res.items ?? [];
}

// ── Alerts ──

export interface CentralAlert {
  id: string;
  description: string;
  severity: string;
  category: string;
  product: string;
  raisedAt: string;
  allowedActions: string[];
  managedAgent?: { id: string; type: string };
}

export async function getAlerts(orgId: string, tenantId: string): Promise<CentralAlert[]> {
  const res = await callCentral<{ items: CentralAlert[] }>({ mode: "alerts", orgId, tenantId });
  return res.items ?? [];
}

// ── Licences (legacy tenant-level) ──

export interface CentralLicence {
  licenseIdentifier: string;
  startDate: string;
  endDate: string;
  product: { code: string; name?: string };
  type: string;
}

export async function getLicences(orgId: string, tenantId: string): Promise<CentralLicence[]> {
  const res = await callCentral<{ licenses: CentralLicence[] }>({ mode: "licenses", orgId, tenantId });
  return res.licenses ?? [];
}

// ── Firewall Licences (per-device via Licensing API) ──

export interface FirewallSubscription {
  id: string;
  licenseIdentifier: string;
  product: { code: string; name: string; genericCode?: string; features?: string[] };
  startDate: string;
  endDate?: string;
  perpetual: boolean;
  type: "trial" | "term" | "usage" | "ordered" | "enterprise" | "perpetual";
  quantity: number;
  unlimited?: boolean;
  usage?: { current: { count: number; date?: string } };
}

export interface FirewallLicence {
  serialNumber: string;
  model: string;
  modelType: "virtual" | "hardware";
  lastSeenAt?: string;
  owner: { id: string; type: "partner" | "organization" };
  tenant?: { id: string };
  partner?: { id: string };
  organization?: { id: string };
  billingTenant?: { id: string };
  licenses: FirewallSubscription[];
}

export async function getFirewallLicences(orgId: string, tenantId?: string): Promise<FirewallLicence[]> {
  const res = await callCentral<{ items: FirewallLicence[] }>({ mode: "firewall-licenses", orgId, tenantId });
  return res.items ?? [];
}

// ── MDR Threat Feed ──

export async function getMdrThreatFeed(orgId: string, tenantId: string): Promise<unknown[]> {
  const res = await callCentral<{ items: unknown[] }>({ mode: "mdr-threat-feed", orgId, tenantId });
  return res.items ?? [];
}

// ── Cached data from Supabase ──

export async function getCachedTenants(orgId: string): Promise<CentralTenant[]> {
  const { data } = await supabase
    .from("central_tenants")
    .select("central_tenant_id, name, data_region, api_host, billing_type")
    .eq("org_id", orgId)
    .order("name");
  return (data ?? []).map((r) => ({
    id: r.central_tenant_id,
    name: r.name,
    dataRegion: r.data_region,
    apiHost: r.api_host,
    billingType: r.billing_type,
  }));
}

export async function getCachedFirewalls(orgId: string, tenantId?: string): Promise<Array<{
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
  externalIps: unknown;
  syncedAt: string;
}>> {
  let q = supabase
    .from("central_firewalls")
    .select("*")
    .eq("org_id", orgId);
  if (tenantId) q = q.eq("central_tenant_id", tenantId);
  const { data } = await q.order("hostname");
  return (data ?? []).map((r) => ({
    firewallId: r.firewall_id,
    centralTenantId: r.central_tenant_id,
    serialNumber: r.serial_number,
    hostname: r.hostname,
    name: r.name,
    firmwareVersion: r.firmware_version,
    model: r.model,
    status: r.status_json,
    cluster: r.cluster_json,
    group: r.group_json,
    externalIps: r.external_ips,
    syncedAt: r.synced_at,
  }));
}
