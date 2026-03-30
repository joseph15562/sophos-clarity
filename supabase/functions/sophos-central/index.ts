import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jwtVerify } from "https://esm.sh/jose@4.15.4?target=deno";
import { safeError } from "../_shared/db.ts";
import { logJson } from "../_shared/logger.ts";

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
 * If string compare to SUPABASE_ANON_KEY fails (drift), ask the API gateway to validate the JWT
 * and require claims role=anon + ref matching this project (reject service_role).
 */
async function verifyGuestAnonViaSupabaseGateway(
  supabaseUrl: string,
  incoming: string,
): Promise<boolean> {
  const payload = decodeJwtPayloadUnsafe(incoming);
  if (!payload || payload["role"] !== "anon") return false;
  const ref = payload["ref"];
  const expectedRef = projectRefFromSupabaseUrl(supabaseUrl);
  if (typeof ref !== "string" || ref !== expectedRef || !expectedRef) {
    return false;
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

async function fetchAllPages(
  baseUrl: string,
  token: string,
  headers: Record<string, string>,
  pageSize = 100,
): Promise<unknown[]> {
  const items: unknown[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}page=${page}&pageSize=${pageSize}${
      page === 1 ? "&pageTotal=true" : ""
    }`;
    const data = await sophosGet(url, token, headers);
    if (data.items) items.push(...data.items);
    if (page === 1 && data.pages?.total) totalPages = data.pages.total;
    page++;
  } while (page <= totalPages);
  return items;
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
      >).map((t) => ({
        org_id: orgId,
        central_tenant_id: t.id,
        name: t.showAs ?? t.name ?? "",
        data_region: t.dataRegion ?? "",
        api_host: t.apiHost ?? "",
        billing_type: t.billingType ?? "",
        synced_at: new Date().toISOString(),
      }));

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
      if (creds.partnerType === "tenant") {
        const identity = await whoami(token);
        apiHost = identity.apiHosts.dataRegion ?? identity.apiHosts.global;
      } else {
        const sb = adminClient();
        const { data: tenantRow } = await sb
          .from("central_tenants")
          .select("api_host")
          .eq("org_id", orgId)
          .eq("central_tenant_id", tenantId)
          .single();
        apiHost = tenantRow?.api_host ?? "";
        if (!apiHost) {
          return json({ error: "Tenant not found. Sync tenants first." }, 400);
        }
      }

      const items = await fetchAllPages(
        `${apiHost}/firewall/v1/firewalls`,
        token,
        { "X-Tenant-ID": tenantId },
      );

      const sb = adminClient();
      const fwRows = (items as Array<Record<string, unknown>>).map((
        fw: Record<string, unknown>,
      ) => ({
        org_id: orgId,
        central_tenant_id: tenantId,
        firewall_id: fw.id as string,
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
      }));

      if (fwRows.length > 0) {
        await sb.from("central_firewalls").delete().eq("org_id", orgId).eq(
          "central_tenant_id",
          tenantId,
        );
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

    // ── Mode: alerts ── fetch alerts for a tenant
    if (mode === "alerts") {
      const { tenantId } = body as { tenantId: string };
      if (!tenantId) return json({ error: "Missing tenantId" }, 400);

      const apiHost = await resolveApiHost(orgId, tenantId, creds, token);
      const items = await fetchAllPages(
        `${apiHost}/common/v1/alerts`,
        token,
        { "X-Tenant-ID": tenantId },
      );
      return json({ items });
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

    return json({ error: `Unknown mode: ${mode}` }, 400);
  } catch (err) {
    return json({ error: safeError(err) }, 500);
  }
});

// ── Helpers ──

async function resolveApiHost(
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
    .select("api_host")
    .eq("org_id", orgId)
    .eq("central_tenant_id", tenantId)
    .single();
  if (!data?.api_host) throw new Error("Tenant not found. Sync tenants first.");
  return data.api_host;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
