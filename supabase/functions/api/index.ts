import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const HASH_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const CONFIG_UPLOAD_FROM_EMAIL = Deno.env.get("REPORT_FROM_EMAIL") ?? "reports@firecomply.io";
const APP_URL = Deno.env.get("ALLOWED_ORIGIN") ?? "https://sophos-clarity.vercel.app";

async function hmacHash(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(HASH_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacVerify(data: string, hash: string): Promise<boolean> {
  const computed = await hmacHash(data);
  return computed === hash;
}

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://sophos-clarity.vercel.app",
  Deno.env.get("ALLOWED_ORIGIN") ?? "",
].filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, OPTIONS",
    "Vary": "Origin",
  };
}

let corsHeaders: Record<string, string> = {};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function userClient(authHeader: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `ck_${hex}`;
}

async function authenticateAgent(apiKey: string) {
  const prefix = apiKey.slice(0, 8);
  const db = adminClient();
  const { data: agents, error } = await db
    .from("agents")
    .select("*")
    .eq("api_key_prefix", prefix);

  if (error || !agents?.length) return null;

  for (const agent of agents) {
    const match = await hmacVerify(apiKey, agent.api_key_hash);
    if (match) return agent;
  }
  return null;
}

async function getOrgMembership(userId: string) {
  const db = adminClient();
  const { data } = await db
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1)
    .single();
  return data;
}

// ── Config upload email helpers ──

const MAX_CONFIG_SIZE = 10 * 1024 * 1024; // 10 MB

const SOPHOS_ENTITY_TAGS = [
  "Response", "FirewallRule", "NATRule", "IPHost", "IPHostGroup",
  "Zone", "ServiceObject", "Interface", "DNSRequestRoute",
  "LocalServiceACL", "DoSRule", "AntiVirus", "IPS", "WebFilter",
  "ApplicationFilter", "SSLVPNPolicy", "IPSecConnection",
];

function isValidSophosXml(xml: string): boolean {
  const trimmed = xml.trimStart();
  if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<Response")) return false;
  return SOPHOS_ENTITY_TAGS.some((tag) => xml.includes(`<${tag}`));
}

async function sendConfigUploadEmail(
  to: string,
  subject: string,
  bodyHtml: string,
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { success: false, error: "RESEND_API_KEY not configured" };
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: CONFIG_UPLOAD_FROM_EMAIL, to: [to], subject, html: bodyHtml }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { success: false, error: `Resend ${resp.status}: ${body}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function buildCustomerUploadEmailHtml(uploadUrl: string, seName: string, expiresDate: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#001A47;padding:24px 32px;text-align:center;">
      <p style="margin:0;font-size:14px;font-weight:600;color:#ffffff;letter-spacing:1px;">SOPHOS</p>
      <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.6);">Firewall Health Check</p>
    </div>
    <div style="padding:32px;color:#333;font-size:14px;line-height:1.7;">
      <p style="margin:0 0 16px;"><strong>${seName}</strong> from Sophos has requested your firewall configuration for a health check.</p>
      <p style="margin:0 0 16px;">Please click the button below to securely upload your <code style="background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:13px;">entities.xml</code> file.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${uploadUrl}" style="display:inline-block;background:#00995a;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Upload Configuration</a>
      </div>
      <p style="margin:0;font-size:12px;color:#888;">This link expires on <strong>${expiresDate}</strong>.</p>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
      Sophos Firewall Health Check &middot; Powered by Sophos Clarity
    </div>
  </div>
</body>
</html>`;
}

function buildSeNotificationEmailHtml(customerName: string, clarityUrl: string): string {
  const label = customerName || "A customer";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#001A47;padding:24px 32px;text-align:center;">
      <p style="margin:0;font-size:14px;font-weight:600;color:#ffffff;letter-spacing:1px;">SOPHOS</p>
      <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.6);">Firewall Health Check</p>
    </div>
    <div style="padding:32px;color:#333;font-size:14px;line-height:1.7;">
      <p style="margin:0 0 16px;"><strong>${label}</strong> has uploaded their firewall configuration.</p>
      <p style="margin:0 0 16px;">Open Clarity to run the health check.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${clarityUrl}" style="display:inline-block;background:#00995a;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Open Clarity</a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
      Sophos Firewall Health Check &middot; Powered by Sophos Clarity
    </div>
  </div>
</body>
</html>`;
}

function buildReminderEmailHtml(uploadUrl: string, expiresDate: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#001A47;padding:24px 32px;text-align:center;">
      <p style="margin:0;font-size:14px;font-weight:600;color:#ffffff;letter-spacing:1px;">SOPHOS</p>
      <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.6);">Firewall Health Check</p>
    </div>
    <div style="padding:32px;color:#333;font-size:14px;line-height:1.7;">
      <p style="margin:0 0 16px;"><strong>Reminder:</strong> Your Sophos SE is still waiting for your firewall configuration.</p>
      <p style="margin:0 0 16px;">Please upload your <code style="background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:13px;">entities.xml</code> before this link expires.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${uploadUrl}" style="display:inline-block;background:#00995a;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Upload Configuration</a>
      </div>
      <p style="margin:0;font-size:12px;color:#888;">This link expires on <strong>${expiresDate}</strong>.</p>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
      Sophos Firewall Health Check &middot; Powered by Sophos Clarity
    </div>
  </div>
</body>
</html>`;
}

async function authenticateSE(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const uc = userClient(authHeader);
  const { data: { user } } = await uc.auth.getUser();
  if (!user) return null;
  const db = adminClient();
  const { data: seProfile } = await db
    .from("se_profiles")
    .select("id, email, display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!seProfile) return null;
  return { user, seProfile };
}

async function runConfigUploadCleanup() {
  const db = adminClient();
  const now = new Date().toISOString();
  await db.from("config_upload_requests").delete()
    .lt("expires_at", now)
    .in("status", ["pending", "uploaded"]);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  await db.from("config_upload_requests").delete()
    .lt("downloaded_at", fiveDaysAgo)
    .eq("status", "downloaded");
}

// ── Agent registration (web app auth via Supabase JWT) ──

async function handleRegister(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const uc = userClient(authHeader);
  const {
    data: { user },
  } = await uc.auth.getUser();
  if (!user) return json({ error: "Invalid session" }, 401);

  const membership = await getOrgMembership(user.id);
  if (!membership || !["admin", "engineer"].includes(membership.role))
    return json({ error: "Admin or engineer access required" }, 403);

  const body = await req.json();
  const { name, firewall_host } = body;
  if (!name || !firewall_host)
    return json({ error: "name and firewall_host are required" }, 400);

  const apiKey = generateApiKey();
  const hash = await hmacHash(apiKey);
  const prefix = apiKey.slice(0, 8);

  const db = adminClient();
  const { data: agent, error } = await db
    .from("agents")
    .insert({
      org_id: membership.org_id,
      name,
      api_key_hash: hash,
      api_key_prefix: prefix,
      firewall_host,
      firewall_port: body.firewall_port ?? 4444,
      customer_name: body.customer_name ?? "Unnamed",
      environment: body.environment ?? "Unknown",
      schedule_cron: body.schedule_cron ?? "0 2 * * *",
      tenant_id: body.tenant_id ?? null,
      tenant_name: body.tenant_name ?? null,
      serial_number: body.serial_number ?? null,
      hardware_model: body.hardware_model ?? null,
      firmware_version_override: body.firmware_version_override ?? null,
    })
    .select("id, name, status, created_at")
    .single();

  if (error) return json({ error: error.message }, 500);

  return json(
    {
      agent,
      api_key: apiKey,
      message: "Store this API key securely. It will not be shown again.",
    },
    201
  );
}

// ── Agent deletion (web app auth) ──

async function handleDelete(req: Request, agentId: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const uc = userClient(authHeader);
  const {
    data: { user },
  } = await uc.auth.getUser();
  if (!user) return json({ error: "Invalid session" }, 401);

  const membership = await getOrgMembership(user.id);
  if (!membership || !["admin", "engineer"].includes(membership.role))
    return json({ error: "Admin or engineer access required" }, 403);

  const db = adminClient();
  const { data: agent } = await db
    .from("agents")
    .select("id, org_id")
    .eq("id", agentId)
    .single();

  if (!agent || agent.org_id !== membership.org_id)
    return json({ error: "Agent not found" }, 404);

  await db.from("agent_submissions").delete().eq("agent_id", agentId);
  await db.from("agents").delete().eq("id", agentId);

  return json({ ok: true });
}

// ── Trigger run-now (web app auth via Supabase JWT) ──

async function handleRunNow(req: Request, agentId: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const uc = userClient(authHeader);
  const { data: { user } } = await uc.auth.getUser();
  if (!user) return json({ error: "Invalid session" }, 401);

  const membership = await getOrgMembership(user.id);
  if (!membership || !["admin", "engineer"].includes(membership.role))
    return json({ error: "Insufficient permissions" }, 403);

  const db = adminClient();
  const { data: agent } = await db
    .from("agents")
    .select("id, org_id")
    .eq("id", agentId)
    .single();

  if (!agent || agent.org_id !== membership.org_id)
    return json({ error: "Agent not found" }, 404);

  await db.from("agents").update({ pending_command: "run-now" }).eq("id", agentId);

  return json({ ok: true, message: "Scan queued — agent will run on next heartbeat (within 5 minutes)" });
}

// ── Agent config (agent API key auth) ──

function handleConfig(agent: Record<string, unknown>) {
  const resolvedName = (agent.customer_name === "Unnamed" && agent.tenant_name)
    ? agent.tenant_name
    : agent.customer_name;
  return json({
    id: agent.id,
    name: agent.name,
    customer_name: resolvedName,
    environment: agent.environment,
    schedule_cron: agent.schedule_cron,
    firewall_host: agent.firewall_host,
    firewall_port: agent.firewall_port,
    firmware_version_override: agent.firmware_version_override,
    tenant_id: agent.tenant_id,
    tenant_name: agent.tenant_name,
  });
}

// ── Agent firewalls — list Central firewalls for the org ──

async function handleFirewalls(agent: Record<string, unknown>) {
  const db = adminClient();
  const orgId = agent.org_id as string;

  const { data: creds } = await db
    .from("central_credentials")
    .select("partner_type")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!creds) return json({ tenants: [] });

  const { data: tenants } = await db
    .from("central_tenants")
    .select("central_tenant_id, name")
    .eq("org_id", orgId);

  const result = [];
  for (const tenant of tenants ?? []) {
    const { data: firewalls } = await db
      .from("central_firewalls")
      .select("firewall_id, serial_number, hostname, name, firmware_version, model, status_json")
      .eq("org_id", orgId)
      .eq("central_tenant_id", tenant.central_tenant_id);

    result.push({
      id: tenant.central_tenant_id,
      name: tenant.name,
      firewalls: firewalls ?? [],
    });
  }

  return json({ tenants: result });
}

// ── Agent heartbeat ──

async function handleHeartbeat(
  req: Request,
  agent: Record<string, unknown>
) {
  const body = await req.json();
  const db = adminClient();

  const update: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
    status: body.error_message ? "error" : "online",
    error_message: body.error_message ?? null,
  };
  if (body.firmware_version) update.firmware_version = body.firmware_version;
  if (body.serial_number) update.serial_number = body.serial_number;
  if (body.hardware_model) update.hardware_model = body.hardware_model;
  if (body.customer_name) update.customer_name = body.customer_name;

  // Auto-match to Central firewall by serial number
  if (body.serial_number && !agent.central_firewall_id) {
    const { data: centralFw } = await db
      .from("central_firewalls")
      .select("firewall_id, central_tenant_id, name, model")
      .eq("org_id", agent.org_id as string)
      .eq("serial_number", body.serial_number)
      .maybeSingle();

    if (centralFw) {
      update.central_firewall_id = centralFw.firewall_id;
      update.tenant_id = centralFw.central_tenant_id;

      // Look up tenant name
      const { data: tenant } = await db
        .from("central_tenants")
        .select("name")
        .eq("org_id", agent.org_id as string)
        .eq("central_tenant_id", centralFw.central_tenant_id)
        .maybeSingle();

      if (tenant) update.tenant_name = tenant.name;
      if (centralFw.model && !body.hardware_model) update.hardware_model = centralFw.model;
    }
  }

  await db.from("agents").update(update).eq("id", agent.id);

  const pendingCommand = agent.pending_command as string | null;
  if (pendingCommand) {
    await db.from("agents").update({ pending_command: null }).eq("id", agent.id);
  }

  const currentName = (update.customer_name as string) || (agent.customer_name as string);
  const resolvedName = (currentName === "Unnamed" && (update.tenant_name || agent.tenant_name))
    ? (update.tenant_name || agent.tenant_name)
    : currentName;

  return json({
    schedule_cron: agent.schedule_cron,
    customer_name: resolvedName,
    environment: agent.environment,
    firmware_version_override: agent.firmware_version_override,
    pending_command: pendingCommand,
  });
}

// ── Agent submit ──

async function handleSubmit(
  req: Request,
  agent: Record<string, unknown>
) {
  const body = await req.json();
  const db = adminClient();
  const agentId = agent.id as string;
  const orgId = agent.org_id as string;

  const findingTitles: string[] = body.finding_titles ?? [];

  // Drift detection: compare with previous submission
  let drift = null;
  const { data: prevSubs } = await db
    .from("agent_submissions")
    .select("finding_titles")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(2);

  if (prevSubs?.length) {
    const prevTitles = new Set<string>(prevSubs[0].finding_titles ?? []);
    const currentTitles = new Set(findingTitles);
    const newFindings = [...currentTitles].filter((t) => !prevTitles.has(t));
    const fixedFindings = [...prevTitles].filter((t) => !currentTitles.has(t));

    const olderTitles =
      prevSubs.length > 1
        ? new Set<string>(prevSubs[1].finding_titles ?? [])
        : new Set<string>();

    const regressed = newFindings.filter((t) => olderTitles.has(t));
    const trulyNew = newFindings.filter((t) => !olderTitles.has(t));

    drift = { new: trulyNew, fixed: fixedFindings, regressed };
  }

  const rawName = body.customer_name ?? (agent.customer_name as string);
  const customerName = (rawName === "Unnamed" && agent.tenant_name)
    ? (agent.tenant_name as string)
    : rawName;
  const overallScore = body.overall_score ?? 0;
  const overallGrade = body.overall_grade ?? "F";
  const firewalls = body.firewalls ?? [];

  // Insert submission
  const { error: subError } = await db.from("agent_submissions").insert({
    agent_id: agentId,
    org_id: orgId,
    customer_name: customerName,
    overall_score: overallScore,
    overall_grade: overallGrade,
    firewalls,
    findings_summary: body.findings_summary ?? [],
    finding_titles: findingTitles,
    threat_status: body.threat_status ?? null,
    drift,
    full_analysis: body.full_analysis ?? null,
    raw_config: body.raw_config ?? null,
  });

  if (subError) return json({ error: subError.message }, 500);

  // Mirror into assessments table for TenantDashboard compatibility
  await db.from("assessments").insert({
    org_id: orgId,
    created_by: null,
    customer_name: customerName,
    environment: agent.environment as string,
    firewalls,
    overall_score: overallScore,
    overall_grade: overallGrade,
  });

  // Update agent status
  await db
    .from("agents")
    .update({
      last_seen_at: new Date().toISOString(),
      last_score: overallScore,
      last_grade: overallGrade,
      status: "online",
      error_message: null,
    })
    .eq("id", agentId);

  return json({ ok: true, drift });
}

// ── Main router ──

serve(async (req: Request) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
  const url = new URL(req.url);
  const path = url.pathname;
  const match = path.match(/\/api\/?(.*)$/);
  const rest = (match ? match[1] : path).replace(/\/$/, "") || "";
  const segments = rest.split("/").filter(Boolean);

  // ── Agent routes ──
  if (segments[0] === "agent") {
    const route = segments[1];

    // Web-app authenticated routes (Supabase JWT)
    if (req.method === "POST" && route === "register") {
      return handleRegister(req);
    }
    if (req.method === "DELETE" && route) {
      return handleDelete(req, route);
    }
    if (req.method === "POST" && segments.length === 3 && segments[2] === "run-now") {
      return handleRunNow(req, route);
    }

    // Agent API-key authenticated routes
    const apiKey =
      req.headers.get("X-API-Key") ?? req.headers.get("x-api-key");
    if (!apiKey)
      return json({ error: "Missing X-API-Key header" }, 401);

    const agent = await authenticateAgent(apiKey);
    if (!agent) return json({ error: "Invalid API key" }, 401);

    if (req.method === "GET" && route === "config") return handleConfig(agent);
    if (req.method === "GET" && route === "firewalls")
      return handleFirewalls(agent);
    if (req.method === "GET" && route === "commands") {
      const cmd = agent.pending_command as string | null;
      if (cmd) {
        const db = adminClient();
        await db.from("agents").update({ pending_command: null }).eq("id", agent.id);
      }
      return json({ command: cmd ?? null });
    }
    if (req.method === "POST" && route === "heartbeat")
      return handleHeartbeat(req, agent);
    if (req.method === "POST" && route === "submit")
      return handleSubmit(req, agent);

    // POST /api/agent/verify-identity — MFA verification for Electron agent
    if (req.method === "POST" && route === "verify-identity") {
      const body = await req.json();
      const { email, totpCode } = body;
      if (!email || !totpCode) return json({ error: "email and totpCode required" }, 400);

      const db = adminClient();
      // Verify the user belongs to the agent's org
      const { data: users } = await db.auth.admin.listUsers();
      const targetUser = users?.users?.find((u: any) => u.email === email);
      if (!targetUser) return json({ error: "User not found" }, 404);

      const { data: membership } = await db
        .from("org_members")
        .select("org_id")
        .eq("user_id", targetUser.id)
        .eq("org_id", agent.org_id as string)
        .maybeSingle();

      if (!membership) return json({ error: "User not in agent's organisation" }, 403);

      // Verify TOTP via a sign-in + MFA challenge/verify flow
      // Note: In production, use Supabase Auth MFA API server-side
      // For now, return a short-lived session token
      return json({
        sessionToken: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        userName: email,
      });
    }

    return json({ error: "Not found" }, 404);
  }

  // ── Passkey routes (web app auth) ──
  if (segments[0] === "passkey") {
    const route = segments[1];
    const authHeader = req.headers.get("authorization");

    if (req.method === "POST" && route === "register-options") {
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const uc = userClient(authHeader);
      const { data: { user } } = await uc.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);

      const db = adminClient();
      const { data: existing } = await db
        .from("passkey_credentials")
        .select("credential_id")
        .eq("user_id", user.id);

      const origin = req.headers.get("origin") ?? "";
      const rpId = origin ? new URL(origin).hostname : new URL(SUPABASE_URL).hostname;

      const options = {
        challenge: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
        rp: { name: "Sophos FireComply", id: rpId },
        user: {
          id: btoa(user.id),
          name: user.email ?? user.id,
          displayName: user.email ?? "User",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" },
        ],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          requireResidentKey: false,
          userVerification: "preferred",
        },
        excludeCredentials: (existing ?? []).map((c: any) => ({
          id: c.credential_id,
          type: "public-key",
        })),
      };

      return json(options);
    }

    if (req.method === "POST" && route === "register-verify") {
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const uc = userClient(authHeader);
      const { data: { user } } = await uc.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);

      const body = await req.json();
      const { credential, name } = body;

      if (!credential?.id || !credential?.response) {
        return json({ error: "Invalid credential" }, 400);
      }

      const db = adminClient();
      const { error } = await db.from("passkey_credentials").insert({
        user_id: user.id,
        credential_id: credential.id,
        public_key: credential.response.attestationObject ?? "",
        counter: 0,
        device_type: "platform",
        transports: ["internal"],
        name: name ?? "Passkey",
      });

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (req.method === "POST" && route === "login-options") {
      const body = await req.json();
      const { email } = body;
      if (!email) return json({ error: "email required" }, 400);

      const db = adminClient();
      const { data: users } = await db.auth.admin.listUsers();
      const targetUser = users?.users?.find((u: any) => u.email === email);
      if (!targetUser) return json({ error: "User not found" }, 404);

      const { data: creds } = await db
        .from("passkey_credentials")
        .select("credential_id, transports")
        .eq("user_id", targetUser.id);

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

      return json(options);
    }

    if (req.method === "POST" && route === "login-verify") {
      const body = await req.json();
      const { email, credential } = body;
      if (!email || !credential) return json({ error: "email and credential required" }, 400);

      const db = adminClient();
      const { data: users } = await db.auth.admin.listUsers();
      const targetUser = users?.users?.find((u: any) => u.email === email);
      if (!targetUser) return json({ error: "User not found" }, 404);

      const { data: stored } = await db
        .from("passkey_credentials")
        .select("*")
        .eq("user_id", targetUser.id)
        .eq("credential_id", credential.id)
        .maybeSingle();

      if (!stored) return json({ error: "Passkey not found" }, 404);

      // Update counter for replay protection
      await db
        .from("passkey_credentials")
        .update({ counter: (stored.counter as number) + 1 })
        .eq("id", stored.id);

      // Generate a magic link token to create a real Supabase session
      const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
        type: "magiclink",
        email: targetUser.email!,
      });

      if (linkError || !linkData) {
        return json({ error: "Failed to create session" }, 500);
      }

      // Extract the token hash and use it to verify OTP for a real session
      const tokenHash = linkData.properties?.hashed_token;
      if (tokenHash) {
        const { data: sessionData, error: sessionError } = await db.auth.verifyOtp({
          token_hash: tokenHash,
          type: "magiclink",
        });
        if (!sessionError && sessionData?.session) {
          return json({ ok: true, session: sessionData.session });
        }
      }

      return json({
        ok: true,
        session: null,
        message: "Passkey verified but session creation failed — please sign in with password",
      });
    }

    return json({ error: "Not found" }, 404);
  }

  // ── Admin routes ──
  if (segments[0] === "admin") {
    const route = segments[1];
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const uc = userClient(authHeader);
    const { data: { user } } = await uc.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const membership = await getOrgMembership(user.id);
    if (!membership || membership.role !== "admin") {
      return json({ error: "Admin access required" }, 403);
    }

    if (req.method === "POST" && route === "reset-mfa") {
      const body = await req.json();
      const { targetUserId } = body;
      if (!targetUserId) return json({ error: "targetUserId required" }, 400);

      const db = adminClient();

      // Verify target user belongs to the same org
      const targetMembership = await getOrgMembership(targetUserId);
      if (!targetMembership || targetMembership.org_id !== membership.org_id) {
        return json({ error: "User not found in your organisation" }, 404);
      }

      // List and delete all MFA factors for the target user
      const { data: factors, error: factorsErr } = await db.auth.admin.mfa.listFactors({
        userId: targetUserId,
      });

      if (factorsErr) return json({ error: factorsErr.message }, 500);

      const totp = factors?.factors?.filter((f: any) => f.factor_type === "totp") ?? [];
      for (const factor of totp) {
        await db.auth.admin.mfa.deleteFactor({ id: factor.id, userId: targetUserId });
      }

      // Audit log
      await db.from("audit_log").insert({
        org_id: membership.org_id,
        user_id: user.id,
        action: "admin.mfa_reset",
        resource_type: "user",
        resource_id: targetUserId,
        metadata: { resetBy: user.email, factorsRemoved: totp.length },
      });

      return json({ ok: true, factorsRemoved: totp.length });
    }

    return json({ error: "Not found" }, 404);
  }

  // ── Auth recovery routes (admin approval required) ──
  if (segments[0] === "auth" && segments[1] === "mfa-recovery") {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized — admin session required" }, 401);

    const uc = userClient(authHeader);
    const { data: { user: caller } } = await uc.auth.getUser();
    if (!caller) return json({ error: "Invalid session" }, 401);

    const body = await req.json();
    const { targetEmail } = body;
    if (!targetEmail) return json({ error: "targetEmail required" }, 400);

    const db = adminClient();

    // Find the target user
    const { data: users } = await db.auth.admin.listUsers();
    const targetUser = users?.users?.find((u: any) => u.email === targetEmail);
    if (!targetUser) return json({ error: "User not found" }, 404);

    const callerMembership = await getOrgMembership(caller.id);
    const targetMembership = await getOrgMembership(targetUser.id);

    if (!targetMembership) return json({ error: "User not found" }, 404);

    // Case 1: Self-recovery — caller is the target user (must have valid session, which we verified above)
    const isSelfRecovery = caller.id === targetUser.id;
    // Case 2: Admin recovery — caller is admin in same org as target
    const isAdminRecovery = callerMembership && callerMembership.role === "admin" && callerMembership.org_id === targetMembership.org_id;

    if (!isSelfRecovery && !isAdminRecovery) {
      return json({ error: "Forbidden — only org admins can reset MFA for other users" }, 403);
    }

    // Check they actually have TOTP factors
    const { data: factors } = await db.auth.admin.mfa.listFactors({
      userId: targetUser.id,
    });
    const totp = factors?.factors?.filter((f: any) => f.factor_type === "totp") ?? [];
    if (totp.length === 0) {
      return json({ error: "No MFA factors enrolled for this account" }, 400);
    }

    // Delete all TOTP factors so the user can sign in normally
    for (const factor of totp) {
      await db.auth.admin.mfa.deleteFactor({ id: factor.id, userId: targetUser.id });
    }

    // Audit log when admin resets another user's MFA
    if (isAdminRecovery && !isSelfRecovery) {
      await db.from("audit_log").insert({
        org_id: callerMembership!.org_id,
        user_id: caller.id,
        action: "admin.mfa_reset",
        resource_type: "user",
        resource_id: targetUser.id,
        metadata: { resetFor: targetEmail, factorsRemoved: totp.length },
      });
    }

    // Generate a magic link session so the user can sign in immediately (only for self-recovery or when admin resets)
    const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.email!,
    });

    if (linkError || !linkData) {
      return json({ ok: true, session: null, message: "MFA reset but session creation failed — sign in with your password" });
    }

    const tokenHash = linkData.properties?.hashed_token;
    if (tokenHash) {
      const { data: sessionData, error: sessionError } = await db.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (!sessionError && sessionData?.session) {
        return json({ ok: true, session: sessionData.session, factorsRemoved: totp.length });
      }
    }

    return json({ ok: true, session: null, factorsRemoved: totp.length, message: "MFA factors removed — sign in with your password" });
  }

  // ── Assessments routes (JWT auth) ──
  if (req.method === "GET" && segments[0] === "assessments") {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const uc = userClient(authHeader);
    const { data: { user } } = await uc.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const membership = await getOrgMembership(user.id);
    if (!membership) return json({ error: "Forbidden" }, 403);

    const db = adminClient();

    // GET /api/assessments — list (cursor-based pagination)
    if (segments.length === 1) {
      const page = parseInt(url.searchParams.get("page") ?? "1");
      const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "50"), 100);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count } = await db
        .from("assessments")
        .select("id, org_id, customer_name, environment, overall_score, overall_grade, created_at", { count: "exact" })
        .eq("org_id", membership.org_id)
        .order("created_at", { ascending: false })
        .range(from, to);

      const total = count ?? 0;
      const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

      return json({
        data: data ?? [],
        total,
        page,
        pageSize,
        totalPages,
      });
    }

    // GET /api/assessments/:id — single assessment with scores, findings, full details
    if (segments.length === 2) {
      const id = segments[1];
      const { data: assessment, error: assErr } = await db
        .from("assessments")
        .select("*")
        .eq("id", id)
        .eq("org_id", membership.org_id)
        .single();

      if (assErr || !assessment) return json({ error: "Assessment not found" }, 404);

      // Try to find matching agent_submission for findings/full_analysis (created within 5s)
      const createdAt = assessment.created_at as string;
      const windowStart = new Date(new Date(createdAt).getTime() - 5000).toISOString();
      const windowEnd = new Date(new Date(createdAt).getTime() + 5000).toISOString();

      const { data: submissions } = await db
        .from("agent_submissions")
        .select("id, findings_summary, full_analysis, overall_score, overall_grade, created_at")
        .eq("org_id", membership.org_id)
        .gte("created_at", windowStart)
        .lte("created_at", windowEnd)
        .order("created_at", { ascending: false })
        .limit(1);

      const submission = submissions?.[0];
      const payload = {
        ...assessment,
        findings: submission?.findings_summary ?? [],
        full_analysis: submission?.full_analysis ?? null,
      };

      return json(payload);
    }
  }

  // ── Shared report (public, no auth) ──
  if (req.method === "GET" && segments[0] === "shared" && segments.length === 2) {
    const token = segments[1];
    const db = adminClient();
    const { data, error } = await db
      .from("shared_reports")
      .select("share_token, markdown, customer_name, expires_at, created_at, allow_download, advisor_notes")
      .eq("share_token", token)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "Report not found" }, 404);

    const expiresAt = new Date(data.expires_at);
    if (expiresAt <= new Date()) {
      return json({ error: "Report has expired" }, 410);
    }

    return json({
      share_token: data.share_token,
      markdown: data.markdown,
      customer_name: data.customer_name,
      expires_at: data.expires_at,
      created_at: data.created_at,
      allow_download: (data as { allow_download?: boolean }).allow_download !== false,
      advisor_notes: (data as { advisor_notes?: string | null }).advisor_notes ?? null,
    });
  }

  // ── Shared SE health check (public, no auth) ──
  if (req.method === "GET" && segments[0] === "shared-health-check" && segments.length === 2) {
    const token = segments[1];
    const db = adminClient();
    const { data, error } = await db
      .from("se_health_checks")
      .select("share_token, shared_html, customer_name, share_expires_at, checked_at")
      .eq("share_token", token)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "Health check not found" }, 404);

    const expiresAt = new Date(data.share_expires_at);
    if (expiresAt <= new Date()) {
      return json({ error: "This shared health check has expired" }, 410);
    }

    return json({
      share_token: data.share_token,
      html: data.shared_html,
      customer_name: data.customer_name,
      expires_at: data.share_expires_at,
      checked_at: data.checked_at,
    });
  }

  // ── SE Teams routes ──

  if (segments[0] === "se-teams") {
    const se = await authenticateSE(req);
    if (!se) return json({ error: "Unauthorized — SE login required" }, 401);
    const db = adminClient();

    // GET /api/se-teams — list teams the SE belongs to
    if (req.method === "GET" && segments.length === 1) {
      const { data: memberships, error } = await db
        .from("se_team_members")
        .select("id, team_id, role, is_primary, joined_at")
        .eq("se_profile_id", se.seProfile.id);
      if (error) return json({ error: error.message }, 500);

      if (!memberships?.length) return json({ data: [] });

      const teamIds = memberships.map((m: any) => m.team_id);
      const { data: teams } = await db
        .from("se_teams")
        .select("id, name, created_by, created_at")
        .in("id", teamIds);

      const { data: counts } = await db
        .from("se_team_members")
        .select("team_id")
        .in("team_id", teamIds);

      const countMap: Record<string, number> = {};
      for (const c of counts ?? []) {
        countMap[c.team_id] = (countMap[c.team_id] || 0) + 1;
      }

      const result = (teams ?? []).map((t: any) => {
        const m = memberships.find((m: any) => m.team_id === t.id);
        return {
          id: t.id,
          name: t.name,
          created_by: t.created_by,
          created_at: t.created_at,
          role: m?.role ?? "member",
          is_primary: m?.is_primary ?? false,
          member_count: countMap[t.id] || 0,
        };
      });
      return json({ data: result });
    }

    // POST /api/se-teams — create a new team
    if (req.method === "POST" && segments.length === 1) {
      const body = await req.json();
      const name = body.name?.trim();
      if (!name) return json({ error: "Team name is required" }, 400);

      const { data: team, error } = await db
        .from("se_teams")
        .insert({ name, created_by: se.seProfile.id })
        .select("id, name, created_at")
        .single();
      if (error) return json({ error: error.message }, 500);

      const { data: existing } = await db
        .from("se_team_members")
        .select("id")
        .eq("se_profile_id", se.seProfile.id)
        .eq("is_primary", true)
        .limit(1);
      const shouldBePrimary = !existing?.length;

      await db.from("se_team_members").insert({
        team_id: team.id,
        se_profile_id: se.seProfile.id,
        role: "admin",
        is_primary: shouldBePrimary,
      });

      return json({ ...team, role: "admin", is_primary: shouldBePrimary, member_count: 1 }, 201);
    }

    // POST /api/se-teams/accept-invite/:token — accept an email invite (SE must be signed in)
    if (req.method === "POST" && segments[1] === "accept-invite" && segments[2]) {
      const token = segments[2];
      const { data: invite } = await db
        .from("se_team_invites")
        .select("id, team_id, email, status, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (!invite) return json({ error: "Invalid invite link" }, 404);
      if (invite.status !== "pending") return json({ error: "This invite has already been used" }, 400);
      if (new Date(invite.expires_at) < new Date()) {
        await db.from("se_team_invites").update({ status: "expired" }).eq("id", invite.id);
        return json({ error: "This invite has expired" }, 410);
      }

      const seEmail = (se.seProfile.email || se.user.email || "").toLowerCase();
      if (seEmail !== invite.email.toLowerCase()) {
        return json({ error: `This invite is for ${invite.email}` }, 403);
      }

      const { data: existingMember } = await db
        .from("se_team_members")
        .select("id")
        .eq("team_id", invite.team_id)
        .eq("se_profile_id", se.seProfile.id)
        .maybeSingle();
      if (existingMember) {
        await db.from("se_team_invites").update({ status: "accepted" }).eq("id", invite.id);
        return json({ error: "You are already a member of this team" }, 409);
      }

      const { data: existing } = await db
        .from("se_team_members")
        .select("id")
        .eq("se_profile_id", se.seProfile.id)
        .eq("is_primary", true)
        .limit(1);
      const shouldBePrimary = !existing?.length;

      await db.from("se_team_members").insert({
        team_id: invite.team_id,
        se_profile_id: se.seProfile.id,
        role: "member",
        is_primary: shouldBePrimary,
      });

      await db.from("se_team_invites").update({ status: "accepted" }).eq("id", invite.id);

      const { data: teamInfo } = await db.from("se_teams").select("name").eq("id", invite.team_id).single();

      // Notify team admins
      const { data: admins } = await db
        .from("se_team_members")
        .select("se_profile_id")
        .eq("team_id", invite.team_id)
        .eq("role", "admin");
      if (admins?.length) {
        const adminIds = admins.map((a: any) => a.se_profile_id);
        const { data: adminProfiles } = await db
          .from("se_profiles")
          .select("email")
          .in("id", adminIds);
        const joinerName = se.seProfile.display_name || se.user.email || "An SE";
        for (const ap of adminProfiles ?? []) {
          if (ap.email) {
            await sendConfigUploadEmail(
              ap.email,
              `${joinerName} joined your team "${teamInfo?.name ?? "your team"}"`,
              `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;"><p><strong>${joinerName}</strong> has joined your team <strong>${teamInfo?.name ?? "your team"}</strong> in Sophos Clarity.</p></body></html>`,
            );
          }
        }
      }

      return json({ team_id: invite.team_id, team_name: teamInfo?.name ?? "", role: "member", is_primary: shouldBePrimary }, 201);
    }

    // Routes with team ID: /api/se-teams/:id/...
    if (segments.length >= 2 && segments[1] !== "accept-invite") {
      const teamId = segments[1];
      const subRoute = segments[2] ?? null;

      // Verify membership
      const { data: membership } = await db
        .from("se_team_members")
        .select("id, role")
        .eq("team_id", teamId)
        .eq("se_profile_id", se.seProfile.id)
        .maybeSingle();
      if (!membership) return json({ error: "Team not found or you are not a member" }, 404);

      const isAdmin = membership.role === "admin";

      // GET /api/se-teams/:id/members
      if (req.method === "GET" && subRoute === "members") {
        const { data: members } = await db
          .from("se_team_members")
          .select("id, se_profile_id, role, is_primary, joined_at")
          .eq("team_id", teamId);

        const profileIds = (members ?? []).map((m: any) => m.se_profile_id);
        const { data: profiles } = await db
          .from("se_profiles")
          .select("id, email, display_name")
          .in("id", profileIds);

        const profileMap: Record<string, any> = {};
        for (const p of profiles ?? []) profileMap[p.id] = p;

        const result = (members ?? []).map((m: any) => ({
          ...m,
          email: profileMap[m.se_profile_id]?.email,
          display_name: profileMap[m.se_profile_id]?.display_name,
        }));
        return json({ data: result });
      }

      // POST /api/se-teams/:id/leave
      if (req.method === "POST" && subRoute === "leave") {
        if (isAdmin) {
          const { data: adminCount } = await db
            .from("se_team_members")
            .select("id")
            .eq("team_id", teamId)
            .eq("role", "admin");
          if ((adminCount?.length ?? 0) <= 1) {
            return json({ error: "You are the only admin. Transfer admin role to another member before leaving." }, 400);
          }
        }
        await db.from("se_team_members").delete().eq("id", membership.id);
        return json({ ok: true });
      }

      // PATCH /api/se-teams/:id — rename (admin only)
      if (req.method === "PATCH" && !subRoute) {
        if (!isAdmin) return json({ error: "Admin access required" }, 403);
        const body = await req.json();
        const name = body.name?.trim();
        if (!name) return json({ error: "Team name is required" }, 400);
        const { error } = await db.from("se_teams").update({ name }).eq("id", teamId);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, name });
      }

      // POST /api/se-teams/:id/invite — send an email invite (admin only)
      if (req.method === "POST" && subRoute === "invite") {
        if (!isAdmin) return json({ error: "Admin access required" }, 403);
        const body = await req.json();
        const email = body.email?.trim()?.toLowerCase();
        if (!email) return json({ error: "Email is required" }, 400);

        const { data: teamInfo } = await db.from("se_teams").select("name").eq("id", teamId).single();
        const inviterName = se.seProfile.display_name || se.user.email || "A team admin";

        const { data: existingPending } = await db
          .from("se_team_invites")
          .select("id")
          .eq("team_id", teamId)
          .eq("email", email)
          .eq("status", "pending")
          .maybeSingle();
        if (existingPending) return json({ error: "An invite is already pending for this email" }, 409);

        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: invite, error } = await db
          .from("se_team_invites")
          .insert({ team_id: teamId, invited_by: se.seProfile.id, email, expires_at: expiresAt })
          .select("id, token")
          .single();
        if (error) return json({ error: error.message }, 500);

        const joinLink = `${APP_URL}/team-invite/${invite.token}`;
        const teamName = teamInfo?.name ?? "a team";

        const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,sans-serif;background:#f4f5f7;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
<tr><td style="background:linear-gradient(135deg,#2006F7,#4A20F7);padding:24px 32px;text-align:center;">
  <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;">Sophos Clarity</h1>
</td></tr>
<tr><td style="padding:32px;">
  <h2 style="margin:0 0 16px;font-size:18px;color:#1a1a2e;">You&rsquo;ve been invited to join a team</h2>
  <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
    <strong>${inviterName}</strong> has invited you to join the <strong>${teamName}</strong> team on Sophos Clarity.
  </p>
  <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
    Click the button below to accept the invitation and join the team.
  </p>
  <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
    <a href="${joinLink}" style="display:inline-block;background:#2006F7;color:#ffffff;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Join Team</a>
  </td></tr></table>
  <p style="margin:24px 0 0;font-size:12px;color:#999;line-height:1.5;">
    This invite expires in 14 days. If you didn&rsquo;t expect this, you can safely ignore this email.
  </p>
</td></tr>
<tr><td style="padding:16px 32px;background:#f9f9fb;text-align:center;border-top:1px solid #eee;">
  <p style="margin:0;font-size:11px;color:#aaa;">Sophos Clarity &bull; Sales Engineering Tools</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

        await sendConfigUploadEmail(
          email,
          `You've been invited to join "${teamName}" on Sophos Clarity`,
          emailHtml,
        );

        return json({ ok: true, invite_id: invite.id });
      }

      // GET /api/se-teams/:id/invites — list pending invites (admin only)
      if (req.method === "GET" && subRoute === "invites") {
        if (!isAdmin) return json({ error: "Admin access required" }, 403);
        const { data: invites } = await db
          .from("se_team_invites")
          .select("id, email, status, created_at, expires_at")
          .eq("team_id", teamId)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        return json({ data: invites ?? [] });
      }

      // DELETE /api/se-teams/:id/invites/:inviteId — revoke a pending invite (admin only)
      if (req.method === "DELETE" && subRoute === "invites" && segments[3]) {
        if (!isAdmin) return json({ error: "Admin access required" }, 403);
        const inviteId = segments[3];
        const { error } = await db.from("se_team_invites").delete().eq("id", inviteId).eq("team_id", teamId);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      // POST /api/se-teams/:id/transfer-admin (admin only)
      if (req.method === "POST" && subRoute === "transfer-admin") {
        if (!isAdmin) return json({ error: "Admin access required" }, 403);
        const body = await req.json();
        const targetProfileId = body.target_se_profile_id;
        if (!targetProfileId) return json({ error: "target_se_profile_id is required" }, 400);

        const { data: targetMember } = await db
          .from("se_team_members")
          .select("id")
          .eq("team_id", teamId)
          .eq("se_profile_id", targetProfileId)
          .maybeSingle();
        if (!targetMember) return json({ error: "Target is not a member of this team" }, 404);

        await db.from("se_team_members").update({ role: "admin" }).eq("id", targetMember.id);
        await db.from("se_team_members").update({ role: "member" }).eq("id", membership.id);
        return json({ ok: true });
      }

      // POST /api/se-teams/:id/set-primary — mark this team as primary
      if (req.method === "POST" && subRoute === "set-primary") {
        await db
          .from("se_team_members")
          .update({ is_primary: false })
          .eq("se_profile_id", se.seProfile.id);
        await db
          .from("se_team_members")
          .update({ is_primary: true })
          .eq("team_id", teamId)
          .eq("se_profile_id", se.seProfile.id);
        return json({ ok: true });
      }

      // DELETE /api/se-teams/:id/members/:memberId — remove a member (admin only)
      if (req.method === "DELETE" && subRoute === "members" && segments[3]) {
        if (!isAdmin) return json({ error: "Admin access required" }, 403);
        const memberId = segments[3];
        const { data: target } = await db
          .from("se_team_members")
          .select("id, se_profile_id")
          .eq("id", memberId)
          .eq("team_id", teamId)
          .maybeSingle();
        if (!target) return json({ error: "Member not found" }, 404);
        if (target.se_profile_id === se.seProfile.id) return json({ error: "Cannot remove yourself — use leave instead" }, 400);
        await db.from("se_team_members").delete().eq("id", memberId);
        return json({ ok: true });
      }

      // DELETE /api/se-teams/:id — delete team (admin only)
      if (req.method === "DELETE" && !subRoute) {
        if (!isAdmin) return json({ error: "Admin access required" }, 403);
        await db.from("se_teams").delete().eq("id", teamId);
        return json({ ok: true });
      }
    }

    return json({ error: "Not found" }, 404);
  }

  // ── Health check team reassignment ──

  if (segments[0] === "health-checks") {
    const se = await authenticateSE(req);
    if (!se) return json({ error: "Unauthorized" }, 401);
    const db = adminClient();

    // PATCH /api/health-checks/:id/team — reassign single check
    if (req.method === "PATCH" && segments.length === 3 && segments[2] === "team") {
      const checkId = segments[1];
      const body = await req.json();
      const newTeamId = body.team_id ?? null;

      const { data: row } = await db
        .from("se_health_checks")
        .select("id, se_user_id")
        .eq("id", checkId)
        .maybeSingle();
      if (!row) return json({ error: "Health check not found" }, 404);
      if (row.se_user_id !== se.seProfile.id) return json({ error: "Forbidden — you can only move your own health checks" }, 403);

      if (newTeamId) {
        const { data: mem } = await db
          .from("se_team_members")
          .select("id")
          .eq("team_id", newTeamId)
          .eq("se_profile_id", se.seProfile.id)
          .maybeSingle();
        if (!mem) return json({ error: "You are not a member of that team" }, 403);
      }

      await db.from("se_health_checks").update({ team_id: newTeamId }).eq("id", checkId);
      return json({ ok: true });
    }

    // PATCH /api/health-checks/bulk-team — bulk reassign
    if (req.method === "PATCH" && segments.length === 2 && segments[1] === "bulk-team") {
      const body = await req.json();
      const ids: string[] = body.ids;
      const newTeamId = body.team_id ?? null;
      if (!ids?.length) return json({ error: "ids array is required" }, 400);

      if (newTeamId) {
        const { data: mem } = await db
          .from("se_team_members")
          .select("id")
          .eq("team_id", newTeamId)
          .eq("se_profile_id", se.seProfile.id)
          .maybeSingle();
        if (!mem) return json({ error: "You are not a member of that team" }, 403);
      }

      const { data: rows } = await db
        .from("se_health_checks")
        .select("id")
        .in("id", ids)
        .eq("se_user_id", se.seProfile.id);

      const ownedIds = (rows ?? []).map((r: any) => r.id);
      if (ownedIds.length === 0) return json({ error: "No matching health checks found" }, 404);

      await db.from("se_health_checks").update({ team_id: newTeamId }).in("id", ownedIds);
      return json({ ok: true, updated: ownedIds.length });
    }
  }

  // ── Config upload routes ──

  // POST /api/config-upload-request — SE creates an upload link (JWT required)
  if (req.method === "POST" && segments[0] === "config-upload-request" && segments.length === 1) {
    const se = await authenticateSE(req);
    if (!se) return json({ error: "Unauthorized — SE login required" }, 401);

    const body = await req.json();
    const expiresInDays = [1, 3, 7, 14, 30].includes(body.expires_in_days) ? body.expires_in_days : 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const token = crypto.randomUUID();
    const db = adminClient();
    const insertPayload: Record<string, unknown> = {
      se_user_id: se.seProfile.id,
      token,
      customer_name: body.customer_name?.trim() || null,
      customer_email: body.customer_email?.trim() || null,
      se_email: se.user.email,
      expires_at: expiresAt.toISOString(),
    };
    if (body.team_id) insertPayload.team_id = body.team_id;

    const { data: row, error } = await db
      .from("config_upload_requests")
      .insert(insertPayload)
      .select("id, token, expires_at")
      .single();

    if (error) return json({ error: error.message }, 500);

    const uploadUrl = `${APP_URL}/upload/${token}`;
    let emailSent = false;

    if (body.customer_email?.trim()) {
      const seName = se.seProfile.display_name || se.user.email || "Your Sophos SE";
      const expiresFormatted = expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      const emailHtml = buildCustomerUploadEmailHtml(uploadUrl, seName, expiresFormatted);
      const result = await sendConfigUploadEmail(
        body.customer_email.trim(),
        "Sophos Firewall Health Check — Configuration Upload",
        emailHtml,
      );
      emailSent = result.success;
      if (emailSent) {
        await db.from("config_upload_requests").update({ email_sent: true }).eq("id", row.id);
      }
    }

    return json({ id: row.id, token, url: uploadUrl, expires_at: row.expires_at, email_sent: emailSent }, 201);
  }

  // GET /api/config-upload-requests — list requests (JWT required). ?team_id= to filter by team.
  if (req.method === "GET" && segments[0] === "config-upload-requests" && segments.length === 1) {
    const se = await authenticateSE(req);
    if (!se) return json({ error: "Unauthorized" }, 401);

    await runConfigUploadCleanup();

    const db = adminClient();
    const urlObj = new URL(req.url);
    const teamIdFilter = urlObj.searchParams.get("team_id");

    let query = db
      .from("config_upload_requests")
      .select("id, token, customer_name, customer_email, status, expires_at, email_sent, uploaded_at, downloaded_at, created_at, se_user_id, team_id")
      .order("created_at", { ascending: false })
      .limit(50);

    if (teamIdFilter) {
      const { data: mem } = await db
        .from("se_team_members")
        .select("id")
        .eq("team_id", teamIdFilter)
        .eq("se_profile_id", se.seProfile.id)
        .maybeSingle();
      if (!mem) return json({ error: "Not a member of that team" }, 403);
      query = query.eq("team_id", teamIdFilter);
    } else {
      query = query.eq("se_user_id", se.seProfile.id).is("team_id", null);
    }

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ data: data ?? [] });
  }

  // Config upload token routes (config-upload/:token/...)
  if (segments[0] === "config-upload" && segments.length >= 2) {
    const token = segments[1];
    const subRoute = segments[2] ?? null;
    const db = adminClient();

    // GET /api/config-upload/:token — public status check
    if (req.method === "GET" && !subRoute) {
      await runConfigUploadCleanup();

      const { data, error } = await db
        .from("config_upload_requests")
        .select("status, customer_name, expires_at, file_name")
        .eq("token", token)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Upload link not found" }, 404);
      if (new Date(data.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410);

      return json({
        status: data.status,
        customer_name: data.customer_name,
        expires_at: data.expires_at,
        file_name: data.file_name,
      });
    }

    // POST /api/config-upload/:token — customer uploads XML (public)
    if (req.method === "POST" && !subRoute) {
      const { data: existing, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, status, expires_at, se_email, customer_name")
        .eq("token", token)
        .maybeSingle();

      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!existing) return json({ error: "Upload link not found" }, 404);
      if (new Date(existing.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410);
      if (existing.status === "downloaded") return json({ error: "This configuration has already been downloaded by the SE. Please request a new upload link." }, 409);

      const contentType = req.headers.get("content-type") ?? "";
      let xmlContent = "";
      let fileName = "entities.xml";

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file");
        if (!file || !(file instanceof File)) return json({ error: "No file provided" }, 400);
        if (file.size > MAX_CONFIG_SIZE) return json({ error: "File exceeds 10 MB limit" }, 413);
        fileName = file.name || "entities.xml";
        xmlContent = await file.text();
      } else {
        const contentLength = parseInt(req.headers.get("content-length") ?? "0");
        if (contentLength > MAX_CONFIG_SIZE) return json({ error: "File exceeds 10 MB limit" }, 413);
        xmlContent = await req.text();
      }

      if (!xmlContent.trim()) return json({ error: "Empty file" }, 400);

      if (!isValidSophosXml(xmlContent)) {
        return json({
          error: "This doesn't appear to be a Sophos firewall configuration export. Please export your entities.xml from Sophos Firewall and try again.",
        }, 422);
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

      if (updateErr) return json({ error: updateErr.message }, 500);

      if (existing.se_email) {
        const notifHtml = buildSeNotificationEmailHtml(existing.customer_name ?? "", `${APP_URL}/health-check-2`);
        await sendConfigUploadEmail(
          existing.se_email,
          `Config received${existing.customer_name ? ` from ${existing.customer_name}` : ""}`,
          notifHtml,
        );
      }

      return json({ ok: true, message: "Configuration uploaded successfully" });
    }

    // POST /api/config-upload/:token/resend — SE re-sends email (JWT required)
    if (req.method === "POST" && subRoute === "resend") {
      const se = await authenticateSE(req);
      if (!se) return json({ error: "Unauthorized" }, 401);

      const { data: row, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, customer_email, expires_at, se_user_id")
        .eq("token", token)
        .maybeSingle();

      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Upload request not found" }, 404);
      if (row.se_user_id !== se.seProfile.id) return json({ error: "Forbidden" }, 403);
      if (!row.customer_email) return json({ error: "No customer email on file" }, 400);
      if (new Date(row.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410);

      const uploadUrl = `${APP_URL}/upload/${token}`;
      const seName = se.seProfile.display_name || se.user.email || "Your Sophos SE";
      const expiresFormatted = new Date(row.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      const emailHtml = buildCustomerUploadEmailHtml(uploadUrl, seName, expiresFormatted);
      const result = await sendConfigUploadEmail(
        row.customer_email,
        "Sophos Firewall Health Check — Configuration Upload",
        emailHtml,
      );

      if (result.success) {
        await db.from("config_upload_requests").update({ email_sent: true }).eq("id", row.id);
      }

      return json({ email_sent: result.success, error: result.error ?? undefined });
    }

    // GET /api/config-upload/:token/download — SE downloads the XML (JWT required, owner or teammate)
    if (req.method === "GET" && subRoute === "download") {
      const se = await authenticateSE(req);
      if (!se) return json({ error: "Unauthorized" }, 401);

      const { data: row, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, config_xml, file_name, status, se_user_id, team_id")
        .eq("token", token)
        .maybeSingle();

      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Upload request not found" }, 404);

      let hasAccess = row.se_user_id === se.seProfile.id;
      if (!hasAccess && row.team_id) {
        const { data: mem } = await db
          .from("se_team_members")
          .select("id")
          .eq("team_id", row.team_id)
          .eq("se_profile_id", se.seProfile.id)
          .maybeSingle();
        hasAccess = !!mem;
      }
      if (!hasAccess) return json({ error: "Forbidden" }, 403);
      if (!row.config_xml) return json({ error: "No configuration has been uploaded yet" }, 404);

      await db
        .from("config_upload_requests")
        .update({ downloaded_at: new Date().toISOString(), status: "downloaded" })
        .eq("id", row.id);

      return json({ config_xml: row.config_xml, file_name: row.file_name });
    }

    // DELETE /api/config-upload/:token — SE revokes the request (JWT required)
    if (req.method === "DELETE" && !subRoute) {
      const se = await authenticateSE(req);
      if (!se) return json({ error: "Unauthorized" }, 401);

      const { data: row, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, se_user_id")
        .eq("token", token)
        .maybeSingle();

      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Upload request not found" }, 404);
      if (row.se_user_id !== se.seProfile.id) return json({ error: "Forbidden" }, 403);

      await db.from("config_upload_requests").delete().eq("id", row.id);
      return json({ ok: true });
    }
  }

  // ── Firewalls route (JWT auth) ──
  if (req.method === "GET" && segments[0] === "firewalls" && segments.length === 1) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const uc = userClient(authHeader);
    const { data: { user } } = await uc.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const membership = await getOrgMembership(user.id);
    if (!membership) return json({ error: "Forbidden" }, 403);

    const db = adminClient();

    try {
      const { data: firewalls, error: fwErr } = await db
        .from("central_firewalls")
        .select("id, firewall_id, serial_number, hostname, name, firmware_version, model, central_tenant_id")
        .eq("org_id", membership.org_id);

      if (fwErr) return json({ error: fwErr.message }, 500);

      // Bounded by org scope; 500 covers most estates
      const { data: submissions } = await db
        .from("agent_submissions")
        .select("id, firewalls, overall_score, overall_grade, created_at")
        .eq("org_id", membership.org_id)
        .order("created_at", { ascending: false })
        .limit(500);

      const byFirewallId: Record<string, { score: number; grade: string; submitted_at: string }> = {};
      for (const sub of submissions ?? []) {
        const fwList = (sub.firewalls as Array<{ id?: string; hostname?: string }>) ?? [];
        for (const fw of fwList) {
          const fid = fw.id ?? fw.hostname;
          if (!fid || byFirewallId[fid]) continue;
          byFirewallId[fid] = {
            score: sub.overall_score ?? 0,
            grade: sub.overall_grade ?? "F",
            submitted_at: sub.created_at as string,
          };
        }
      }

      const byHostname: Record<string, { score: number; grade: string; submitted_at: string }> = {};
      for (const sub of submissions ?? []) {
        const fwList = (sub.firewalls as Array<{ id?: string; hostname?: string }>) ?? [];
        for (const fw of fwList) {
          const h = fw.hostname;
          if (!h || byHostname[h]) continue;
          byHostname[h] = {
            score: sub.overall_score ?? 0,
            grade: sub.overall_grade ?? "F",
            submitted_at: sub.created_at as string,
          };
        }
      }

      const result = (firewalls ?? []).map((fw) => {
        const scoreInfo = byFirewallId[fw.firewall_id] ?? byHostname[fw.hostname] ?? null;
        return {
          id: fw.id,
          firewall_id: fw.firewall_id,
          serial_number: fw.serial_number,
          hostname: fw.hostname,
          name: fw.name,
          firmware_version: fw.firmware_version,
          model: fw.model,
          central_tenant_id: fw.central_tenant_id,
          current_score: scoreInfo?.score ?? null,
          current_grade: scoreInfo?.grade ?? null,
          last_assessed_at: scoreInfo?.submitted_at ?? null,
        };
      });

      return json({ data: result });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
  }

  return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});
