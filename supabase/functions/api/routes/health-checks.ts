import {
  healthCheckBulkTeamBodySchema,
  healthCheckFollowupBodySchema,
  healthCheckTeamBodySchema,
} from "../../_shared/api-schemas.ts";
import { authenticateSE } from "../../_shared/auth.ts";
import { adminClient, json as jsonResponse } from "../../_shared/db.ts";
import { logJson } from "../../_shared/logger.ts";
import {
  buildSophosEmailHtml,
  CONFIG_UPLOAD_FROM_EMAIL,
  escapeHtml,
  RESEND_API_KEY,
} from "../../_shared/email.ts";

const APP_URL = Deno.env.get("ALLOWED_ORIGIN") ??
  "https://sophos-firecomply.vercel.app";

function json(
  body: unknown,
  status = 200,
  corsHeaders: Record<string, string> = {},
) {
  return jsonResponse(body, status, corsHeaders);
}

export async function handleHealthCheckRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (segments[0] !== "health-checks") return null;

  const se = await authenticateSE(req);
  if (!se) return json({ error: "Unauthorized" }, 401, corsHeaders);
  const db = adminClient();

  // PATCH /api/health-checks/:id/team — reassign single check
  if (
    req.method === "PATCH" && segments.length === 3 && segments[2] === "team"
  ) {
    const checkId = segments[1];
    const raw = await req.json().catch(() => ({}));
    const parsed = healthCheckTeamBodySchema.safeParse(raw);
    if (!parsed.success) {
      logJson("warn", "health_check_team_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return json({ error: "Invalid request body" }, 400, corsHeaders);
    }
    const newTeamId = parsed.data.team_id ?? null;

    const { data: row } = await db
      .from("se_health_checks")
      .select("id, se_user_id")
      .eq("id", checkId)
      .maybeSingle();
    if (!row) {
      return json({ error: "Health check not found" }, 404, corsHeaders);
    }
    if (row.se_user_id !== se.seProfile.id) {
      return json(
        { error: "Forbidden — you can only move your own health checks" },
        403,
        corsHeaders,
      );
    }

    if (newTeamId) {
      const { data: mem } = await db
        .from("se_team_members")
        .select("id")
        .eq("team_id", newTeamId)
        .eq("se_profile_id", se.seProfile.id)
        .maybeSingle();
      if (!mem) {
        return json(
          { error: "You are not a member of that team" },
          403,
          corsHeaders,
        );
      }
    }

    await db.from("se_health_checks").update({ team_id: newTeamId }).eq(
      "id",
      checkId,
    );
    return json({ ok: true }, 200, corsHeaders);
  }

  // PATCH /api/health-checks/bulk-team — bulk reassign
  if (
    req.method === "PATCH" && segments.length === 2 &&
    segments[1] === "bulk-team"
  ) {
    const raw = await req.json().catch(() => ({}));
    const parsed = healthCheckBulkTeamBodySchema.safeParse(raw);
    if (!parsed.success) {
      logJson("warn", "health_check_bulk_team_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return json({ error: "Invalid request body" }, 400, corsHeaders);
    }
    const { ids, team_id: teamIdRaw } = parsed.data;
    const newTeamId = teamIdRaw ?? null;

    if (newTeamId) {
      const { data: mem } = await db
        .from("se_team_members")
        .select("id")
        .eq("team_id", newTeamId)
        .eq("se_profile_id", se.seProfile.id)
        .maybeSingle();
      if (!mem) {
        return json(
          { error: "You are not a member of that team" },
          403,
          corsHeaders,
        );
      }
    }

    const { data: rows } = await db
      .from("se_health_checks")
      .select("id")
      .in("id", ids)
      .eq("se_user_id", se.seProfile.id);

    const ownedIds = (rows ?? []).map((r: any) => r.id);
    if (ownedIds.length === 0) {
      return json(
        { error: "No matching health checks found" },
        404,
        corsHeaders,
      );
    }

    await db.from("se_health_checks").update({ team_id: newTeamId }).in(
      "id",
      ownedIds,
    );
    return json({ ok: true, updated: ownedIds.length }, 200, corsHeaders);
  }

  // PATCH /api/health-checks/:id/followup — set or clear follow-up reminder
  if (
    req.method === "PATCH" && segments.length === 3 &&
    segments[2] === "followup"
  ) {
    const checkId = segments[1];
    const raw = await req.json().catch(() => ({}));
    const parsed = healthCheckFollowupBodySchema.safeParse(raw);
    if (!parsed.success) {
      logJson("warn", "health_check_followup_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return json({ error: "Invalid request body" }, 400, corsHeaders);
    }
    const followupAt: string | null = parsed.data.followup_at ?? null;

    const { data: row } = await db
      .from("se_health_checks")
      .select("id, se_user_id")
      .eq("id", checkId)
      .maybeSingle();
    if (!row) {
      return json({ error: "Health check not found" }, 404, corsHeaders);
    }
    if (row.se_user_id !== se.seProfile.id) {
      return json({ error: "Forbidden" }, 403, corsHeaders);
    }

    await db.from("se_health_checks").update({
      followup_at: followupAt,
      followup_sent: false,
    }).eq("id", checkId);
    return json({ ok: true, followup_at: followupAt }, 200, corsHeaders);
  }

  // POST /api/health-checks/process-followups — cron endpoint (service role key required)
  if (
    req.method === "POST" && segments.length === 2 &&
    segments[1] === "process-followups"
  ) {
    const authHeader = req.headers.get("authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (
      !authHeader.includes(serviceKey) &&
      !authHeader.includes("Bearer " + serviceKey)
    ) {
      return json(
        { error: "Unauthorized — service role required" },
        401,
        corsHeaders,
      );
    }
    const { data: due } = await db
      .from("se_health_checks")
      .select(
        "id, customer_name, overall_score, overall_grade, checked_at, se_user_id",
      )
      .lte("followup_at", new Date().toISOString())
      .eq("followup_sent", false)
      .limit(50);

    const seUserIds = [...new Set((due ?? []).map((r) => r.se_user_id))];
    const { data: profiles } = await db
      .from("se_profiles")
      .select("id, email, display_name")
      .in("id", seUserIds);
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    let sent = 0;
    for (const row of due ?? []) {
      const profile = profileById.get(row.se_user_id);
      if (!profile?.email) continue;

      const checkedDate = new Date(row.checked_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const emailHtml = buildSophosEmailHtml(
        "Health Check Follow-Up Reminder",
        `<p>Hi ${escapeHtml(profile.display_name || "there")},</p>
<p>It's time to follow up on the health check for <strong>${
          escapeHtml(row.customer_name || "your customer")
        }</strong>.</p>
<p>Last check was on <strong>${
          escapeHtml(checkedDate)
        }</strong> with a score of <strong>${
          escapeHtml(String(row.overall_score ?? "—"))
        }% (Grade ${escapeHtml(String(row.overall_grade ?? "—"))})</strong>.</p>
<p>Schedule a follow-up session to review their progress and run a new health check.</p>`,
        `${APP_URL}/health-check-2`,
        "Open FireComply",
        "This is an automated follow-up reminder from Sophos FireComply.",
      );

      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: CONFIG_UPLOAD_FROM_EMAIL,
            to: [profile.email],
            subject: `Health Check Follow-Up — ${
              row.customer_name || "Customer"
            }`,
            html: emailHtml,
          }),
        });
        if (emailRes.ok) {
          await db.from("se_health_checks").update({ followup_sent: true }).eq(
            "id",
            row.id,
          );
          sent++;
        }
      } catch { /* swallow per-row errors */ }
    }

    return json(
      { ok: true, processed: (due ?? []).length, sent },
      200,
      corsHeaders,
    );
  }

  return null;
}
