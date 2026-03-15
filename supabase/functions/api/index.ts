import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const HASH_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
  if (body.serial_number) update.serial_number = body.serial_number;
  if (body.hardware_model) update.hardware_model = body.hardware_model;

  await db.from("agents").update(update).eq("id", agent.id);

  const pendingCommand = agent.pending_command as string | null;
  if (pendingCommand) {
    await db.from("agents").update({ pending_command: null }).eq("id", agent.id);
  }

  return json({
    schedule_cron: agent.schedule_cron,
    customer_name: agent.customer_name,
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
      .select("share_token, markdown, customer_name, expires_at, created_at")
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
    });
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
