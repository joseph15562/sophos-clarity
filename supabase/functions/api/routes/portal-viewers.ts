import { getOrgMembership } from "../../_shared/auth.ts";
import { adminClient, json as jsonResponse, userClient } from "../../_shared/db.ts";

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return jsonResponse(body, status, corsHeaders);
}

export async function handlePortalViewerRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (segments[0] !== "portal-viewers") return null;

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, corsHeaders);

  const uc = userClient(authHeader);
  const { data: { user } } = await uc.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401, corsHeaders);

  const membership = await getOrgMembership(user.id);
  if (!membership) return json({ error: "Not a member of any organisation" }, 403, corsHeaders);

  const db = adminClient();
  const orgId = membership.org_id;

  // GET /api/portal-viewers — list all viewers for the org
  if (req.method === "GET" && !segments[1]) {
    const { data, error } = await db
      .from("portal_viewers")
      .select("*")
      .eq("org_id", orgId)
      .order("invited_at", { ascending: false });
    if (error) return json({ error: error.message }, 500, corsHeaders);
    return json({ items: data ?? [] }, 200, corsHeaders);
  }

  // POST /api/portal-viewers/invite — invite a new viewer
  if (req.method === "POST" && segments[1] === "invite") {
    const body = await req.json();
    const { email, name } = body as { email?: string; name?: string };
    if (!email) return json({ error: "email required" }, 400, corsHeaders);

    // Check if already invited
    const { data: existing } = await db
      .from("portal_viewers")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existing) {
      if (existing.status === "revoked") {
        await db.from("portal_viewers").update({ status: "pending", invited_at: new Date().toISOString(), invited_by: user.id }).eq("id", existing.id);
        return json({ message: "Re-invited", id: existing.id }, 200, corsHeaders);
      }
      return json({ error: "Already invited" }, 409, corsHeaders);
    }

    // Create Supabase auth user with invite (sends set-password email)
    const portalUrl = `https://sophos-firecomply.vercel.app/portal/${orgId}`;
    let userId: string | null = null;
    try {
      // Check if user already exists in auth
      const { data: existingUsers } = await db.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: invited, error: inviteErr } = await db.auth.admin.inviteUserByEmail(
          email.toLowerCase(),
          { redirectTo: portalUrl },
        );
        if (inviteErr) {
          console.warn("[portal-viewers] invite failed, creating without auth user:", inviteErr.message);
        } else {
          userId = invited?.user?.id ?? null;
        }
      }
    } catch (e) {
      console.warn("[portal-viewers] auth invite error:", e);
    }

    // Insert viewer record
    const { data: viewer, error: insertErr } = await db
      .from("portal_viewers")
      .insert({
        org_id: orgId,
        user_id: userId,
        email: email.toLowerCase(),
        name: name || null,
        invited_by: user.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr) return json({ error: insertErr.message }, 500, corsHeaders);
    return json({ message: "Invited", id: viewer.id, userId }, 201, corsHeaders);
  }

  // POST /api/portal-viewers/reset-password — send password reset
  if (req.method === "POST" && segments[1] === "reset-password") {
    const body = await req.json();
    const { email } = body as { email?: string };
    if (!email) return json({ error: "email required" }, 400, corsHeaders);

    // Verify viewer belongs to this org
    const { data: viewer } = await db
      .from("portal_viewers")
      .select("id")
      .eq("org_id", orgId)
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (!viewer) return json({ error: "Viewer not found" }, 404, corsHeaders);

    const portalResetUrl = `https://sophos-firecomply.vercel.app/portal/${orgId}`;
    const { error: resetErr } = await db.auth.admin.generateLink({
      type: "recovery",
      email: email.toLowerCase(),
      options: { redirectTo: portalResetUrl },
    });
    if (resetErr) return json({ error: resetErr.message }, 500, corsHeaders);
    return json({ message: "Password reset sent" }, 200, corsHeaders);
  }

  // DELETE /api/portal-viewers/:id — revoke access
  if (req.method === "DELETE" && segments[1]) {
    const viewerId = segments[1];
    const { error: delErr } = await db
      .from("portal_viewers")
      .update({ status: "revoked" })
      .eq("id", viewerId)
      .eq("org_id", orgId);
    if (delErr) return json({ error: delErr.message }, 500, corsHeaders);
    return json({ message: "Access revoked" }, 200, corsHeaders);
  }

  return null;
}
