import { authenticateAgent, getOrgMembership } from "../../_shared/auth.ts";
import { generateApiKey, hmacHash } from "../../_shared/crypto.ts";
import { adminClient, json as jsonResponse, userClient } from "../../_shared/db.ts";
import {
  sophosFetchFirewalls,
  sophosFetchTenants,
  sophosGetToken,
  sophosWhoAmI,
} from "../../_shared/sophos-central-api.ts";

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return jsonResponse(body, status, corsHeaders);
}

// ── Agent registration (web app auth via Supabase JWT) ──

async function handleRegister(req: Request, corsHeaders: Record<string, string>) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, corsHeaders);

  const uc = userClient(authHeader);
  const {
    data: { user },
  } = await uc.auth.getUser();
  if (!user) return json({ error: "Invalid session" }, 401, corsHeaders);

  const membership = await getOrgMembership(user.id);
  if (!membership || !["admin", "engineer"].includes(membership.role))
    return json({ error: "Admin or engineer access required" }, 403, corsHeaders);

  const body = await req.json();
  const { name, firewall_host } = body;
  if (!name || !firewall_host)
    return json({ error: "name and firewall_host are required" }, 400, corsHeaders);

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

  if (error) return json({ error: error.message }, 500, corsHeaders);

  return json(
    {
      agent,
      api_key: apiKey,
      message: "Store this API key securely. It will not be shown again.",
    },
    201,
    corsHeaders,
  );
}

// ── Agent deletion (web app auth) ──

async function handleDelete(req: Request, agentId: string, corsHeaders: Record<string, string>) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, corsHeaders);

  const uc = userClient(authHeader);
  const {
    data: { user },
  } = await uc.auth.getUser();
  if (!user) return json({ error: "Invalid session" }, 401, corsHeaders);

  const membership = await getOrgMembership(user.id);
  if (!membership || !["admin", "engineer"].includes(membership.role))
    return json({ error: "Admin or engineer access required" }, 403, corsHeaders);

  const db = adminClient();
  const { data: agent } = await db
    .from("agents")
    .select("id, org_id")
    .eq("id", agentId)
    .single();

  if (!agent || agent.org_id !== membership.org_id)
    return json({ error: "Agent not found" }, 404, corsHeaders);

  await db.from("agent_submissions").delete().eq("agent_id", agentId);
  await db.from("agents").delete().eq("id", agentId);

  return json({ ok: true }, 200, corsHeaders);
}

// ── Trigger run-now (web app auth via Supabase JWT) ──

async function handleRunNow(req: Request, agentId: string, corsHeaders: Record<string, string>) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, corsHeaders);

  const uc = userClient(authHeader);
  const { data: { user } } = await uc.auth.getUser();
  if (!user) return json({ error: "Invalid session" }, 401, corsHeaders);

  const membership = await getOrgMembership(user.id);
  if (!membership || !["admin", "engineer"].includes(membership.role))
    return json({ error: "Insufficient permissions" }, 403, corsHeaders);

  const db = adminClient();
  const { data: agent } = await db
    .from("agents")
    .select("id, org_id")
    .eq("id", agentId)
    .single();

  if (!agent || agent.org_id !== membership.org_id)
    return json({ error: "Agent not found" }, 404, corsHeaders);

  await db.from("agents").update({ pending_command: "run-now" }).eq("id", agentId);

  return json({ ok: true, message: "Scan queued — agent will run on next heartbeat (within 5 minutes)" }, 200, corsHeaders);
}

// ── Agent config (agent API key auth) ──

function handleConfig(agent: Record<string, unknown>, corsHeaders: Record<string, string>) {
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
  }, 200, corsHeaders);
}

// ── Agent firewalls — list Central firewalls for the org ──

async function handleFirewalls(agent: Record<string, unknown>, corsHeaders: Record<string, string>) {
  const db = adminClient();
  const orgId = agent.org_id as string;

  const { data: creds } = await db
    .from("central_credentials")
    .select("partner_type")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!creds) return json({ tenants: [] }, 200, corsHeaders);

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

  return json({ tenants: result }, 200, corsHeaders);
}

// ── Agent heartbeat ──

async function handleHeartbeat(
  req: Request,
  agent: Record<string, unknown>,
  corsHeaders: Record<string, string>,
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
  }, 200, corsHeaders);
}

// ── Agent submit ──

async function handleSubmit(
  req: Request,
  agent: Record<string, unknown>,
  corsHeaders: Record<string, string>,
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

  if (subError) return json({ error: subError.message }, 500, corsHeaders);

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

  return json({ ok: true, drift }, 200, corsHeaders);
}

export async function handleAgentRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (segments[0] !== "agent") return null;
  const route = segments[1];

  // Web-app authenticated routes (Supabase JWT)
  if (req.method === "POST" && route === "register") {
    return handleRegister(req, corsHeaders);
  }
  if (req.method === "DELETE" && route) {
    return handleDelete(req, route, corsHeaders);
  }
  if (req.method === "POST" && segments.length === 3 && segments[2] === "run-now") {
    return handleRunNow(req, route, corsHeaders);
  }

  // Agent API-key authenticated routes
  const apiKey =
    req.headers.get("X-API-Key") ?? req.headers.get("x-api-key");
  if (!apiKey)
    return json({ error: "Missing X-API-Key header" }, 401, corsHeaders);

  const agent = await authenticateAgent(apiKey);
  if (!agent) return json({ error: "Invalid API key" }, 401, corsHeaders);

  if (req.method === "GET" && route === "config") return handleConfig(agent, corsHeaders);
  if (req.method === "GET" && route === "firewalls")
    return handleFirewalls(agent, corsHeaders);
  if (req.method === "GET" && route === "commands") {
    const cmd = agent.pending_command as string | null;
    if (cmd) {
      const db = adminClient();
      await db.from("agents").update({ pending_command: null }).eq("id", agent.id);
    }
    return json({ command: cmd ?? null }, 200, corsHeaders);
  }
  if (req.method === "POST" && route === "heartbeat")
    return handleHeartbeat(req, agent, corsHeaders);
  if (req.method === "POST" && route === "submit")
    return handleSubmit(req, agent, corsHeaders);

  // POST /api/agent/verify-identity — MFA verification for Electron agent
  if (req.method === "POST" && route === "verify-identity") {
    const body = await req.json();
    const { email, totpCode } = body;
    if (!email || !totpCode) return json({ error: "email and totpCode required" }, 400, corsHeaders);

    const db = adminClient();

    const { data: users } = await db.auth.admin.listUsers();
    const targetUser = users?.users?.find((u: any) => u.email === email);
    if (!targetUser) return json({ error: "User not found" }, 404, corsHeaders);

    const { data: membership } = await db
      .from("org_members")
      .select("org_id")
      .eq("user_id", targetUser.id)
      .eq("org_id", agent.org_id as string)
      .maybeSingle();

    if (!membership) return json({ error: "User not in agent's organisation" }, 403, corsHeaders);

    // Verify TOTP via Supabase Auth MFA admin API
    const { data: factors, error: factorsErr } = await db.auth.admin.mfa.listFactors({
      userId: targetUser.id,
    });

    if (factorsErr) return json({ error: "Failed to retrieve MFA factors" }, 500, corsHeaders);

    const totpFactors = factors?.factors?.filter((f: any) => f.factor_type === "totp" && f.status === "verified") ?? [];
    if (totpFactors.length === 0) {
      return json({ error: "User has no enrolled TOTP factor. Enrol MFA in the web app first." }, 412, corsHeaders);
    }

    const factorId = totpFactors[0].id;

    const { data: challenge, error: challengeErr } = await db.auth.admin.mfa.createChallenge({
      factorId,
      userId: targetUser.id,
    });

    if (challengeErr || !challenge) {
      return json({ error: "Failed to create MFA challenge" }, 500, corsHeaders);
    }

    const { data: verification, error: verifyErr } = await db.auth.admin.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: totpCode,
    });

    if (verifyErr || !verification) {
      return json({ error: "Invalid TOTP code" }, 401, corsHeaders);
    }

    await db.from("audit_log").insert({
      org_id: agent.org_id,
      user_id: targetUser.id,
      action: "agent.mfa_verify",
      resource_type: "agent",
      resource_id: agent.id as string,
      metadata: { email, agentName: agent.name },
    }).then(() => {}).catch(() => {});

    return json({
      sessionToken: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      userName: email,
    }, 200, corsHeaders);
  }

  return json({ error: "Not found" }, 404, corsHeaders);
}
