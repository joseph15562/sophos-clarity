import { getOrgMembership } from "../../_shared/auth.ts";
import { generateApiKey, hmacHash } from "../../_shared/crypto.ts";
import { adminClient, json as jsonResponse, userClient } from "../../_shared/db.ts";

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

export async function handleAgentRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (segments[0] !== "agent") return null;
  const route = segments[1];

  if (req.method === "POST" && route === "register") {
    return handleRegister(req, corsHeaders);
  }
  if (req.method === "DELETE" && route) {
    return handleDelete(req, route, corsHeaders);
  }
  if (req.method === "POST" && segments.length === 3 && segments[2] === "run-now") {
    return handleRunNow(req, route, corsHeaders);
  }

  return json({ error: "Not found" }, 404, corsHeaders);
}
