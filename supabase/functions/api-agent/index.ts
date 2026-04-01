/**
 * api-agent — Agent API-key authenticated routes.
 * Called by the Sophos Clarity Connector agent (not the browser).
 * Gateway JWT is DISABLED; auth is via X-API-Key header.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  authenticateAgent as defaultAuthenticateAgent,
  type AuthenticateAgentOpts,
} from "../_shared/auth.ts";
import {
  adminClient,
  json as jsonResponse,
  safeDbError,
  safeError,
} from "../_shared/db.ts";
import { logJson } from "../_shared/logger.ts";
import { persistedAssessmentCustomerName } from "../_shared/agent-assessment-customer.ts";
import {
  sophosFetchFirewalls,
  sophosFetchTenants,
  sophosGetToken,
  sophosWhoAmI,
} from "../_shared/sophos-central-api.ts";

function json(
  body: unknown,
  status = 200,
  corsHeaders: Record<string, string> = {},
) {
  return jsonResponse(body, status, corsHeaders);
}

// ── GET /config ──

function handleConfig(
  agent: Record<string, unknown>,
  corsHeaders: Record<string, string>,
) {
  const resolvedName = (agent.customer_name === "Unnamed" && agent.tenant_name)
    ? agent.tenant_name
    : agent.customer_name;
  return json(
    {
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
    },
    200,
    corsHeaders,
  );
}

// ── GET /firewalls ──

async function handleFirewalls(
  agent: Record<string, unknown>,
  corsHeaders: Record<string, string>,
) {
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
    .eq("org_id", orgId)
    .limit(500);

  const result = [];
  for (const tenant of tenants ?? []) {
    const { data: firewalls } = await db
      .from("central_firewalls")
      .select(
        "firewall_id, serial_number, hostname, name, firmware_version, model, status_json",
      )
      .eq("org_id", orgId)
      .eq("central_tenant_id", tenant.central_tenant_id)
      .limit(1000);

    result.push({
      id: tenant.central_tenant_id,
      name: tenant.name,
      firewalls: firewalls ?? [],
    });
  }

  return json({ tenants: result }, 200, corsHeaders);
}

// ── POST /heartbeat ──

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
  if (
    body.connector_version != null && typeof body.connector_version === "string"
  ) {
    const cv = body.connector_version.trim();
    if (cv) update.connector_version = cv;
  }
  if (body.serial_number) update.serial_number = body.serial_number;
  if (body.hardware_model) update.hardware_model = body.hardware_model;
  if (body.customer_name) update.customer_name = body.customer_name;

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

      const { data: tenant } = await db
        .from("central_tenants")
        .select("name")
        .eq("org_id", agent.org_id as string)
        .eq("central_tenant_id", centralFw.central_tenant_id)
        .maybeSingle();

      if (tenant) update.tenant_name = tenant.name;
      if (centralFw.model && !body.hardware_model) {
        update.hardware_model = centralFw.model;
      }
    }
  }

  await db.from("agents").update(update).eq("id", agent.id);

  const pendingCommand = agent.pending_command as string | null;
  if (pendingCommand) {
    await db.from("agents").update({ pending_command: null }).eq(
      "id",
      agent.id,
    );
  }

  const currentName = (update.customer_name as string) ||
    (agent.customer_name as string);
  const resolvedName =
    (currentName === "Unnamed" && (update.tenant_name || agent.tenant_name))
      ? (update.tenant_name || agent.tenant_name)
      : currentName;

  return json(
    {
      schedule_cron: agent.schedule_cron,
      customer_name: resolvedName,
      environment: agent.environment,
      firmware_version_override: agent.firmware_version_override,
      pending_command: pendingCommand,
    },
    200,
    corsHeaders,
  );
}

// ── POST /submit ──

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

    const olderTitles = prevSubs.length > 1
      ? new Set<string>(prevSubs[1].finding_titles ?? [])
      : new Set<string>();

    const regressed = newFindings.filter((t) => olderTitles.has(t));
    const trulyNew = newFindings.filter((t) => !olderTitles.has(t));

    drift = { new: trulyNew, fixed: fixedFindings, regressed };
  }

  const customerName = persistedAssessmentCustomerName(
    agent,
    body.customer_name,
  );
  const overallScore = body.overall_score ?? 0;
  const overallGrade = body.overall_grade ?? "F";
  const firewalls = body.firewalls ?? [];

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

  if (subError) return json({ error: safeDbError(subError) }, 500, corsHeaders);

  await db.from("assessments").insert({
    org_id: orgId,
    created_by: null,
    customer_name: customerName,
    environment: agent.environment as string,
    firewalls,
    overall_score: overallScore,
    overall_grade: overallGrade,
  });

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

// ── POST /verify-identity ──

async function handleVerifyIdentity(
  req: Request,
  agent: Record<string, unknown>,
  corsHeaders: Record<string, string>,
) {
  const body = await req.json();
  const { email, totpCode } = body;
  if (!email || !totpCode) {
    return json({ error: "email and totpCode required" }, 400, corsHeaders);
  }

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

  if (!membership) {
    return json(
      { error: "User not in agent's organisation" },
      403,
      corsHeaders,
    );
  }

  const { data: factors, error: factorsErr } = await db.auth.admin.mfa
    .listFactors({
      userId: targetUser.id,
    });

  if (factorsErr) {
    return json({ error: "Failed to retrieve MFA factors" }, 500, corsHeaders);
  }

  const totpFactors =
    factors?.factors?.filter((f: any) =>
      f.factor_type === "totp" && f.status === "verified"
    ) ?? [];
  if (totpFactors.length === 0) {
    return json(
      {
        error:
          "User has no enrolled TOTP factor. Enrol MFA in the web app first.",
      },
      412,
      corsHeaders,
    );
  }

  const factorId = totpFactors[0].id;

  const mfaAdmin = db.auth.admin.mfa as unknown as {
    createChallenge: (args: { factorId: string; userId: string }) => Promise<
      { data: { id: string } | null; error: { message: string } | null }
    >;
    verify: (
      args: { factorId: string; challengeId: string; code: string },
    ) => Promise<
      { data: unknown; error: { message: string } | null }
    >;
  };

  const { data: challenge, error: challengeErr } = await mfaAdmin
    .createChallenge({
      factorId,
      userId: targetUser.id,
    });

  if (challengeErr || !challenge) {
    return json({ error: "Failed to create MFA challenge" }, 500, corsHeaders);
  }

  const { data: verification, error: verifyErr } = await mfaAdmin.verify({
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
  });

  return json(
    {
      sessionToken: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      userName: email,
    },
    200,
    corsHeaders,
  );
}

// ── Main router ──

export type ApiAgentRequestDeps = {
  authenticateAgent?: (
    apiKey: string,
    opts?: AuthenticateAgentOpts,
  ) => Promise<Record<string, unknown> | null>;
  getCorsHeaders?: (req: Request) => Record<string, string>;
};

export async function handleApiAgentRequest(
  req: Request,
  deps: ApiAgentRequestDeps = {},
): Promise<Response> {
  const corsFn = deps.getCorsHeaders ?? getCorsHeaders;
  const authAgent = deps.authenticateAgent ?? defaultAuthenticateAgent;
  const corsHeaders = corsFn(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const match = path.match(/\/api-agent\/?(.*)$/);
    const rest = (match ? match[1] : path).replace(/\/$/, "") || "";
    const route = rest.split("/").filter(Boolean)[0] ?? "";

    const apiKey = req.headers.get("X-API-Key") ?? req.headers.get("x-api-key");
    if (!apiKey) {
      logJson("warn", "api_agent_missing_api_key", { route });
      return json({ error: "Missing X-API-Key header" }, 401, corsHeaders);
    }

    const agent = await authAgent(apiKey);
    if (!agent) {
      logJson("warn", "api_agent_invalid_api_key", { route });
      return json({ error: "Invalid API key" }, 401, corsHeaders);
    }

    if (req.method === "GET" && route === "config") {
      return handleConfig(agent, corsHeaders);
    }
    if (req.method === "GET" && route === "firewalls") {
      return handleFirewalls(agent, corsHeaders);
    }
    if (req.method === "GET" && route === "commands") {
      const cmd = agent.pending_command as string | null;
      if (cmd) {
        const db = adminClient();
        await db.from("agents").update({ pending_command: null }).eq(
          "id",
          agent.id,
        );
      }
      return json({ command: cmd ?? null }, 200, corsHeaders);
    }
    if (req.method === "POST" && route === "heartbeat") {
      return handleHeartbeat(req, agent, corsHeaders);
    }
    if (req.method === "POST" && route === "submit") {
      return handleSubmit(req, agent, corsHeaders);
    }
    if (req.method === "POST" && route === "verify-identity") {
      return handleVerifyIdentity(req, agent, corsHeaders);
    }

    logJson("warn", "api_agent_not_found", { method: req.method, route });
    return json({ error: "Not found" }, 404, corsHeaders);
  } catch (err) {
    logJson("error", "api_agent_unhandled", {
      detail: err instanceof Error ? err.message : String(err),
    });
    return json({ error: safeError(err) }, 500, corsHeaders);
  }
}

if (import.meta.main) {
  serve((req: Request) => handleApiAgentRequest(req));
}
