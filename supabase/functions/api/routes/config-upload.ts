import { authenticateSE, runConfigUploadCleanup } from "../../_shared/auth.ts";
import { centralDecrypt } from "../../_shared/crypto.ts";
import { adminClient, json as jsonResponse } from "../../_shared/db.ts";
import {
  buildCustomerUploadEmailHtml,
  sendConfigUploadEmail,
} from "../../_shared/email.ts";

const APP_URL = Deno.env.get("ALLOWED_ORIGIN") ?? "https://sophos-firecomply.vercel.app";

export async function handleConfigUploadRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  function json(body: unknown, status = 200, headers: Record<string, string> = corsHeaders) {
    return jsonResponse(body, status, headers);
  }

  // POST /api/config-upload-request — SE creates an upload link (JWT required)
  if (req.method === "POST" && segments[0] === "config-upload-request" && segments.length === 1) {
    const se = await authenticateSE(req);
    if (!se) return json({ error: "Unauthorized — SE login required" }, 401);

    const body = await req.json();
    const expiresInDays = [1, 3, 7, 14, 30].includes(body.expires_in_days) ? body.expires_in_days : 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const token = crypto.randomUUID();
    const db = adminClient();
    const insertPayload: Record<string, unknown> = {
      se_user_id: se.seProfile.id,
      token,
      customer_name: body.customer_name?.trim() || null,
      contact_name: body.contact_name?.trim() || null,
      customer_email: body.customer_email?.trim() || null,
      se_email: se.user.email,
      expires_at: expiresAt.toISOString(),
    };
    if (body.team_id) insertPayload.team_id = body.team_id;

    const { data: row, error } = await db
      .from("config_upload_requests")
      .insert(insertPayload)
      .select("id, token, expires_at")
      .single();

    if (error) return json({ error: error.message }, 500);

    const uploadUrl = `${APP_URL}/upload/${token}`;
    let emailSent = false;

    if (body.customer_email?.trim()) {
      const seName = se.seProfile.display_name || se.user.email || "Your Sophos SE";
      const expiresFormatted = expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      const contactName = body.contact_name?.trim() || null;
      const emailHtml = buildCustomerUploadEmailHtml(uploadUrl, seName, expiresFormatted, contactName ?? undefined);
      const result = await sendConfigUploadEmail(
        body.customer_email.trim(),
        "Sophos Firewall Health Check — Configuration Upload",
        emailHtml,
      );
      emailSent = result.success;
      if (emailSent) {
        await db.from("config_upload_requests").update({ email_sent: true }).eq("id", row.id);
      }
    }

    return json({ id: row.id, token, url: uploadUrl, expires_at: row.expires_at, email_sent: emailSent }, 201);
  }

  // GET /api/config-upload-requests — list requests (JWT required)
  if (req.method === "GET" && segments[0] === "config-upload-requests" && segments.length === 1) {
    const se = await authenticateSE(req);
    if (!se) return json({ error: "Unauthorized" }, 401);

    await runConfigUploadCleanup();

    const db = adminClient();
    const urlObj = new URL(req.url);
    const teamIdFilter = urlObj.searchParams.get("team_id");

    let query = db
      .from("config_upload_requests")
      .select("id, token, customer_name, contact_name, customer_email, status, expires_at, email_sent, uploaded_at, downloaded_at, created_at, se_user_id, team_id, central_connected_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (teamIdFilter) {
      const { data: mem } = await db
        .from("se_team_members")
        .select("id")
        .eq("team_id", teamIdFilter)
        .eq("se_profile_id", se.seProfile.id)
        .maybeSingle();
      if (!mem) return json({ error: "Not a member of that team" }, 403);
      query = query.eq("team_id", teamIdFilter);
    } else {
      query = query.eq("se_user_id", se.seProfile.id).is("team_id", null);
    }

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ data: data ?? [] });
  }

  // JWT-authenticated config-upload/:token sub-routes
  if (segments[0] === "config-upload" && segments.length >= 2) {
    const token = segments[1];
    const subRoute = segments[2] ?? null;
    const db = adminClient();

    // POST /api/config-upload/:token/resend — SE re-sends email
    if (req.method === "POST" && subRoute === "resend") {
      const se = await authenticateSE(req);
      if (!se) return json({ error: "Unauthorized" }, 401);

      const { data: row, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, customer_email, expires_at, se_user_id")
        .eq("token", token)
        .maybeSingle();

      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Upload request not found" }, 404);
      if (row.se_user_id !== se.seProfile.id) return json({ error: "Forbidden" }, 403);
      if (!row.customer_email) return json({ error: "No customer email on file" }, 400);
      if (new Date(row.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410);

      const uploadUrl = `${APP_URL}/upload/${token}`;
      const seName = se.seProfile.display_name || se.user.email || "Your Sophos SE";
      const expiresFormatted = new Date(row.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      const emailHtml = buildCustomerUploadEmailHtml(uploadUrl, seName, expiresFormatted);
      const result = await sendConfigUploadEmail(
        row.customer_email,
        "Sophos Firewall Health Check — Configuration Upload",
        emailHtml,
      );

      if (result.success) {
        await db.from("config_upload_requests").update({ email_sent: true }).eq("id", row.id);
      }

      return json({ email_sent: result.success, error: result.error ?? undefined });
    }

    // GET /api/config-upload/:token/download — SE downloads the XML
    if (req.method === "GET" && subRoute === "download") {
      const se = await authenticateSE(req);
      if (!se) return json({ error: "Unauthorized" }, 401);

      const { data: row, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, config_xml, file_name, status, se_user_id, team_id")
        .eq("token", token)
        .maybeSingle();

      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Upload request not found" }, 404);

      let hasAccess = row.se_user_id === se.seProfile.id;
      if (!hasAccess && row.team_id) {
        const { data: mem } = await db
          .from("se_team_members")
          .select("id")
          .eq("team_id", row.team_id)
          .eq("se_profile_id", se.seProfile.id)
          .maybeSingle();
        hasAccess = !!mem;
      }
      if (!hasAccess) return json({ error: "Forbidden" }, 403);
      if (!row.config_xml) return json({ error: "No configuration has been uploaded yet" }, 404);

      await db
        .from("config_upload_requests")
        .update({ downloaded_at: new Date().toISOString(), status: "downloaded" })
        .eq("id", row.id);

      return json({ config_xml: row.config_xml, file_name: row.file_name });
    }

    // POST /api/config-upload/:token/claim — teammate claims the request
    if (req.method === "POST" && subRoute === "claim") {
      const se = await authenticateSE(req);
      if (!se) return json({ error: "Unauthorized" }, 401);

      const { data: row, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, se_user_id, team_id, customer_name")
        .eq("token", token)
        .maybeSingle();

      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Upload request not found" }, 404);
      if (!row.team_id) return json({ error: "Only team upload requests can be claimed" }, 400);
      if (row.se_user_id === se.seProfile.id) return json({ error: "You already own this request" }, 400);

      const { data: mem } = await db
        .from("se_team_members")
        .select("id")
        .eq("team_id", row.team_id)
        .eq("se_profile_id", se.seProfile.id)
        .maybeSingle();
      if (!mem) return json({ error: "You are not a member of this team" }, 403);

      const { error: updateErr } = await db
        .from("config_upload_requests")
        .update({ se_user_id: se.seProfile.id })
        .eq("id", row.id);
      if (updateErr) return json({ error: updateErr.message }, 500);

      return json({ ok: true, claimed_by: se.seProfile.id });
    }

    // GET /api/config-upload/:token/central-data — SE reads stored Central data
    if (req.method === "GET" && subRoute === "central-data") {
      const se = await authenticateSE(req);
      if (!se) return json({ error: "Unauthorized" }, 401);

      const { data: row, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, se_user_id, team_id, central_data, central_connected_at, central_linked_firewall_id, central_linked_firewall_name")
        .eq("token", token)
        .maybeSingle();
      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Upload request not found" }, 404);

      let hasAccess = row.se_user_id === se.seProfile.id;
      if (!hasAccess && row.team_id) {
        const { data: mem } = await db
          .from("se_team_members")
          .select("id")
          .eq("team_id", row.team_id)
          .eq("se_profile_id", se.seProfile.id)
          .maybeSingle();
        hasAccess = !!mem;
      }
      if (!hasAccess) return json({ error: "Forbidden" }, 403);

      return json({
        central_connected: !!row.central_connected_at,
        central_data: row.central_data,
        linked_firewall_id: row.central_linked_firewall_id,
        linked_firewall_name: row.central_linked_firewall_name,
      });
    }

    // DELETE /api/config-upload/:token — SE revokes the request
    if (req.method === "DELETE" && !subRoute) {
      const se = await authenticateSE(req);
      if (!se) return json({ error: "Unauthorized" }, 401);

      const { data: row, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, se_user_id")
        .eq("token", token)
        .maybeSingle();

      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Upload request not found" }, 404);
      if (row.se_user_id !== se.seProfile.id) return json({ error: "Forbidden" }, 403);

      await db.from("config_upload_requests").delete().eq("id", row.id);
      return json({ ok: true });
    }
  }

  return null;
}
