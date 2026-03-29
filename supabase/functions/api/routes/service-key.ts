import { getOrgMembership } from "../../_shared/auth.ts";
import {
  generateServiceKeySecret,
  getServiceKeyContext,
  hashServiceKeySecret,
  normalizeIssuableScopes,
} from "../../_shared/service-key.ts";
import { adminClient, json as jsonResponse, safeDbError, safeError, userClient } from "../../_shared/db.ts";

async function requireOrgAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ orgId: string; userId: string } | Response> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  const uc = userClient(authHeader);
  const {
    data: { user },
  } = await uc.auth.getUser();
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  const membership = await getOrgMembership(user.id);
  if (!membership || membership.role !== "admin") {
    return jsonResponse({ error: "Admin access required" }, 403, corsHeaders);
  }
  return { orgId: membership.org_id, userId: user.id };
}

/**
 * GET /api/service-key/ping — service secret (no user JWT).
 * POST /api/service-key/issue — JWT + org admin; returns secret once.
 * POST /api/service-key/revoke — JWT + org admin.
 */
export async function handleServiceKeyRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  function json(body: unknown, status = 200, headers: Record<string, string> = corsHeaders) {
    return jsonResponse(body, status, headers);
  }

  if (segments[0] !== "service-key" || segments.length !== 2) {
    return null;
  }

  const sub = segments[1];

  if (sub === "issue" && req.method === "POST") {
    const admin = await requireOrgAdmin(req, corsHeaders);
    if (admin instanceof Response) return admin;
    let body: { label?: string; scopes?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) return json({ error: "label is required" }, 400);
    const scopes = normalizeIssuableScopes(body.scopes);
    const secret = generateServiceKeySecret();
    const keyHash = await hashServiceKeySecret(secret);
    const keyPrefix = secret.slice(0, 12);
    const db = adminClient();
    const { data: row, error: insErr } = await db
      .from("org_service_api_keys")
      .insert({
        org_id: admin.orgId,
        label,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes,
        created_by: admin.userId,
      })
      .select("id, label, key_prefix, scopes, created_at")
      .single();
    if (insErr) return json({ error: safeDbError(insErr) }, 500);
    return json({
      ok: true,
      secret,
      key: row,
    });
  }

  if (sub === "revoke" && req.method === "POST") {
    const admin = await requireOrgAdmin(req, corsHeaders);
    if (admin instanceof Response) return admin;
    let body: { id?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return json({ error: "id is required" }, 400);
    const db = adminClient();
    const { data: existing, error: fetchErr } = await db
      .from("org_service_api_keys")
      .select("id, org_id, revoked_at")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) return json({ error: safeDbError(fetchErr) }, 500);
    if (!existing || (existing as { org_id: string }).org_id !== admin.orgId) {
      return json({ error: "Not found" }, 404);
    }
    if ((existing as { revoked_at: string | null }).revoked_at) {
      return json({ error: "Key already revoked" }, 400);
    }
    const { error: upErr } = await db
      .from("org_service_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", admin.orgId);
    if (upErr) return json({ error: safeDbError(upErr) }, 500);
    return json({ ok: true });
  }

  if (sub === "ping" && req.method === "GET") {
    try {
      const ctx = await getServiceKeyContext(req);
      if (!ctx) return json({ ok: false, error: "Invalid or missing service key" }, 401);
      return json({
        ok: true,
        org_id: ctx.orgId,
        scopes: ctx.scopes,
      });
    } catch (err) {
      return json({ ok: false, error: safeError(err) }, 500);
    }
  }

  return null;
}
