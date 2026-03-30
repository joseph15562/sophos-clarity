/**
 * api-public — Public (unauthenticated) routes.
 * Shared reports, passkey login, and guest config upload flows.
 * Gateway JWT is DISABLED; routes use token-based auth or none.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { runConfigUploadCleanup } from "../_shared/auth.ts";
import { adminClient, json as jsonResponse, safeDbError, safeError } from "../_shared/db.ts";
import {
  buildCustomerUploadEmailHtml,
  buildSeNotificationEmailHtml,
  escapeHtml,
  isValidSophosXml,
  MAX_CONFIG_SIZE,
  sendConfigUploadEmail,
} from "../_shared/email.ts";
import {
  sophosFetchFirewalls,
  sophosFetchTenants,
  sophosGetToken,
  sophosWhoAmI,
} from "../_shared/sophos-central-api.ts";
import { centralDecrypt, centralEncrypt } from "../_shared/crypto.ts";
import { logJson } from "../_shared/logger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const APP_URL = Deno.env.get("ALLOWED_ORIGIN") ?? "https://sophos-firecomply.vercel.app";

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return jsonResponse(body, status, corsHeaders);
}

// ── Shared report (public, token-based) ──

async function handleShared(token: string, corsHeaders: Record<string, string>) {
  const db = adminClient();
  const { data, error } = await db
    .from("shared_reports")
    .select("share_token, markdown, customer_name, expires_at, created_at, allow_download, advisor_notes")
    .eq("share_token", token)
    .maybeSingle();

  if (error) return json({ error: safeDbError(error) }, 500, corsHeaders);
  if (!data) return json({ error: "Report not found" }, 404, corsHeaders);

  const expiresAt = new Date(data.expires_at);
  if (expiresAt <= new Date()) return json({ error: "Report has expired" }, 410, corsHeaders);

  return json({
    share_token: data.share_token,
    markdown: data.markdown,
    customer_name: data.customer_name,
    expires_at: data.expires_at,
    created_at: data.created_at,
    allow_download: (data as { allow_download?: boolean }).allow_download !== false,
    advisor_notes: (data as { advisor_notes?: string | null }).advisor_notes ?? null,
  }, 200, corsHeaders);
}

// ── Shared SE health check (public, token-based) ──

async function handleSharedHealthCheck(token: string, corsHeaders: Record<string, string>) {
  const db = adminClient();
  const { data, error } = await db
    .from("se_health_checks")
    .select("share_token, shared_html, customer_name, share_expires_at, checked_at")
    .eq("share_token", token)
    .maybeSingle();

  if (error) return json({ error: safeDbError(error) }, 500, corsHeaders);
  if (!data) return json({ error: "Health check not found" }, 404, corsHeaders);

  const expiresAt = new Date(data.share_expires_at);
  if (expiresAt <= new Date()) return json({ error: "This shared health check has expired" }, 410, corsHeaders);

  return json({
    share_token: data.share_token,
    html: data.shared_html,
    customer_name: data.customer_name,
    expires_at: data.share_expires_at,
    checked_at: data.checked_at,
  }, 200, corsHeaders);
}

// ── Passkey login (unauthenticated) ──

async function handlePasskeyLoginOptions(req: Request, corsHeaders: Record<string, string>) {
  const body = await req.json();
  const { email } = body;
  if (!email) return json({ error: "email required" }, 400, corsHeaders);

  const db = adminClient();
  const { data: users } = await db.auth.admin.listUsers();
  const targetUser = users?.users?.find((u: any) => u.email === email);
  if (!targetUser) return json({ error: "User not found" }, 404, corsHeaders);

  const { data: creds } = await db
    .from("passkey_credentials")
    .select("credential_id, transports")
    .eq("user_id", targetUser.id)
    .limit(50);

  const loginOrigin = req.headers.get("origin") ?? "";
  const loginRpId = loginOrigin ? new URL(loginOrigin).hostname : new URL(SUPABASE_URL).hostname;

  const options = {
    challenge: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
    timeout: 60000,
    rpId: loginRpId,
    allowCredentials: (creds ?? []).map((c: any) => ({
      id: c.credential_id,
      type: "public-key",
      transports: c.transports,
    })),
    userVerification: "preferred",
  };

  return json(options, 200, corsHeaders);
}

async function handlePasskeyLoginVerify(req: Request, corsHeaders: Record<string, string>) {
  const body = await req.json();
  const { email, credential } = body;
  if (!email || !credential) return json({ error: "email and credential required" }, 400, corsHeaders);

  const db = adminClient();
  const { data: users } = await db.auth.admin.listUsers();
  const targetUser = users?.users?.find((u: any) => u.email === email);
  if (!targetUser) return json({ error: "User not found" }, 404, corsHeaders);

  const { data: stored } = await db
    .from("passkey_credentials")
    .select("*")
    .eq("user_id", targetUser.id)
    .eq("credential_id", credential.id)
    .maybeSingle();

  if (!stored) return json({ error: "Passkey not found" }, 404, corsHeaders);

  await db
    .from("passkey_credentials")
    .update({ counter: (stored.counter as number) + 1 })
    .eq("id", stored.id);

  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: targetUser.email!,
  });

  if (linkError || !linkData) {
    return json({ error: "Failed to create session" }, 500, corsHeaders);
  }

  const tokenHash = linkData.properties?.hashed_token;
  if (tokenHash) {
    const { data: sessionData, error: sessionError } = await db.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });
    if (!sessionError && sessionData?.session) {
      return json({ ok: true, session: sessionData.session }, 200, corsHeaders);
    }
  }

  return json({
    ok: true,
    session: null,
    message: "Passkey verified but session creation failed — please sign in with password",
  }, 200, corsHeaders);
}

// ── Config upload guest routes (public, token-based) ──

async function handleConfigUploadPublic(
  req: Request,
  token: string,
  subRoute: string | null,
  corsHeaders: Record<string, string>,
) {
  const db = adminClient();

  // GET /config-upload/:token — public status check
  if (req.method === "GET" && !subRoute) {
    await runConfigUploadCleanup();

    const { data, error } = await db
      .from("config_upload_requests")
      .select("status, customer_name, expires_at, file_name, central_connected_at, central_data, central_linked_firewall_id, central_linked_firewall_name")
      .eq("token", token)
      .maybeSingle();

    if (error) return json({ error: safeDbError(error) }, 500, corsHeaders);
    if (!data) return json({ error: "Upload link not found" }, 404, corsHeaders);
    if (new Date(data.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410, corsHeaders);

    return json({
      status: data.status,
      customer_name: data.customer_name,
      expires_at: data.expires_at,
      file_name: data.file_name,
      central_connected: !!data.central_connected_at,
      central_tenants: data.central_data ? (data.central_data as Record<string, unknown>).tenants ?? null : null,
      central_firewalls: data.central_data ? (data.central_data as Record<string, unknown>).firewalls ?? null : null,
      central_account_type: data.central_data ? (data.central_data as Record<string, unknown>).accountType ?? null : null,
      central_linked_firewall_id: data.central_linked_firewall_id,
      central_linked_firewall_name: data.central_linked_firewall_name,
    }, 200, corsHeaders);
  }

  // POST /config-upload/:token — customer uploads XML
  if (req.method === "POST" && !subRoute) {
    const { data: existing, error: fetchErr } = await db
      .from("config_upload_requests")
      .select("id, status, expires_at, se_email, customer_name, se_user_id")
      .eq("token", token)
      .maybeSingle();

    if (fetchErr) return json({ error: safeDbError(fetchErr) }, 500, corsHeaders);
    if (!existing) return json({ error: "Upload link not found" }, 404, corsHeaders);
    if (new Date(existing.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410, corsHeaders);
    if (existing.status === "downloaded") return json({ error: "This configuration has already been downloaded by the SE. Please request a new upload link." }, 409, corsHeaders);

    const contentType = req.headers.get("content-type") ?? "";
    let xmlContent = "";
    let fileName = "entities.xml";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof File)) return json({ error: "No file provided" }, 400, corsHeaders);
      if (file.size > MAX_CONFIG_SIZE) return json({ error: "File exceeds 10 MB limit" }, 413, corsHeaders);
      fileName = file.name || "entities.xml";
      xmlContent = await file.text();
    } else {
      const contentLength = parseInt(req.headers.get("content-length") ?? "0");
      if (contentLength > MAX_CONFIG_SIZE) return json({ error: "File exceeds 10 MB limit" }, 413, corsHeaders);
      xmlContent = await req.text();
    }

    if (!xmlContent.trim()) return json({ error: "Empty file" }, 400, corsHeaders);

    if (!isValidSophosXml(xmlContent)) {
      return json({
        error: "This doesn't appear to be a Sophos firewall configuration export. Please export your entities.xml from Sophos Firewall and try again.",
      }, 422, corsHeaders);
    }

    const { error: updateErr } = await db
      .from("config_upload_requests")
      .update({
        config_xml: xmlContent,
        file_name: fileName,
        status: "uploaded",
        uploaded_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateErr) return json({ error: safeDbError(updateErr) }, 500, corsHeaders);

    if (existing.se_email) {
      const { data: freshRow } = await db
        .from("config_upload_requests")
        .select("central_connected_at, central_linked_firewall_name")
        .eq("id", existing.id)
        .maybeSingle();
      let centralNote = "";
      if (freshRow?.central_connected_at) {
        centralNote = freshRow.central_linked_firewall_name
          ? `<p style="margin:0 0 12px;">The customer also connected <strong>Sophos Central</strong> (linked to firewall: <strong>${escapeHtml(freshRow.central_linked_firewall_name)}</strong>).</p>`
          : `<p style="margin:0 0 12px;">The customer also connected <strong>Sophos Central</strong>.</p>`;
      }
      let seName = "";
      if (existing.se_user_id) {
        const { data: seProfile } = await db
          .from("se_profiles")
          .select("display_name, health_check_prepared_by")
          .eq("id", existing.se_user_id)
          .maybeSingle();
        seName = seProfile?.display_name || seProfile?.health_check_prepared_by || "";
      }
      const notifHtml = buildSeNotificationEmailHtml(existing.customer_name ?? "", `${APP_URL}/health-check-2`, centralNote, seName);
      await sendConfigUploadEmail(
        existing.se_email,
        `Config received${existing.customer_name ? ` from ${existing.customer_name}` : ""}`,
        notifHtml,
      );
    }

    return json({ ok: true, message: "Configuration uploaded successfully" }, 200, corsHeaders);
  }

  // POST /config-upload/:token/central-connect
  if (req.method === "POST" && subRoute === "central-connect") {
    const { data: row, error: fetchErr } = await db
      .from("config_upload_requests")
      .select("id, status, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (fetchErr) return json({ error: safeDbError(fetchErr) }, 500, corsHeaders);
    if (!row) return json({ error: "Upload request not found" }, 404, corsHeaders);
    if (new Date(row.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410, corsHeaders);

    const body = await req.json();
    const { client_id, client_secret } = body as { client_id?: string; client_secret?: string };
    if (!client_id?.trim() || !client_secret?.trim()) {
      return json({ error: "Client ID and Client Secret are required" }, 400, corsHeaders);
    }

    try {
      const accessToken = await sophosGetToken(client_id.trim(), client_secret.trim());
      const identity = await sophosWhoAmI(accessToken);
      const tenants = await sophosFetchTenants(accessToken, identity);

      let centralData: Record<string, unknown> = {
        accountType: identity.idType,
        tenants,
      };

      if (tenants.length === 1) {
        const fwData = await sophosFetchFirewalls(accessToken, identity, tenants[0].id, tenants);
        centralData = { ...centralData, ...fwData, selectedTenantId: tenants[0].id };
      }

      const encClientId = await centralEncrypt(client_id.trim());
      const encClientSecret = await centralEncrypt(client_secret.trim());

      await db
        .from("config_upload_requests")
        .update({
          central_client_id_enc: encClientId,
          central_client_secret_enc: encClientSecret,
          central_data: centralData,
          central_connected_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      return json({
        ok: true,
        account_type: identity.idType,
        tenants: tenants.map((t) => ({ id: t.id, name: t.name })),
        firewalls: (centralData as Record<string, unknown>).firewalls ?? null,
      }, 200, corsHeaders);
    } catch (err) {
      return json({ error: safeError(err, "Central connection failed") }, 400, corsHeaders);
    }
  }

  // POST /config-upload/:token/central-firewalls
  if (req.method === "POST" && subRoute === "central-firewalls") {
    const { data: row, error: fetchErr } = await db
      .from("config_upload_requests")
      .select("id, expires_at, central_client_id_enc, central_client_secret_enc, central_data")
      .eq("token", token)
      .maybeSingle();
    if (fetchErr) return json({ error: safeDbError(fetchErr) }, 500, corsHeaders);
    if (!row) return json({ error: "Upload request not found" }, 404, corsHeaders);
    if (new Date(row.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410, corsHeaders);
    if (!row.central_client_id_enc) return json({ error: "Central not connected yet" }, 400, corsHeaders);

    const body = await req.json();
    const { tenant_id } = body as { tenant_id?: string };
    if (!tenant_id?.trim()) return json({ error: "tenant_id is required" }, 400, corsHeaders);

    try {
      const clientId = await centralDecrypt(row.central_client_id_enc, async (re) => {
        await db.from("config_upload_requests").update({ central_client_id_enc: re }).eq("id", row.id);
      });
      const clientSecret = await centralDecrypt(row.central_client_secret_enc, async (re) => {
        await db.from("config_upload_requests").update({ central_client_secret_enc: re }).eq("id", row.id);
      });
      const accessToken = await sophosGetToken(clientId, clientSecret);
      const identity = await sophosWhoAmI(accessToken);
      const tenants = (row.central_data as Record<string, unknown>)?.tenants as Array<{ id: string; apiHost?: string }> ?? [];
      const fwData = await sophosFetchFirewalls(accessToken, identity, tenant_id.trim(), tenants);

      const updatedCentralData = { ...(row.central_data as Record<string, unknown>), ...fwData, selectedTenantId: tenant_id.trim() };
      await db
        .from("config_upload_requests")
        .update({ central_data: updatedCentralData })
        .eq("id", row.id);

      return json({ ok: true, firewalls: fwData.firewalls }, 200, corsHeaders);
    } catch (err) {
      return json({ error: safeError(err, "Failed to fetch firewalls") }, 400, corsHeaders);
    }
  }

  // POST /config-upload/:token/central-link
  if (req.method === "POST" && subRoute === "central-link") {
    const { data: row, error: fetchErr } = await db
      .from("config_upload_requests")
      .select("id, expires_at, central_connected_at")
      .eq("token", token)
      .maybeSingle();
    if (fetchErr) return json({ error: safeDbError(fetchErr) }, 500, corsHeaders);
    if (!row) return json({ error: "Upload request not found" }, 404, corsHeaders);
    if (new Date(row.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410, corsHeaders);
    if (!row.central_connected_at) return json({ error: "Central not connected yet" }, 400, corsHeaders);

    const body = await req.json();
    const { firewall_id, firewall_name } = body as { firewall_id?: string; firewall_name?: string };
    if (!firewall_id?.trim()) return json({ error: "firewall_id is required" }, 400, corsHeaders);

    await db
      .from("config_upload_requests")
      .update({
        central_linked_firewall_id: firewall_id.trim(),
        central_linked_firewall_name: (firewall_name?.trim()) || null,
      })
      .eq("id", row.id);

    return json({ ok: true }, 200, corsHeaders);
  }

  return null;
}

// ── Main router ──

export async function handleApiPublicRequest(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const match = path.match(/\/api-public\/?(.*)$/);
    const rest = (match ? match[1] : path).replace(/\/$/, "") || "";
    const segments = rest.split("/").filter(Boolean);

    // GET /shared/:token
    if (req.method === "GET" && segments[0] === "shared" && segments.length === 2) {
      return await handleShared(segments[1], corsHeaders);
    }

    // GET /shared-health-check/:token
    if (req.method === "GET" && segments[0] === "shared-health-check" && segments.length === 2) {
      return await handleSharedHealthCheck(segments[1], corsHeaders);
    }

    // POST /passkey/login-options
    if (req.method === "POST" && segments[0] === "passkey" && segments[1] === "login-options") {
      return await handlePasskeyLoginOptions(req, corsHeaders);
    }

    // POST /passkey/login-verify
    if (req.method === "POST" && segments[0] === "passkey" && segments[1] === "login-verify") {
      return await handlePasskeyLoginVerify(req, corsHeaders);
    }

    // /config-upload/:token[/sub-route] — guest flows
    if (segments[0] === "config-upload" && segments.length >= 2) {
      const token = segments[1];
      const subRoute = segments[2] ?? null;
      const result = await handleConfigUploadPublic(req, token, subRoute, corsHeaders);
      if (result) return result;
    }

    logJson("warn", "api_public_not_found", {
      method: req.method,
      path: url.pathname,
      segments: segments.join("/"),
    });
    return json({ error: "Not found" }, 404, corsHeaders);
  } catch (err) {
    logJson("error", "api_public_unhandled", {
      detail: err instanceof Error ? err.message : String(err),
    });
    return json({ error: safeError(err) }, 500, corsHeaders);
  }
}

serve((req: Request) => handleApiPublicRequest(req));
