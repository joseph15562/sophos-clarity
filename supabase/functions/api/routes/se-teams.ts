import { authenticateSE } from "../../_shared/auth.ts";
import { adminClient, json as jsonResponse } from "../../_shared/db.ts";
import { buildSophosEmailHtml, sendConfigUploadEmail } from "../../_shared/email.ts";

const APP_URL = Deno.env.get("ALLOWED_ORIGIN") ?? "https://sophos-firecomply.vercel.app";

export async function handleSeTeamRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  function json(body: unknown, status = 200, hdrs: Record<string, string> = corsHeaders) {
    return jsonResponse(body, status, hdrs);
  }

  if (segments[0] !== "se-teams") return null;

  const se = await authenticateSE(req);
  if (!se) return json({ error: "Unauthorized — SE login required" }, 401);
  const db = adminClient();

  // GET /api/se-teams — list teams the SE belongs to
  if (req.method === "GET" && segments.length === 1) {
    const { data: memberships, error } = await db
      .from("se_team_members")
      .select("id, team_id, role, is_primary, joined_at")
      .eq("se_profile_id", se.seProfile.id)
      .limit(100);
    if (error) return json({ error: error.message }, 500);

    if (!memberships?.length) return json({ data: [] });

    const teamIds = memberships.map((m: any) => m.team_id);
    const { data: teams } = await db
      .from("se_teams")
      .select("id, name, created_by, created_at")
      .in("id", teamIds)
      .limit(100);

    const { data: counts } = await db
      .from("se_team_members")
      .select("team_id")
      .in("team_id", teamIds)
      .limit(1000);

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
      .eq("role", "admin")
      .limit(100);
    if (admins?.length) {
      const adminIds = admins.map((a: any) => a.se_profile_id);
      const { data: adminProfiles } = await db
        .from("se_profiles")
        .select("email")
        .in("id", adminIds)
        .limit(100);
      const joinerName = se.seProfile.display_name || se.user.email || "An SE";
      for (const ap of adminProfiles ?? []) {
        if (ap.email) {
          await sendConfigUploadEmail(
            ap.email,
            `${joinerName} joined your team "${teamInfo?.name ?? "your team"}"`,
            buildSophosEmailHtml("New Team Member", `<p><strong>${joinerName}</strong> has joined your team <strong>${teamInfo?.name ?? "your team"}</strong> on Sophos FireComply.</p>`),
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
        .eq("team_id", teamId)
        .limit(200);

      const profileIds = (members ?? []).map((m: any) => m.se_profile_id);
      const { data: profiles } = await db
        .from("se_profiles")
        .select("id, email, display_name")
        .in("id", profileIds)
        .limit(200);

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
          .eq("role", "admin")
          .limit(100);
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

      const emailHtml = buildSophosEmailHtml(
        "Team Invite",
        `<p style="margin:0 0 20px;">Hi,</p>
<p style="margin:0 0 20px;"><strong>${inviterName}</strong> has invited you to join the <strong>${teamName}</strong> team on Sophos FireComply.</p>
<p style="margin:0 0 20px;">Simply click on the link below to accept the invitation and join the team.</p>`,
        joinLink,
        "Join Team",
        "This invite expires in 14 days.",
      );

      await sendConfigUploadEmail(
        email,
        `You've been invited to join "${teamName}" on Sophos FireComply`,
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
        .order("created_at", { ascending: false })
        .limit(100);
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
