import { z } from "npm:zod@3.24.2";
import { getOrgMembership } from "../../_shared/auth.ts";
import {
  adminClient,
  json as jsonResponse,
  userClient,
} from "../../_shared/db.ts";
import { logJson } from "../../_shared/logger.ts";

export const inviteBodySchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional().nullable(),
  /** Vanity slug — must match portal_config.slug for this org */
  portal_slug: z
    .string()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Invalid portal slug"),
});

function json(
  body: unknown,
  status = 200,
  corsHeaders: Record<string, string> = {},
) {
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
  if (!membership) {
    return json(
      { error: "Not a member of any organisation" },
      403,
      corsHeaders,
    );
  }

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
    const raw = await req.json().catch(() => ({}));
    const parsed = inviteBodySchema.safeParse(raw);
    if (!parsed.success) {
      logJson("warn", "portal_viewers_invite_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return json({ error: "Invalid request body" }, 400, corsHeaders);
    }
    const { email, name, portal_slug: portalSlugRaw } = parsed.data;
    const portalSlug = portalSlugRaw.trim().toLowerCase();

    const { data: portalRow, error: portalErr } = await db
      .from("portal_config")
      .select("id, slug")
      .eq("org_id", orgId)
      .eq("slug", portalSlug)
      .maybeSingle();
    if (portalErr) {
      return json({ error: portalErr.message }, 500, corsHeaders);
    }
    if (!portalRow) {
      return json(
        {
          error:
            "Unknown portal slug for this organisation — save portal settings first",
        },
        400,
        corsHeaders,
      );
    }

    // Check if already invited for this portal
    const { data: existing } = await db
      .from("portal_viewers")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("email", email.toLowerCase())
      .eq("portal_slug", portalSlug)
      .maybeSingle();

    if (existing) {
      if (existing.status === "revoked") {
        await db.from("portal_viewers").update({
          status: "pending",
          invited_at: new Date().toISOString(),
          invited_by: user.id,
        }).eq("id", existing.id);
        return json(
          { message: "Re-invited", id: existing.id },
          200,
          corsHeaders,
        );
      }
      return json({ error: "Already invited" }, 409, corsHeaders);
    }

    const portalPublicBase =
      Deno.env.get("PORTAL_PUBLIC_URL")?.replace(/\/$/, "") ??
        Deno.env.get("SITE_URL")?.replace(/\/$/, "") ??
        "https://sophos-firecomply.vercel.app";
    const portalUrl = `${portalPublicBase}/portal/${
      encodeURIComponent(portalSlug)
    }`;
    let userId: string | null = null;
    try {
      // Check if user already exists in auth
      const { data: existingUsers } = await db.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: { email?: string }) =>
        u.email?.toLowerCase() === email.toLowerCase()
      );

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: invited, error: inviteErr } = await db.auth.admin
          .inviteUserByEmail(
            email.toLowerCase(),
            { redirectTo: portalUrl },
          );
        if (inviteErr) {
          logJson("warn", "portal_viewers_invite_auth_failed", {
            message: inviteErr.message,
          });
        } else {
          userId = invited?.user?.id ?? null;
        }
      }
    } catch (e) {
      logJson("warn", "portal_viewers_auth_invite_error", { error: String(e) });
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
        portal_slug: portalSlug,
      })
      .select("id")
      .single();

    if (insertErr) return json({ error: insertErr.message }, 500, corsHeaders);
    return json(
      { message: "Invited", id: viewer.id, userId },
      201,
      corsHeaders,
    );
  }

  // POST /api/portal-viewers/reset-password — send password reset
  if (req.method === "POST" && segments[1] === "reset-password") {
    const body = await req.json();
    const { email, portal_slug: slugOpt } = body as {
      email?: string;
      portal_slug?: string;
    };
    if (!email) return json({ error: "email required" }, 400, corsHeaders);

    let vq = db
      .from("portal_viewers")
      .select("id, portal_slug")
      .eq("org_id", orgId)
      .eq("email", email.toLowerCase());
    if (slugOpt?.trim()) {
      vq = vq.eq("portal_slug", slugOpt.trim().toLowerCase());
    }
    const { data: matches, error: vMatchErr } = await vq.limit(5);
    if (vMatchErr) return json({ error: vMatchErr.message }, 500, corsHeaders);
    if (!matches?.length) {
      return json({ error: "Viewer not found" }, 404, corsHeaders);
    }
    if (matches.length > 1) {
      return json(
        {
          error:
            "Multiple portal invites for this email — include portal_slug in the request body",
        },
        400,
        corsHeaders,
      );
    }
    const viewer = matches[0];

    const portalPublicBase =
      Deno.env.get("PORTAL_PUBLIC_URL")?.replace(/\/$/, "") ??
        Deno.env.get("SITE_URL")?.replace(/\/$/, "") ??
        "https://sophos-firecomply.vercel.app";
    const slugForReset = String(viewer.portal_slug ?? "").trim();
    const portalResetUrl = slugForReset.length > 0
      ? `${portalPublicBase}/portal/${encodeURIComponent(slugForReset)}`
      : `${portalPublicBase}/portal/${orgId}`;
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
