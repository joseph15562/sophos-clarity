import { adminResetMfaBodySchema, authMfaRecoveryBodySchema } from "../../_shared/api-schemas.ts";
import { getOrgMembership } from "../../_shared/auth.ts";
import { adminClient, json as jsonResponse, safeDbError, userClient } from "../../_shared/db.ts";
import { logJson } from "../../_shared/logger.ts";

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return jsonResponse(body, status, corsHeaders);
}

export async function handleAdminRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  // ── Admin routes ──
  if (segments[0] === "admin") {
    const route = segments[1];
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401, corsHeaders);

    const uc = userClient(authHeader);
    const { data: { user } } = await uc.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401, corsHeaders);

    const membership = await getOrgMembership(user.id);
    if (!membership || membership.role !== "admin") {
      return json({ error: "Admin access required" }, 403, corsHeaders);
    }

    if (req.method === "POST" && route === "reset-mfa") {
      const raw = await req.json().catch(() => ({}));
      const parsed = adminResetMfaBodySchema.safeParse(raw);
      if (!parsed.success) {
        logJson("warn", "admin_reset_mfa_invalid_body", { issues: parsed.error.issues.length });
        return json({ error: "Invalid request body" }, 400, corsHeaders);
      }
      const { targetUserId } = parsed.data;

      const db = adminClient();

      // Verify target user belongs to the same org
      const targetMembership = await getOrgMembership(targetUserId);
      if (!targetMembership || targetMembership.org_id !== membership.org_id) {
        return json({ error: "User not found in your organisation" }, 404, corsHeaders);
      }

      // List and delete all MFA factors for the target user
      const { data: factors, error: factorsErr } = await db.auth.admin.mfa.listFactors({
        userId: targetUserId,
      });

      if (factorsErr) return json({ error: safeDbError(factorsErr) }, 500, corsHeaders);

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

      return json({ ok: true, factorsRemoved: totp.length }, 200, corsHeaders);
    }

    return json({ error: "Not found" }, 404, corsHeaders);
  }

  // ── Auth recovery routes (admin approval required) ──
  if (segments[0] === "auth" && segments[1] === "mfa-recovery") {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized — admin session required" }, 401, corsHeaders);

    const uc = userClient(authHeader);
    const { data: { user: caller } } = await uc.auth.getUser();
    if (!caller) return json({ error: "Invalid session" }, 401, corsHeaders);

    const raw = await req.json().catch(() => ({}));
    const parsed = authMfaRecoveryBodySchema.safeParse(raw);
    if (!parsed.success) {
      logJson("warn", "auth_mfa_recovery_invalid_body", { issues: parsed.error.issues.length });
      return json({ error: "Invalid request body" }, 400, corsHeaders);
    }
    const { targetEmail } = parsed.data;

    const db = adminClient();

    // Find the target user
    const { data: users } = await db.auth.admin.listUsers();
    const targetUser = users?.users?.find((u: any) => u.email === targetEmail);
    if (!targetUser) return json({ error: "User not found" }, 404, corsHeaders);

    const callerMembership = await getOrgMembership(caller.id);
    const targetMembership = await getOrgMembership(targetUser.id);

    if (!targetMembership) return json({ error: "User not found" }, 404, corsHeaders);

    // Case 1: Self-recovery — caller is the target user (must have valid session, which we verified above)
    const isSelfRecovery = caller.id === targetUser.id;
    // Case 2: Admin recovery — caller is admin in same org as target
    const isAdminRecovery = callerMembership && callerMembership.role === "admin" && callerMembership.org_id === targetMembership.org_id;

    if (!isSelfRecovery && !isAdminRecovery) {
      return json({ error: "Forbidden — only org admins can reset MFA for other users" }, 403, corsHeaders);
    }

    // Check they actually have TOTP factors
    const { data: factors } = await db.auth.admin.mfa.listFactors({
      userId: targetUser.id,
    });
    const totp = factors?.factors?.filter((f: any) => f.factor_type === "totp") ?? [];
    if (totp.length === 0) {
      return json({ error: "No MFA factors enrolled for this account" }, 400, corsHeaders);
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
      return json({ ok: true, session: null, message: "MFA reset but session creation failed — sign in with your password" }, 200, corsHeaders);
    }

    const tokenHash = linkData.properties?.hashed_token;
    if (tokenHash) {
      const { data: sessionData, error: sessionError } = await db.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (!sessionError && sessionData?.session) {
        return json({ ok: true, session: sessionData.session, factorsRemoved: totp.length }, 200, corsHeaders);
      }
    }

    return json({ ok: true, session: null, factorsRemoved: totp.length, message: "MFA factors removed — sign in with your password" }, 200, corsHeaders);
  }

  return null;
}
