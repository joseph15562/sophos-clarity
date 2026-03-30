import { z } from "npm:zod@3.24.2";
import { getOrgMembership } from "../../_shared/auth.ts";
import { logJson } from "../../_shared/logger.ts";
import {
  generateServiceKeySecret,
  getServiceKeyContext,
  hashServiceKeySecret,
  normalizeIssuableScopes,
} from "../../_shared/service-key.ts";
import {
  adminClient,
  json as jsonResponse,
  safeDbError,
  safeError,
  userClient,
} from "../../_shared/db.ts";

async function requireOrgAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ orgId: string; userId: string } | Response> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  }
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

export const serviceKeyIssueBodySchema = z.object({
  label: z.string().trim().min(1).max(200),
  scopes: z.unknown().optional(),
});

export const serviceKeyRevokeBodySchema = z.object({
  id: z.string().uuid(),
});

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
  function json(
    body: unknown,
    status = 200,
    headers: Record<string, string> = corsHeaders,
  ) {
    return jsonResponse(body, status, headers);
  }

  if (segments[0] !== "service-key" || segments.length !== 2) {
    return null;
  }

  const sub = segments[1];

  if (sub === "issue" && req.method === "POST") {
    const admin = await requireOrgAdmin(req, corsHeaders);
    if (admin instanceof Response) return admin;
    const raw = await req.json().catch(() => ({}));
    const parsed = serviceKeyIssueBodySchema.safeParse(raw);
    if (!parsed.success) {
      logJson("warn", "service_key_issue_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return json({ error: "Invalid request body" }, 400);
    }
    const { label, scopes: scopesRaw } = parsed.data;
    const scopes = normalizeIssuableScopes(scopesRaw);
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
    const raw = await req.json().catch(() => ({}));
    const parsed = serviceKeyRevokeBodySchema.safeParse(raw);
    if (!parsed.success) {
      logJson("warn", "service_key_revoke_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return json({ error: "Invalid request body" }, 400);
    }
    const { id } = parsed.data;
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
      if (!ctx) {
        return json(
          { ok: false, error: "Invalid or missing service key" },
          401,
        );
      }
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
