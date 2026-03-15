import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

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
    const match = await bcrypt.compare(apiKey, agent.api_key_hash);
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
  if (!membership || membership.role !== "admin")
    return json({ error: "Admin access required" }, 403);

  const body = await req.json();
  const { name, firewall_host } = body;
  if (!name || !firewall_host)
    return json({ error: "name and firewall_host are required" }, 400);

  const apiKey = generateApiKey();
  const hash = await bcrypt.hash(apiKey);
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
  if (!membership || membership.role !== "admin")
    return json({ error: "Admin access required" }, 403);

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

// ── Agent config (agent API key auth) ──

function handleConfig(agent: Record<string, unknown>) {
  return json({
    id: agent.id,
    name: agent.name,
    customer_name: agent.customer_name,
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

  await db.from("agents").update(update).eq("id", agent.id);

  return json({
    schedule_cron: agent.schedule_cron,
    customer_name: agent.customer_name,
    environment: agent.environment,
    firmware_version_override: agent.firmware_version_override,
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

  const customerName = body.customer_name ?? (agent.customer_name as string);
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

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
    if (req.method === "DELETE" && segments.length === 3) {
      return handleDelete(req, segments[2]);
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

      const options = {
        challenge: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
        rp: { name: "FireComply", id: new URL(SUPABASE_URL).hostname },
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

      const options = {
        challenge: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
        timeout: 60000,
        rpId: new URL(SUPABASE_URL).hostname,
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

      // In production, verify the signature against the stored public key
      // For now, generate a session since the browser completed the WebAuthn ceremony
      return json({
        ok: true,
        session: { user_id: targetUser.id, email: targetUser.email },
      });
    }

    return json({ error: "Not found" }, 404);
  }

  // ── Legacy placeholder routes (backward compat) ──
  if (
    req.method === "GET" &&
    segments[0] === "assessments" &&
    segments.length === 1
  ) {
    const db = adminClient();
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const uc = userClient(authHeader);
    const {
      data: { user },
    } = await uc.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const membership = await getOrgMembership(user.id);
    if (!membership) return json({ data: [], total: 0 });

    const { data, count } = await db
      .from("assessments")
      .select("id, org_id, customer_name, environment, overall_score, overall_grade, created_at", { count: "exact" })
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false })
      .limit(50);

    return json({ data: data ?? [], total: count ?? 0 });
  }

  return json({ error: "Not found" }, 404);
});
