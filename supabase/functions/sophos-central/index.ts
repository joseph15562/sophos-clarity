import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jwtVerify } from "https://esm.sh/jose@4.15.4?target=deno";
import { safeError } from "../_shared/db.ts";
import { logJson } from "../_shared/logger.ts";
import {
  DEMO_ORG_ID,
  demoCentralAlerts,
  demoCentralFirewallLicenses,
  demoCentralFirewalls,
  demoCentralLicenses,
  demoCentralMdrThreatFeed,
  demoCentralStatus,
  demoCentralTenants,
  demoFirewallGroupsMerged,
  demoMdrThreatFeedMerged,
  demoMissionAlerts,
} from "../_shared/demo-central-data.ts";
import { apiHostFromDataRegion } from "../_shared/sophos-central-api.ts";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:4173",
  "https://sophos-firecomply.vercel.app",
  Deno.env.get("ALLOWED_ORIGIN") ?? "",
].filter(Boolean);

/** Any http port on loopback — Vite may use 8081+ when 8080 is busy; missing CORS → browser "Failed to fetch". */
function isLocalHttpLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:") return false;
    return u.hostname === "localhost" || u.hostname === "127.0.0.1" ||
      u.hostname === "[::1]";
  } catch {
    return false;
  }
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : isLocalHttpLoopbackOrigin(origin)
    ? origin
    : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

let corsHeaders: Record<string, string> = {};

const SOPHOS_TOKEN_URL = "https://id.sophos.com/api/v2/oauth2/token";
const SOPHOS_WHOAMI_URL = "https://api.central.sophos.com/whoami/v1";
const SOPHOS_GLOBAL_URL = "https://api.central.sophos.com";

const ENCRYPTION_KEY = Deno.env.get("CENTRAL_ENCRYPTION_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** Project ref from https://<ref>.supabase.co */
function projectRefFromSupabaseUrl(su: string): string {
  try {
    const host = new URL(su.trim()).hostname;
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return m?.[1] ?? "";
  } catch {
    return "";
  }
}

/** When SUPABASE_ANON_KEY is missing or out of sync, still accept a valid anon JWT for this project. */
async function verifyGuestAnonJwt(
  token: string,
  jwtSecret: string,
  supabaseUrl: string,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret),
      { algorithms: ["HS256"] },
    );
    const role = payload["role"];
    const ref = payload["ref"];
    const expectedRef = projectRefFromSupabaseUrl(supabaseUrl);
    return role === "anon" && typeof ref === "string" && ref === expectedRef &&
      expectedRef.length > 0;
  } catch {
    return false;
  }
}

/** Decode JWT payload only (no sig check). Used with gateway check below — invalid sig → PostgREST returns 401. */
function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const rem = b64.length % 4;
    if (rem) b64 += "=".repeat(4 - rem);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Hosted Edge does not expose SUPABASE_JWT_SECRET by default (see Supabase “Default secrets”).
 * If string compare to SUPABASE_ANON_KEY fails (drift), ask the API gateway to validate the key
 * and require it to be a valid anon-level key for this project (reject service_role).
 *
 * Supports both legacy JWT anon keys and new sb_publishable_* format keys.
 */
async function verifyGuestAnonViaSupabaseGateway(
  supabaseUrl: string,
  incoming: string,
): Promise<boolean> {
  const isPublishableKey = incoming.startsWith("sb_publishable_");

  if (!isPublishableKey) {
    const payload = decodeJwtPayloadUnsafe(incoming);
    if (!payload || payload["role"] !== "anon") return false;
    const ref = payload["ref"];
    const expectedRef = projectRefFromSupabaseUrl(supabaseUrl);
    if (typeof ref !== "string" || ref !== expectedRef || !expectedRef) {
      return false;
    }
  }

  const base = supabaseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/rest/v1/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${incoming}`,
        apikey: incoming,
      },
    });
    return res.status !== 401 && res.status !== 403;
  } catch {
    return false;
  }
}

// ── AES-256-GCM encryption helpers ──

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return keyMaterial;
}

async function encrypt(plaintext: string): Promise<string> {
  if (!ENCRYPTION_KEY) throw new Error("CENTRAL_ENCRYPTION_KEY not configured");
  const key = await deriveKey(ENCRYPTION_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );
  const combined = new Uint8Array(
    iv.length + new Uint8Array(ciphertext).length,
  );
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encoded: string): Promise<string> {
  if (!ENCRYPTION_KEY) throw new Error("CENTRAL_ENCRYPTION_KEY not configured");
  const key = await deriveKey(ENCRYPTION_KEY);
  const raw = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

// ── Supabase admin client ──

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Sophos Central OAuth token ──

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

async function getToken(
  clientId: string,
  clientSecret: string,
): Promise<TokenResponse> {
  const res = await fetch(SOPHOS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${
      encodeURIComponent(clientId)
    }&client_secret=${encodeURIComponent(clientSecret)}&scope=token`,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sophos auth failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Sophos Central API helpers ──

interface WhoAmIResponse {
  id: string;
  idType: "partner" | "organization" | "tenant";
  apiHosts: { global: string; dataRegion?: string };
}

async function whoami(token: string): Promise<WhoAmIResponse> {
  const res = await fetch(SOPHOS_WHOAMI_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`WhoAmI failed (${res.status})`);
  return res.json();
}

/** Row shape from `central_tenants` when building merged per-tenant calls. */
type CentralTenantCacheRow = {
  central_tenant_id: string;
  name: string | null;
  api_host: string | null;
  data_region: string | null;
};

/**
 * Tenant-type service principals are scoped to exactly one Sophos tenant. For merged modes we
 * must use `whoami().id` as `X-Tenant-ID` and the current regional host — not whatever happens
 * to be in `central_tenants` (stale/wrong UUIDs yield empty alerts with silent per-tenant errors).
 */
async function resolveTenantCredentialTenantRows(
  token: string,
  cachedRows: CentralTenantCacheRow[],
): Promise<
  | { ok: true; rows: CentralTenantCacheRow[]; tenantApiHost: string }
  | { ok: false; error: string }
> {
  const identity = await whoami(token);
  const tenantApiHost = String(
    identity.apiHosts.dataRegion ?? identity.apiHosts.global ?? "",
  ).trim();
  if (!tenantApiHost) {
    return {
      ok: false,
      error:
        "Sophos whoAmI did not return a regional API host for this tenant credential. Reconnect Central in settings.",
    };
  }
  const match = cachedRows.find((r) => r.central_tenant_id === identity.id);
  return {
    ok: true,
    rows: [{
      central_tenant_id: identity.id,
      name: (match?.name ?? "").trim() || "(This tenant)",
      api_host: tenantApiHost,
      data_region: match?.data_region ?? "",
    }],
    tenantApiHost,
  };
}

async function sophosGet(
  url: string,
  token: string,
  headers: Record<string, string> = {},
) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sophos API error (${res.status}): ${text}`);
  }
  return res.json();
}

type SophosPagedItems = {
  items?: unknown[];
  pages?: {
    total?: number;
    /** Cursor for the next slice; GET `/common/v1/alerts` documents `pageFromKey`, not only numeric `page`. */
    nextKey?: string;
  };
};

/**
 * Paginated Sophos list. Alerts often return `pages.nextKey` + `pageFromKey` (Postman); numeric `page`
 * alone may not advance, leaving only the **oldest** slice. Other list endpoints keep using `page`.
 */
async function fetchAllPages(
  baseUrl: string,
  token: string,
  headers: Record<string, string>,
  pageSize = 100,
  options?: { maxPagesIfTotalUnknown?: number },
): Promise<unknown[]> {
  const maxIfUnknown = options?.maxPagesIfTotalUnknown ?? 50;
  const useAlertCursor = baseUrl.includes("/common/v1/alerts");
  const items: unknown[] = [];
  let page = 1;
  let reportedTotal: number | null = null;
  let followingCursor = false;
  let cursor: string | undefined;
  const maxSteps = 60;

  for (let step = 0; step < maxSteps; step++) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = useAlertCursor && followingCursor && cursor
      ? `${baseUrl}${sep}pageSize=${pageSize}&pageFromKey=${
        encodeURIComponent(cursor)
      }`
      : `${baseUrl}${sep}page=${page}&pageSize=${pageSize}${
        page === 1 ? "&pageTotal=true" : ""
      }`;

    const data = await sophosGet(url, token, headers) as SophosPagedItems;
    const batch = Array.isArray(data.items) ? data.items : [];
    items.push(...batch);

    if (
      !followingCursor && page === 1 &&
      typeof data.pages?.total === "number" && data.pages.total > 0
    ) {
      reportedTotal = data.pages.total;
    }

    const nextKey = typeof data.pages?.nextKey === "string"
      ? data.pages.nextKey.trim()
      : "";

    if (batch.length < pageSize) break;

    if (useAlertCursor && nextKey) {
      followingCursor = true;
      cursor = nextKey;
      continue;
    }

    if (followingCursor && !nextKey) break;

    followingCursor = false;
    cursor = undefined;

    if (reportedTotal != null) {
      if (page >= reportedTotal) break;
    } else {
      if (page >= maxIfUnknown) break;
    }
    page++;
  }

  return items;
}

/**
 * `GET /common/v1/alerts` (paginated). We intentionally omit `sort=` here: some tenants/regions
 * return 400 for `sort=raisedAt:desc` on GET, and mission-alerts used to `catch` → `[]`, so the
 * UI showed **no alerts** while Central still listed open items. Newest-first order is applied
 * after fetch via `merged.sort` on normalized `raisedAt`.
 */
function centralOpenAlertsListUrl(apiHost: string): string {
  return `${apiHost}/common/v1/alerts`;
}

/** Central `/common/v1/alerts` items sometimes use snake_case or only `createdAt` — normalize for clients. */
function pickAlertTimeString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

const ALERT_TIME_FIELD_KEYS = [
  "lastModifiedAt",
  "last_modified_at",
  "updatedAt",
  "updated_at",
  "when",
  "whenAt",
  "when_at",
  "occurredAt",
  "occurred_at",
  "eventAt",
  "event_at",
  "firstDetectedAt",
  "first_detected_at",
  "lastDetectedAt",
  "last_detected_at",
  "detectedAt",
  "detected_at",
  "raisedAt",
  "raised_at",
  "reportedAt",
  "reported_at",
  "createdAt",
  "created_at",
] as const;

function instantMsFromAlertString(s: string): number | null {
  const t = s.trim();
  if (t.length < 4) return null;
  if (/^\d{10,16}$/.test(t)) {
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    if (t.length === 10) return n * 1000;
    if (t.length >= 13) return n;
    if (n >= 1_000_000_000_000) return n;
    return n * 1000;
  }
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : ms;
}

function alertFieldInstantMs(
  a: Record<string, unknown>,
  key: string,
): number | null {
  const v = a[key];
  if (typeof v === "number" && Number.isFinite(v)) {
    return v > 1e12 ? v : v * 1000;
  }
  const s = pickAlertTimeString(v);
  if (!s) return null;
  return instantMsFromAlertString(s);
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** Root + one nested object level; matches app `centralAlertRaisedAt`. */
function alertBestInstantMs(a: Record<string, unknown>): number | null {
  let bestMs: number | null = null;
  const consider = (ms: number | null) => {
    if (ms == null) return;
    if (bestMs === null || ms > bestMs) bestMs = ms;
  };
  for (const k of ALERT_TIME_FIELD_KEYS) {
    consider(alertFieldInstantMs(a, k));
  }
  for (const v of Object.values(a)) {
    if (!isPlainRecord(v)) continue;
    for (const k of ALERT_TIME_FIELD_KEYS) {
      consider(alertFieldInstantMs(v, k));
    }
  }
  return bestMs;
}

/** Sort key after normalize; falls back to `alertBestInstantMs` if `raisedAt` is missing or unparseable. */
function mergedAlertRaisedMs(a: Record<string, unknown>): number {
  const s = String(a.raisedAt ?? "").trim();
  if (s) {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;
  }
  return alertBestInstantMs(a) ?? 0;
}

/** Single `raisedAt` for clients: latest meaningful instant (matches app `centralAlertRaisedAt`). */
function normalizeSophosAlertItem(
  a: Record<string, unknown>,
): Record<string, unknown> {
  const bestMs = alertBestInstantMs(a);
  if (bestMs === null) return a;
  return { ...a, raisedAt: new Date(bestMs).toISOString() };
}

// ── Verify the calling user belongs to the given org ──

async function verifyOrgMembership(
  authHeader: string,
  orgId: string,
): Promise<string> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await sb.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (error || !user) throw new Error("Unauthorized");
  const admin = adminClient();
  const { data } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();
  if (!data) throw new Error("User is not a member of this organisation");
  return user.id;
}

// ── Load stored credentials for an org ──

async function loadCredentials(
  orgId: string,
): Promise<
  {
    clientId: string;
    clientSecret: string;
    partnerId: string;
    partnerType: string;
    apiHosts: Record<string, string>;
  } | null
> {
  const sb = adminClient();
  const { data } = await sb
    .from("central_credentials")
    .select("*")
    .eq("org_id", orgId)
    .single();
  if (!data) return null;
  return {
    clientId: await decrypt(data.encrypted_client_id),
    clientSecret: await decrypt(data.encrypted_client_secret),
    partnerId: data.partner_id,
    partnerType: data.partner_type,
    apiHosts: data.api_hosts ?? {},
  };
}

// ── Main handler ──

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const body = await req.json().catch(() => ({}));
    const { mode, orgId } = body as { mode: string; orgId?: string };

    // ── Guest SE health check (ephemeral credentials; never stored) ──
    // Authorization must be the Supabase anon/publishable key (same as the web client).
    if (
      mode === "guest_health_ping" ||
      mode === "guest_health_tenants" ||
      mode === "guest_health_firewalls" ||
      mode === "guest_health_firewall_licenses"
    ) {
      const publishable = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
      const jwtSecret =
        (Deno.env.get("SUPABASE_JWT_SECRET") ?? Deno.env.get("JWT_SECRET") ??
          "").trim();
      const supabaseUrl = SUPABASE_URL.trim();
      const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
      const apikeyHeader =
        (req.headers.get("apikey") ?? req.headers.get("x-api-key") ?? "")
          .trim();
      const incoming = bearer || apikeyHeader;

      if (!incoming) {
        return json({ error: "Unauthorized" }, 401);
      }

      let guestAuthOk = publishable.length > 0 && incoming === publishable;
      if (!guestAuthOk && jwtSecret.length > 0 && supabaseUrl.length > 0) {
        guestAuthOk = await verifyGuestAnonJwt(
          incoming,
          jwtSecret,
          supabaseUrl,
        );
      }
      if (!guestAuthOk && supabaseUrl.length > 0) {
        guestAuthOk = await verifyGuestAnonViaSupabaseGateway(
          supabaseUrl,
          incoming,
        );
      }

      if (!guestAuthOk) {
        logJson("warn", "sophos_central_guest_auth_failed", {
          publishableLen: publishable.length,
          incomingLen: incoming.length,
          hadJwtSecret: jwtSecret.length > 0,
          hadSupabaseUrl: supabaseUrl.length > 0,
          hadBearer: bearer.length > 0,
          hadApikeyHeader: apikeyHeader.length > 0,
          stringMatch: publishable.length > 0 && incoming === publishable,
        });
        return json({ error: "Unauthorized" }, 401);
      }

      const { clientId, clientSecret, tenantId } = body as {
        clientId?: string;
        clientSecret?: string;
        tenantId?: string;
      };
      if (!clientId?.trim() || !clientSecret?.trim()) {
        return json({ error: "Missing clientId or clientSecret" }, 400);
      }

      const tokenRes = await getToken(clientId.trim(), clientSecret.trim());
      const token = tokenRes.access_token;
      const identity = await whoami(token);

      if (mode === "guest_health_ping") {
        return json({
          ok: true,
          partnerType: identity.idType,
          partnerId: identity.id,
          apiHosts: identity.apiHosts,
        });
      }

      if (mode === "guest_health_tenants") {
        if (identity.idType === "tenant") {
          const apiHost = identity.apiHosts.dataRegion ??
            identity.apiHosts.global;
          let name = "(This tenant)";
          try {
            const acctInfo = await sophosGet(
              `${apiHost}/account-info/v1/account-info`,
              token,
              { "X-Tenant-ID": identity.id },
            ) as { name?: string; showAs?: string };
            if (acctInfo.showAs || acctInfo.name) {
              name = (acctInfo.showAs ?? acctInfo.name) as string;
            }
          } catch (_) { /* account-info not available */ }
          if (name === "(This tenant)") {
            try {
              const tenantList = await fetchAllPages(
                `${apiHost}/organization/v1/tenants`,
                token,
                { "X-Tenant-ID": identity.id },
                1,
              ) as Array<{ id: string; name?: string; showAs?: string }>;
              const self = tenantList?.find((t) => t.id === identity.id);
              if (self && (self.showAs ?? self.name)) {
                name = (self.showAs ?? self.name) as string;
              }
            } catch (_) { /* optional name */ }
          }
          return json({
            items: [{
              id: identity.id,
              name,
              dataRegion: "",
              apiHost,
              billingType: "",
            }],
          });
        }

        const multiHeader = identity.idType === "partner"
          ? { "X-Partner-ID": identity.id }
          : { "X-Organization-ID": identity.id };
        const endpoint = identity.idType === "partner"
          ? `${SOPHOS_GLOBAL_URL}/partner/v1/tenants`
          : `${SOPHOS_GLOBAL_URL}/organization/v1/tenants`;
        const items = await fetchAllPages(
          endpoint,
          token,
          multiHeader,
        ) as Array<{
          id: string;
          name?: string;
          showAs?: string;
          dataRegion?: string;
          apiHost?: string;
          billingType?: string;
        }>;
        return json({
          items: items.map((t) => ({
            id: t.id,
            name: t.showAs ?? t.name ?? "",
            dataRegion: t.dataRegion ?? "",
            apiHost: t.apiHost ?? "",
            billingType: t.billingType ?? "",
          })),
        });
      }

      // guest_health_firewall_licenses — same Licensing API as MSP firewall-licenses mode
      if (mode === "guest_health_firewall_licenses") {
        if (!tenantId?.trim()) return json({ error: "Missing tenantId" }, 400);
        const tidLic = tenantId.trim();
        if (identity.idType === "tenant" && tidLic !== identity.id) {
          return json(
            { error: "Tenant ID does not match this API client" },
            400,
          );
        }
        const licHeaders: Record<string, string> = {};
        if (identity.idType === "partner") {
          licHeaders["X-Partner-ID"] = identity.id;
        } else if (identity.idType === "organization") {
          licHeaders["X-Organization-ID"] = identity.id;
        } else if (identity.idType === "tenant") {
          licHeaders["X-Tenant-ID"] = identity.id;
        }
        if (tidLic && !licHeaders["X-Tenant-ID"]) {
          licHeaders["X-Tenant-ID"] = tidLic;
        }
        const licenseItems = await fetchAllPages(
          `${SOPHOS_GLOBAL_URL}/licenses/v1/licenses/firewalls`,
          token,
          licHeaders,
        );
        return json({ items: licenseItems });
      }

      // guest_health_firewalls
      if (!tenantId?.trim()) return json({ error: "Missing tenantId" }, 400);
      const tid = tenantId.trim();

      let apiHost: string;
      if (identity.idType === "tenant") {
        if (tid !== identity.id) {
          return json(
            { error: "Tenant ID does not match this API client" },
            400,
          );
        }
        apiHost = identity.apiHosts.dataRegion ?? identity.apiHosts.global;
      } else {
        const multiHeader = identity.idType === "partner"
          ? { "X-Partner-ID": identity.id }
          : { "X-Organization-ID": identity.id };
        const endpoint = identity.idType === "partner"
          ? `${SOPHOS_GLOBAL_URL}/partner/v1/tenants`
          : `${SOPHOS_GLOBAL_URL}/organization/v1/tenants`;
        const items = await fetchAllPages(
          endpoint,
          token,
          multiHeader,
        ) as Array<{ id: string; apiHost?: string }>;
        const row = items.find((t) => t.id === tid);
        apiHost = row?.apiHost ?? "";
        if (!apiHost) {
          return json({
            error: "Tenant not found or API host missing — check tenant ID",
          }, 400);
        }
      }

      const fwItems = await fetchAllPages(
        `${apiHost}/firewall/v1/firewalls`,
        token,
        { "X-Tenant-ID": tid },
      );
      return json({ items: fwItems });
    }

    // ── Demo workspace intercept ──
    // Return canned data for the demo org; never call live Sophos API.
    if (orgId && orgId === DEMO_ORG_ID) {
      await verifyOrgMembership(authHeader, orgId);

      if (mode === "status") return json(demoCentralStatus());
      if (mode === "tenants") return json(demoCentralTenants());
      if (mode === "firewalls") {
        const { tenantId } = body as { tenantId?: string };
        return json(demoCentralFirewalls(tenantId ?? ""));
      }
      if (mode === "alerts") {
        const { tenantId } = body as { tenantId?: string };
        return json(demoCentralAlerts(tenantId ?? ""));
      }
      if (mode === "mission-alerts") return json(demoMissionAlerts());
      if (mode === "licenses") {
        const { tenantId } = body as { tenantId?: string };
        return json(demoCentralLicenses(tenantId ?? ""));
      }
      if (mode === "firewall-licenses") {
        const { tenantId } = body as { tenantId?: string };
        return json(demoCentralFirewallLicenses(tenantId));
      }
      if (mode === "mdr-threat-feed") return json(demoCentralMdrThreatFeed());
      if (mode === "mdr-threat-feed-merged") {
        return json(demoMdrThreatFeedMerged());
      }
      if (mode === "connect" || mode === "disconnect") {
        return json({
          error: "Demo workspace — Central connection is pre-configured.",
        }, 400);
      }
      if (mode === "firewall-groups") return json({ items: [] });
      if (mode === "firewall-groups-merged") {
        return json(demoFirewallGroupsMerged());
      }
      return json({ error: `Unknown mode: ${mode}` }, 400);
    }

    // ── Mode: connect ── validate + store credentials
    if (mode === "connect") {
      const { clientId, clientSecret } = body as {
        clientId: string;
        clientSecret: string;
      };
      if (!orgId || !clientId || !clientSecret) {
        return json({ error: "Missing orgId, clientId, or clientSecret" }, 400);
      }
      await verifyOrgMembership(authHeader, orgId);

      const tokenRes = await getToken(clientId, clientSecret);
      const identity = await whoami(tokenRes.access_token);

      const encId = await encrypt(clientId);
      const encSecret = await encrypt(clientSecret);

      const sb = adminClient();
      await sb.from("central_credentials").upsert({
        org_id: orgId,
        encrypted_client_id: encId,
        encrypted_client_secret: encSecret,
        partner_id: identity.id,
        partner_type: identity.idType,
        api_hosts: identity.apiHosts,
        connected_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "org_id" });

      return json({
        ok: true,
        partnerId: identity.id,
        partnerType: identity.idType,
        apiHosts: identity.apiHosts,
      });
    }

    // ── Mode: disconnect ── remove credentials
    if (mode === "disconnect") {
      if (!orgId) return json({ error: "Missing orgId" }, 400);
      await verifyOrgMembership(authHeader, orgId);
      const sb = adminClient();
      await sb.from("central_credentials").delete().eq("org_id", orgId);
      await sb.from("central_tenants").delete().eq("org_id", orgId);
      await sb.from("central_firewalls").delete().eq("org_id", orgId);
      return json({ ok: true });
    }

    // ── Mode: status ── return connection state without calling Sophos
    if (mode === "status") {
      if (!orgId) return json({ error: "Missing orgId" }, 400);
      await verifyOrgMembership(authHeader, orgId);
      const sb = adminClient();
      const { data } = await sb
        .from("central_credentials")
        .select(
          "partner_id, partner_type, api_hosts, connected_at, last_synced_at",
        )
        .eq("org_id", orgId)
        .single();
      if (!data) return json({ connected: false });
      return json({ connected: true, ...data });
    }

    // ── All remaining modes require stored credentials ──
    if (!orgId) return json({ error: "Missing orgId" }, 400);
    await verifyOrgMembership(authHeader, orgId);
    const creds = await loadCredentials(orgId);
    if (!creds) {
      if (
        mode === "mission-alerts" || mode === "mdr-threat-feed-merged" ||
        mode === "firewall-groups-merged"
      ) {
        return json({ items: [], tenants: [] });
      }
      return json({
        error: "No Central credentials configured. Connect first.",
      }, 400);
    }

    const tokenRes = await getToken(creds.clientId, creds.clientSecret);
    const token = tokenRes.access_token;

    const multiTenancyHeader = creds.partnerType === "partner"
      ? { "X-Partner-ID": creds.partnerId }
      : creds.partnerType === "organization"
      ? { "X-Organization-ID": creds.partnerId }
      : {};

    // ── Mode: tenants ── list all managed tenants (partner/org only)
    if (mode === "tenants") {
      if (creds.partnerType === "tenant") {
        const identity = await whoami(token);
        const apiHost = identity.apiHosts.dataRegion ??
          identity.apiHosts.global;
        let tenantName = "(This tenant)";

        // Try /account-info/v1/account-info for the company display name
        try {
          const acctInfo = await sophosGet(
            `${apiHost}/account-info/v1/account-info`,
            token,
            { "X-Tenant-ID": identity.id },
          ) as { name?: string; showAs?: string };
          if (acctInfo.showAs || acctInfo.name) {
            tenantName = (acctInfo.showAs ?? acctInfo.name) as string;
          }
        } catch (_) {
          /* account-info not available — try org API as fallback */
        }

        if (tenantName === "(This tenant)") {
          try {
            const tenantList = await fetchAllPages(
              `${apiHost}/organization/v1/tenants`,
              token,
              { "X-Tenant-ID": identity.id },
              1,
            ) as Array<{ id: string; name?: string; showAs?: string }>;
            const self = tenantList?.find((t) => t.id === identity.id);
            if (self && (self.showAs ?? self.name)) {
              tenantName = (self.showAs ?? self.name) as string;
            }
          } catch (_) {
            /* org API not available for tenant-type credentials */
          }
        }
        const tenantItem = {
          id: identity.id,
          name: tenantName,
          dataRegion:
            identity.apiHosts.dataRegion?.replace("https://api-", "").replace(
              ".central.sophos.com",
              "",
            ) ?? "",
          apiHost,
          billingType: "",
        };

        const sb = adminClient();
        await sb.from("central_tenants").upsert({
          org_id: orgId,
          central_tenant_id: tenantItem.id,
          name: tenantItem.name,
          data_region: tenantItem.dataRegion,
          api_host: tenantItem.apiHost,
          billing_type: tenantItem.billingType,
          synced_at: new Date().toISOString(),
        }, { onConflict: "org_id,central_tenant_id" });
        await sb.from("central_credentials").update({
          last_synced_at: new Date().toISOString(),
        }).eq("org_id", orgId);

        return json({ items: [tenantItem] });
      }

      const endpoint = creds.partnerType === "partner"
        ? `${SOPHOS_GLOBAL_URL}/partner/v1/tenants`
        : `${SOPHOS_GLOBAL_URL}/organization/v1/tenants`;

      const items = await fetchAllPages(endpoint, token, multiTenancyHeader);

      const sb = adminClient();
      const rows = (items as Array<
        {
          id: string;
          name?: string;
          showAs?: string;
          dataRegion?: string;
          apiHost?: string;
          billingType?: string;
        }
      >).map((t) => {
        const dataRegion = String(t.dataRegion ?? "").trim();
        const explicitHost = String(t.apiHost ?? "").trim();
        const derivedHost = explicitHost || apiHostFromDataRegion(dataRegion);
        return {
          org_id: orgId,
          central_tenant_id: t.id,
          name: t.showAs ?? t.name ?? "",
          data_region: dataRegion,
          api_host: derivedHost,
          billing_type: t.billingType ?? "",
          synced_at: new Date().toISOString(),
        };
      });

      if (rows.length > 0) {
        await sb.from("central_tenants").delete().eq("org_id", orgId);
        const BATCH = 500;
        for (let i = 0; i < rows.length; i += BATCH) {
          await sb.from("central_tenants").upsert(rows.slice(i, i + BATCH), {
            onConflict: "org_id,central_tenant_id",
          });
        }
      }

      await sb.from("central_credentials").update({
        last_synced_at: new Date().toISOString(),
      }).eq("org_id", orgId);

      return json({
        items: rows.map((r) => ({
          id: r.central_tenant_id,
          name: r.name,
          dataRegion: r.data_region,
          apiHost: r.api_host,
          billingType: r.billing_type,
        })),
      });
    }

    // ── Mode: firewalls ── list firewalls for a specific tenant
    if (mode === "firewalls") {
      const { tenantId } = body as { tenantId: string };
      if (!tenantId) return json({ error: "Missing tenantId" }, 400);

      let apiHost: string;
      try {
        apiHost = await resolveTenantScopedApiHost(
          orgId,
          tenantId,
          creds,
          token,
        );
      } catch (e) {
        return json({ error: safeError(e) }, 400);
      }

      const items = await fetchAllPages(
        `${apiHost}/firewall/v1/firewalls`,
        token,
        { "X-Tenant-ID": tenantId },
      );

      const sb = adminClient();
      // Always clear this tenant's cache so an empty Central response does not leave stale rows.
      await sb.from("central_firewalls").delete().eq("org_id", orgId).eq(
        "central_tenant_id",
        tenantId,
      );

      const fwRows = (items as Array<Record<string, unknown>>).map((
        fw: Record<string, unknown>,
      ) => ({
        org_id: orgId,
        central_tenant_id: tenantId,
        firewall_id: String(fw.id ?? "").trim(),
        serial_number: (fw.serialNumber as string) ?? "",
        hostname: (fw.hostname as string) ?? "",
        name: (fw.name as string) ?? "",
        firmware_version: (fw.firmwareVersion as string) ?? "",
        model: (fw.model as string) ?? "",
        status_json: fw.status ?? {},
        cluster_json: fw.cluster ?? null,
        group_json: fw.group ?? null,
        external_ips: fw.externalIpv4Addresses ?? [],
        geo_location: fw.geoLocation ?? null,
        synced_at: new Date().toISOString(),
      })).filter((row) => row.firewall_id.length > 0);

      if (fwRows.length > 0) {
        await sb.from("central_firewalls").upsert(fwRows, {
          onConflict: "org_id,firewall_id",
        });
      }

      return json({ items });
    }

    // ── Mode: firewall-groups ── list firewall groups for a tenant
    if (mode === "firewall-groups") {
      const { tenantId } = body as { tenantId: string };
      if (!tenantId) return json({ error: "Missing tenantId" }, 400);

      const apiHost = await resolveApiHost(orgId, tenantId, creds, token);
      const items = await fetchAllPages(
        `${apiHost}/firewall/v1/firewall-groups`,
        token,
        { "X-Tenant-ID": tenantId },
      );
      return json({ items });
    }

    // ── Mode: firewall-groups-merged ── all tenants (Central Groups page)
    if (mode === "firewall-groups-merged") {
      const sb = adminClient();
      const { data: tenantRows, error: trErr } = await sb
        .from("central_tenants")
        .select("central_tenant_id, name, api_host, data_region")
        .eq("org_id", orgId)
        .order("name");

      if (trErr) return json({ error: safeError(trErr) }, 500);

      type TenantRow = {
        central_tenant_id: string;
        name: string | null;
        api_host: string | null;
        data_region: string | null;
      };

      let rows: TenantRow[] = (tenantRows ?? []) as TenantRow[];

      let tenantApiHost: string | null = null;
      if (creds.partnerType === "tenant") {
        const r = await resolveTenantCredentialTenantRows(token, rows);
        if (!r.ok) return json({ error: r.error }, 502);
        rows = r.rows as TenantRow[];
        tenantApiHost = r.tenantApiHost;
      }

      const GROUPS_MERGED_PARALLEL = 16;

      type GroupMergedRow = {
        tenantId: string;
        group: Record<string, unknown>;
        members: number;
      };
      const mergedOut: GroupMergedRow[] = [];

      for (let i = 0; i < rows.length; i += GROUPS_MERGED_PARALLEL) {
        const chunk = rows.slice(i, i + GROUPS_MERGED_PARALLEL);
        const batch = await Promise.all(
          chunk.map(async (row) => {
            const tid = row.central_tenant_id;
            try {
              const apiHost = creds.partnerType === "tenant"
                ? (tenantApiHost as string)
                : resolveApiHostFromCachedTenantRow(row, creds);
              if (!apiHost) return [] as GroupMergedRow[];
              const items = await fetchAllPages(
                `${apiHost}/firewall/v1/firewall-groups`,
                token,
                { "X-Tenant-ID": tid },
              );
              return (items as Record<string, unknown>[]).map((g) => {
                const fw = g.firewalls as { items?: unknown[] } | undefined;
                const members = Array.isArray(fw?.items) ? fw.items.length : 0;
                return { tenantId: tid, group: g, members };
              });
            } catch (err) {
              logJson("warn", "sophos_central_firewall_groups_merged_tenant", {
                tenantId: tid,
                error: err instanceof Error ? err.message : String(err),
              });
              return [] as GroupMergedRow[];
            }
          }),
        );
        for (const part of batch) mergedOut.push(...part);
      }

      return json({
        items: mergedOut,
        tenants: rows.map((r) => ({
          id: r.central_tenant_id,
          name: r.name ?? "",
          dataRegion: r.data_region ?? "",
          apiHost: r.api_host ?? "",
          billingType: "",
        })),
      });
    }

    // ── Mode: alerts ── fetch alerts for a tenant
    if (mode === "alerts") {
      const { tenantId } = body as { tenantId: string };
      if (!tenantId) return json({ error: "Missing tenantId" }, 400);

      const apiHost = await resolveApiHost(orgId, tenantId, creds, token);
      const items = await fetchAllPages(
        centralOpenAlertsListUrl(apiHost),
        token,
        { "X-Tenant-ID": tenantId },
      );
      return json({
        items: (items as Record<string, unknown>[]).map((x) =>
          normalizeSophosAlertItem(x)
        ),
      });
    }

    // ── Mode: mission-alerts ── all tenants' open alerts in one call (Mission Control)
    if (mode === "mission-alerts") {
      const sb = adminClient();
      const { data: tenantRows, error: trErr } = await sb
        .from("central_tenants")
        .select("central_tenant_id, name, api_host, data_region")
        .eq("org_id", orgId)
        .order("name");

      if (trErr) return json({ error: safeError(trErr) }, 500);

      type TenantRow = {
        central_tenant_id: string;
        name: string | null;
        api_host: string | null;
        data_region: string | null;
      };

      let rows: TenantRow[] = (tenantRows ?? []) as TenantRow[];

      let tenantApiHost: string | null = null;
      if (creds.partnerType === "tenant") {
        const r = await resolveTenantCredentialTenantRows(token, rows);
        if (!r.ok) return json({ error: r.error }, 502);
        rows = r.rows as TenantRow[];
        tenantApiHost = r.tenantApiHost;
      }

      const MISSION_ALERT_PARALLEL = 16;
      type Merged = Record<string, unknown> & { tenantId: string };
      const merged: Merged[] = [];

      for (let i = 0; i < rows.length; i += MISSION_ALERT_PARALLEL) {
        const chunk = rows.slice(i, i + MISSION_ALERT_PARALLEL);
        const batch = await Promise.all(
          chunk.map(async (row) => {
            const tid = row.central_tenant_id;
            try {
              const apiHost = creds.partnerType === "tenant"
                ? (tenantApiHost as string)
                : resolveApiHostFromCachedTenantRow(row, creds);
              if (!apiHost) return [] as Merged[];
              const items = await fetchAllPages(
                centralOpenAlertsListUrl(apiHost),
                token,
                { "X-Tenant-ID": tid },
              );
              return (items as Record<string, unknown>[]).map((a) => ({
                ...normalizeSophosAlertItem(a),
                tenantId: tid,
              }));
            } catch (err) {
              logJson("warn", "sophos_central_mission_alerts_tenant", {
                tenantId: tid,
                error: err instanceof Error ? err.message : String(err),
              });
              return [] as Merged[];
            }
          }),
        );
        for (const part of batch) merged.push(...part);
      }

      merged.sort(
        (a, b) => mergedAlertRaisedMs(b) - mergedAlertRaisedMs(a),
      );

      const items = merged.slice(0, 300);

      return json({
        items,
        tenants: rows.map((r) => ({
          id: r.central_tenant_id,
          name: r.name ?? "",
          dataRegion: r.data_region ?? "",
          apiHost: r.api_host ?? "",
          billingType: "",
        })),
      });
    }

    // ── Mode: licenses ── fetch licence info for a tenant (legacy)
    if (mode === "licenses") {
      const { tenantId } = body as { tenantId: string };
      if (!tenantId) return json({ error: "Missing tenantId" }, 400);

      const data = await sophosGet(
        `${SOPHOS_GLOBAL_URL}/licenses/v1/licenses`,
        token,
        { "X-Tenant-ID": tenantId },
      );
      return json(data);
    }

    // ── Mode: firewall-licenses ── per-firewall license data via Licensing API
    // https://developer.sophos.com/docs/licensing-v1/1/routes/licenses/firewalls/get
    if (mode === "firewall-licenses") {
      const { tenantId } = body as { tenantId?: string };

      const headers: Record<string, string> = {};
      if (creds.partnerType === "partner") {
        headers["X-Partner-ID"] = creds.partnerId;
      } else if (creds.partnerType === "organization") {
        headers["X-Organization-ID"] = creds.partnerId;
      } else if (creds.partnerType === "tenant") {
        headers["X-Tenant-ID"] = creds.partnerId;
      }

      if (tenantId && !headers["X-Tenant-ID"]) {
        headers["X-Tenant-ID"] = tenantId;
      }

      const items = await fetchAllPages(
        `${SOPHOS_GLOBAL_URL}/licenses/v1/licenses/firewalls`,
        token,
        headers,
      );
      return json({ items });
    }

    // ── Mode: mdr-threat-feed ── fetch MDR threat feed indicators
    if (mode === "mdr-threat-feed") {
      const { tenantId } = body as { tenantId: string };
      if (!tenantId) return json({ error: "Missing tenantId" }, 400);

      const apiHost = await resolveApiHost(orgId, tenantId, creds, token);
      try {
        const data = await sophosGet(
          `${apiHost}/firewall/v1/mdr-threat-feed`,
          token,
          { "X-Tenant-ID": tenantId },
        );
        return json(data);
      } catch (err) {
        logJson("warn", "sophos_central_mdr_threat_feed", {
          error: err instanceof Error ? err.message : String(err),
        });
        return json({
          items: [],
          note: "MDR threat feed not available for this tenant",
        });
      }
    }

    // ── Mode: mdr-threat-feed-merged ── all tenants in one call (Central MDR page)
    if (mode === "mdr-threat-feed-merged") {
      const sb = adminClient();
      const { data: tenantRows, error: trErr } = await sb
        .from("central_tenants")
        .select("central_tenant_id, name, api_host, data_region")
        .eq("org_id", orgId)
        .order("name");

      if (trErr) return json({ error: safeError(trErr) }, 500);

      type TenantRow = {
        central_tenant_id: string;
        name: string | null;
        api_host: string | null;
        data_region: string | null;
      };

      let rows: TenantRow[] = (tenantRows ?? []) as TenantRow[];

      let tenantApiHost: string | null = null;
      if (creds.partnerType === "tenant") {
        const r = await resolveTenantCredentialTenantRows(token, rows);
        if (!r.ok) return json({ error: r.error }, 502);
        rows = r.rows as TenantRow[];
        tenantApiHost = r.tenantApiHost;
      }

      const MDR_MERGED_PARALLEL = 16;

      function mdrItemsFromPayload(data: unknown): unknown[] {
        if (data && typeof data === "object") {
          const it = (data as Record<string, unknown>).items;
          if (Array.isArray(it)) return it;
        }
        if (Array.isArray(data)) return data as unknown[];
        return [];
      }

      type MergedMdr = Record<string, unknown> & { tenantId: string };
      const mergedOut: MergedMdr[] = [];

      for (let i = 0; i < rows.length; i += MDR_MERGED_PARALLEL) {
        const chunk = rows.slice(i, i + MDR_MERGED_PARALLEL);
        const batch = await Promise.all(
          chunk.map(async (row) => {
            const tid = row.central_tenant_id;
            try {
              const apiHost = creds.partnerType === "tenant"
                ? (tenantApiHost as string)
                : resolveApiHostFromCachedTenantRow(row, creds);
              if (!apiHost) return [] as MergedMdr[];
              const data = await sophosGet(
                `${apiHost}/firewall/v1/mdr-threat-feed`,
                token,
                { "X-Tenant-ID": tid },
              );
              const items = mdrItemsFromPayload(data);
              return items.map((item) =>
                item && typeof item === "object"
                  ? {
                    ...(item as Record<string, unknown>),
                    tenantId: tid,
                  } as MergedMdr
                  : { tenantId: tid, value: String(item) } as MergedMdr
              );
            } catch (err) {
              logJson("warn", "sophos_central_mdr_threat_feed_merged_tenant", {
                tenantId: tid,
                error: err instanceof Error ? err.message : String(err),
              });
              return [] as MergedMdr[];
            }
          }),
        );
        for (const part of batch) mergedOut.push(...part);
      }

      return json({
        items: mergedOut,
        tenants: rows.map((r) => ({
          id: r.central_tenant_id,
          name: r.name ?? "",
          dataRegion: r.data_region ?? "",
          apiHost: r.api_host ?? "",
          billingType: "",
        })),
      });
    }

    return json({ error: `Unknown mode: ${mode}` }, 400);
  } catch (err) {
    return json({ error: safeError(err) }, 500);
  }
});

// ── Helpers ──

/** Resolve API host from a `central_tenants` row (no extra DB round-trip). */
function resolveApiHostFromCachedTenantRow(
  row: { api_host?: string | null; data_region?: string | null },
  creds: { partnerType: string; apiHosts: Record<string, string> },
): string {
  const rowHost = String(row.api_host ?? "").trim();
  if (rowHost) return rowHost;
  const fromRegion = apiHostFromDataRegion(
    String(row.data_region ?? "").trim(),
  );
  if (fromRegion) return fromRegion;
  return apiHostFromStoredCreds(creds.apiHosts ?? {});
}

/** Last resort: connector whoami `apiHosts` from stored credentials (JSON). */
function apiHostFromStoredCreds(apiHosts: Record<string, string>): string {
  const dr = String(apiHosts?.dataRegion ?? "").trim();
  const gl = String(apiHosts?.global ?? "").trim();
  if (dr.startsWith("http")) return dr;
  if (gl.startsWith("http")) return gl;
  return "";
}

/**
 * Resolves the regional base URL for firewall/alerts/etc. when `X-Tenant-ID` is set.
 */
async function resolveTenantScopedApiHost(
  orgId: string,
  tenantId: string,
  creds: { partnerType: string; apiHosts: Record<string, string> },
  token: string,
): Promise<string> {
  if (creds.partnerType === "tenant") {
    const identity = await whoami(token);
    return identity.apiHosts.dataRegion ?? identity.apiHosts.global;
  }
  const sb = adminClient();
  const { data } = await sb
    .from("central_tenants")
    .select("api_host, data_region")
    .eq("org_id", orgId)
    .eq("central_tenant_id", tenantId)
    .single();

  const rowHost = String(data?.api_host ?? "").trim();
  if (rowHost) return rowHost;

  const fromRegion = apiHostFromDataRegion(
    String(data?.data_region ?? "").trim(),
  );
  if (fromRegion) return fromRegion;

  const credFallback = apiHostFromStoredCreds(creds.apiHosts ?? {});
  if (credFallback) return credFallback;

  throw new Error(
    "Tenant API host unknown — sync tenants from Central, or check tenant data region in Sophos.",
  );
}

async function resolveApiHost(
  orgId: string,
  tenantId: string,
  creds: { partnerType: string; apiHosts: Record<string, string> },
  token: string,
): Promise<string> {
  return resolveTenantScopedApiHost(orgId, tenantId, creds, token);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
