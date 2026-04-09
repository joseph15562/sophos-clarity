import { supabase } from "@/integrations/supabase/client";
import { centralAlertRaisedAt as centralAlertRaisedAtFromFields } from "@/lib/central-alert-timestamps";
import { mapTenantBatches } from "@/pages/central/central-batched";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sophos-central`;

const CALL_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1_000;

async function callCentral<T = unknown>(
  body: Record<string, unknown>,
  opts?: { retries?: number; timeoutMs?: number },
): Promise<T> {
  const retries = opts?.retries ?? MAX_RETRIES;
  const timeoutMs = opts?.timeoutMs ?? CALL_TIMEOUT_MS;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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

export async function connectCentral(
  orgId: string,
  clientId: string,
  clientSecret: string,
): Promise<ConnectResult> {
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

/** True if string looks like a serial or node ID (long alphanumeric, no dots). */
function looksLikeSerialOrNodeId(s: string): boolean {
  const t = s.trim();
  if (t.length < 8) return false;
  return /^[A-Za-z0-9]+$/.test(t) && !t.includes(".");
}

/** Sophos Central uses this literal for single-tenant MSP accounts. */
export function isThisTenantPlaceholder(name: string | undefined | null): boolean {
  return /^\s*\(this tenant\)\s*$/i.test((name ?? "").trim());
}

/** Header, pills, selects: show org name instead of the Central placeholder when signed in. */
export function displayCustomerNameForUi(
  storedName: string,
  orgDisplayName: string | undefined | null,
): string {
  const o = (orgDisplayName ?? "").trim();
  if (o && isThisTenantPlaceholder(storedName)) return o;
  return storedName;
}

/** When the API returns "(This tenant)" for a single-tenant account, use the provided display name (e.g. from branding or connector). */
export function getEffectiveTenantDisplayName(
  tenant: { name?: string } | null,
  fallbackDisplayName?: string | null,
): string {
  if (!tenant?.name) return fallbackDisplayName ?? "";
  if (isThisTenantPlaceholder(tenant.name) && fallbackDisplayName?.trim())
    return fallbackDisplayName.trim();
  return tenant.name;
}

/** Prefer hostname when it looks like a real hostname; avoid using serial/node-id as display name. */
export function getFirewallDisplayName(fw: {
  name?: string;
  hostname?: string;
  serialNumber?: string;
}): string {
  const name = (fw.name ?? "").trim();
  const hostname = (fw.hostname ?? "").trim();
  if (hostname && (hostname.includes(".") || !looksLikeSerialOrNodeId(hostname))) return hostname;
  if (name && !looksLikeSerialOrNodeId(name)) return name;
  return hostname || name || (fw.serialNumber ?? "");
}

export async function syncFirewalls(orgId: string, tenantId: string): Promise<CentralFirewall[]> {
  const res = await callCentral<{ items: CentralFirewall[] }>({
    mode: "firewalls",
    orgId,
    tenantId,
  });
  return res.items;
}

// ── Firewall Groups ──

export interface CentralFirewallGroup {
  id: string;
  name: string;
  firewalls?: { items?: Array<{ id: string }> };
}

export async function getFirewallGroups(
  orgId: string,
  tenantId: string,
): Promise<CentralFirewallGroup[]> {
  const res = await callCentral<{ items: CentralFirewallGroup[] }>({
    mode: "firewall-groups",
    orgId,
    tenantId,
  });
  return res.items ?? [];
}

export type FirewallGroupsMergedBundle = {
  items: Array<{ tenantId: string; group: CentralFirewallGroup; members: number }>;
  tenants: CentralTenant[];
};

/** One Edge call for all tenants’ firewall groups; falls back to batched per-tenant calls if the mode is missing. */
export async function getFirewallGroupsMerged(orgId: string): Promise<FirewallGroupsMergedBundle> {
  try {
    return await callCentral<FirewallGroupsMergedBundle>(
      { mode: "firewall-groups-merged", orgId },
      { timeoutMs: 120_000, retries: 0 },
    );
  } catch {
    const tenants = await getCachedTenants(orgId);
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length === 0) return { items: [], tenants: [] };

    const rows = await mapTenantBatches(
      tenantIds,
      async (tenantId) => {
        try {
          const items = await getFirewallGroups(orgId, tenantId);
          return items.map((g) => ({
            tenantId,
            group: g,
            members: g.firewalls?.items?.length ?? 0,
          }));
        } catch {
          return [] as FirewallGroupsMergedBundle["items"];
        }
      },
      { batchSize: 8 },
    );
    return { items: rows.flat(), tenants };
  }
}

// ── Alerts ──

/** Managed asset on a Central alert (firewall, computer, server, …). */
export interface CentralManagedAgent {
  id: string;
  type: string;
  /** Computer / endpoint display name when Central returns it. */
  name?: string;
  hostname?: string;
  computerName?: string;
  showAs?: string;
  displayName?: string;
}

export interface CentralAlert {
  id: string;
  description: string;
  severity: string;
  category: string;
  product: string;
  /** Sophos event id, e.g. `Event::Firewall::FirewallAdvancedThreatProtection`. */
  type?: string;
  raisedAt: string;
  allowedActions: string[];
  managedAgent?: CentralManagedAgent;
  /** Some alert payloads expose the source name at the top level. */
  managedAgentName?: string;
  hostname?: string;
  computerName?: string;
  /** Present on some API payloads; newer than `raisedAt` when Central updates an open alert. */
  lastModifiedAt?: string;
  updatedAt?: string;
}

/** @see central-alert-timestamps — latest Sophos instant among raised / modified / reported / created. */
export function centralAlertRaisedAt(alert: CentralAlert | Record<string, unknown>): string {
  return centralAlertRaisedAtFromFields(alert as Record<string, unknown>);
}

export async function getAlerts(orgId: string, tenantId: string): Promise<CentralAlert[]> {
  const res = await callCentral<{ items: CentralAlert[] }>({ mode: "alerts", orgId, tenantId });
  return res.items ?? [];
}

export type MissionAlertsBundle = {
  items: Array<CentralAlert & { tenantId: string }>;
  tenants: CentralTenant[];
};

/** Per-tenant calls from the browser — used if the `mission-alerts` edge mode is unavailable or errors. */
async function fetchMissionAlertsLegacy(orgId: string): Promise<MissionAlertsBundle> {
  const tenants = await getCachedTenants(orgId);
  const tenantIds = tenants.map((t) => t.id);
  if (tenantIds.length === 0) return { items: [], tenants: [] };

  const rows = await mapTenantBatches(
    tenantIds,
    async (tenantId) => {
      try {
        const items = await getAlerts(orgId, tenantId);
        return items.map((a) => ({ ...a, tenantId }));
      } catch {
        return [] as Array<CentralAlert & { tenantId: string }>;
      }
    },
    { batchSize: 8 },
  );
  rows.sort((a, b) => {
    const ra = centralAlertRaisedAt(a);
    const rb = centralAlertRaisedAt(b);
    if (ra < rb) return 1;
    if (ra > rb) return -1;
    return 0;
  });
  return { items: rows.slice(0, 300), tenants };
}

/**
 * Prefer one `mission-alerts` edge call; fall back to cached tenants + batched `alerts` calls
 * so Mission Control still works if the function is not deployed yet or returns an error.
 */
export async function getMissionAlertsBundle(orgId: string): Promise<MissionAlertsBundle> {
  try {
    return await callCentral({ mode: "mission-alerts", orgId }, { timeoutMs: 120_000, retries: 0 });
  } catch {
    return fetchMissionAlertsLegacy(orgId);
  }
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
  const res = await callCentral<{ licenses: CentralLicence[] }>({
    mode: "licenses",
    orgId,
    tenantId,
  });
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

export async function getFirewallLicences(
  orgId: string,
  tenantId?: string,
): Promise<FirewallLicence[]> {
  const res = await callCentral<{ items: FirewallLicence[] }>({
    mode: "firewall-licenses",
    orgId,
    tenantId,
  });
  return res.items ?? [];
}

// ── MDR Threat Feed ──

export async function getMdrThreatFeed(orgId: string, tenantId: string): Promise<unknown[]> {
  const res = await callCentral<{ items: unknown[] }>({ mode: "mdr-threat-feed", orgId, tenantId });
  return res.items ?? [];
}

/** One Edge call for all tenants (parallel on server); falls back to batched per-tenant calls if the mode is missing. */
export type MdrThreatFeedMergedBundle = {
  items: unknown[];
  tenants: CentralTenant[];
};

export async function getMdrThreatFeedMerged(orgId: string): Promise<MdrThreatFeedMergedBundle> {
  try {
    return await callCentral<MdrThreatFeedMergedBundle>(
      { mode: "mdr-threat-feed-merged", orgId },
      { timeoutMs: 120_000, retries: 0 },
    );
  } catch {
    const tenants = await getCachedTenants(orgId);
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length === 0) return { items: [], tenants: [] };

    const rows = await mapTenantBatches(
      tenantIds,
      async (tenantId) => {
        try {
          const items = await getMdrThreatFeed(orgId, tenantId);
          return (items ?? []).map((it) =>
            it && typeof it === "object"
              ? { ...(it as Record<string, unknown>), tenantId }
              : { tenantId, value: String(it) },
          );
        } catch {
          return [] as unknown[];
        }
      },
      { batchSize: 8 },
    );
    return { items: rows.flat(), tenants };
  }
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

export async function getCachedFirewalls(
  orgId: string,
  tenantId?: string,
): Promise<
  Array<{
    rowId: string;
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
  }>
> {
  let q = supabase.from("central_firewalls").select("*").eq("org_id", orgId);
  if (tenantId) q = q.eq("central_tenant_id", tenantId);
  const { data } = await q.order("hostname");
  return (data ?? []).map((r) => ({
    /** DB row id — use for Assess `fleetContext` / Fleet row identity. */
    rowId: r.id,
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
