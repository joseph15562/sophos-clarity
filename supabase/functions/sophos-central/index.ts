import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SOPHOS_TOKEN_URL = "https://id.sophos.com/api/v2/oauth2/token";
const SOPHOS_WHOAMI_URL = "https://api.central.sophos.com/whoami/v1";
const SOPHOS_GLOBAL_URL = "https://api.central.sophos.com";

const ENCRYPTION_KEY = Deno.env.get("CENTRAL_ENCRYPTION_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ── AES-256-GCM encryption helpers ──

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(secret.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" }, false, ["encrypt", "decrypt"],
  );
  return keyMaterial;
}

async function encrypt(plaintext: string): Promise<string> {
  if (!ENCRYPTION_KEY) throw new Error("CENTRAL_ENCRYPTION_KEY not configured");
  const key = await deriveKey(ENCRYPTION_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, enc.encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
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
    { name: "AES-GCM", iv }, key, ciphertext,
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

async function getToken(clientId: string, clientSecret: string): Promise<TokenResponse> {
  const res = await fetch(SOPHOS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&scope=token`,
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

async function sophosGet(url: string, token: string, headers: Record<string, string> = {}) {
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
  baseUrl: string, token: string, headers: Record<string, string>,
  pageSize = 100,
): Promise<unknown[]> {
  const items: unknown[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}page=${page}&pageSize=${pageSize}${page === 1 ? "&pageTotal=true" : ""}`;
    const data = await sophosGet(url, token, headers);
    if (data.items) items.push(...data.items);
    if (page === 1 && data.pages?.total) totalPages = data.pages.total;
    page++;
  } while (page <= totalPages);
  return items;
}

// ── Verify the calling user belongs to the given org ──

async function verifyOrgMembership(authHeader: string, orgId: string): Promise<string> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
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

async function loadCredentials(orgId: string): Promise<{ clientId: string; clientSecret: string; partnerId: string; partnerType: string; apiHosts: Record<string, string> } | null> {
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const body = await req.json().catch(() => ({}));
    const { mode, orgId } = body as { mode: string; orgId?: string };

    // ── Mode: connect ── validate + store credentials
    if (mode === "connect") {
      const { clientId, clientSecret } = body as { clientId: string; clientSecret: string };
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

      return json({ ok: true, partnerId: identity.id, partnerType: identity.idType, apiHosts: identity.apiHosts });
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
        .select("partner_id, partner_type, api_hosts, connected_at, last_synced_at")
        .eq("org_id", orgId)
        .single();
      if (!data) return json({ connected: false });
      return json({ connected: true, ...data });
    }

    // ── All remaining modes require stored credentials ──
    if (!orgId) return json({ error: "Missing orgId" }, 400);
    await verifyOrgMembership(authHeader, orgId);
    const creds = await loadCredentials(orgId);
    if (!creds) return json({ error: "No Central credentials configured. Connect first." }, 400);

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
        return json({
          items: [{
            id: identity.id,
            name: "(This tenant)",
            dataRegion: identity.apiHosts.dataRegion?.replace("https://api-", "").replace(".central.sophos.com", "") ?? "",
            apiHost: identity.apiHosts.dataRegion ?? identity.apiHosts.global,
            billingType: "",
          }],
        });
      }

      const endpoint = creds.partnerType === "partner"
        ? `${SOPHOS_GLOBAL_URL}/partner/v1/tenants`
        : `${SOPHOS_GLOBAL_URL}/organization/v1/tenants`;

      const items = await fetchAllPages(endpoint, token, multiTenancyHeader);

      const sb = adminClient();
      const rows = (items as Array<{ id: string; name?: string; showAs?: string; dataRegion?: string; apiHost?: string; billingType?: string }>).map((t) => ({
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
          await sb.from("central_tenants").upsert(rows.slice(i, i + BATCH), { onConflict: "org_id,central_tenant_id" });
        }
      }

      await sb.from("central_credentials").update({ last_synced_at: new Date().toISOString() }).eq("org_id", orgId);

      return json({ items: rows.map((r) => ({ id: r.central_tenant_id, name: r.name, dataRegion: r.data_region, apiHost: r.api_host, billingType: r.billing_type })) });
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
        if (!apiHost) return json({ error: "Tenant not found. Sync tenants first." }, 400);
      }

      const items = await fetchAllPages(
        `${apiHost}/firewall/v1/firewalls`,
        token,
        { "X-Tenant-ID": tenantId },
      );

      const sb = adminClient();
      const fwRows = (items as Array<Record<string, unknown>>).map((fw: Record<string, unknown>) => ({
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
        await sb.from("central_firewalls").delete().eq("org_id", orgId).eq("central_tenant_id", tenantId);
        await sb.from("central_firewalls").upsert(fwRows, { onConflict: "org_id,firewall_id" });
      }

      return json({ items });
    }

    // ── Mode: firewall-detail ── return full raw API response for a single firewall (for discovering available fields)
    if (mode === "firewall-detail") {
      const { tenantId, firewallId } = body as { tenantId: string; firewallId: string };
      if (!tenantId || !firewallId) return json({ error: "Missing tenantId or firewallId" }, 400);
      const apiHost = await resolveApiHost(orgId, tenantId, creds, token);
      const data = await sophosGet(
        `${apiHost}/firewall/v1/firewalls/${firewallId}`,
        token,
        { "X-Tenant-ID": tenantId },
      );
      return json(data);
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

    // ── Mode: licenses ── fetch licence info for a tenant
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
      } catch {
        return json({ items: [], note: "MDR threat feed not available for this tenant" });
      }
    }

    return json({ error: `Unknown mode: ${mode}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("sophos-central error:", message);
    return json({ error: message }, 500);
  }
});

// ── Helpers ──

async function resolveApiHost(
  orgId: string, tenantId: string,
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
