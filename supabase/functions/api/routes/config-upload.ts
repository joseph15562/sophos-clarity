import { authenticateSE, runConfigUploadCleanup } from "../../_shared/auth.ts";
import { centralDecrypt, centralEncrypt } from "../../_shared/crypto.ts";
import { adminClient, json as jsonResponse } from "../../_shared/db.ts";
import {
  buildCustomerUploadEmailHtml,
  buildSeNotificationEmailHtml,
  isValidSophosXml,
  MAX_CONFIG_SIZE,
  sendConfigUploadEmail,
} from "../../_shared/email.ts";
import {
  sophosFetchFirewalls,
  sophosFetchTenants,
  sophosGetToken,
  sophosWhoAmI,
} from "../../_shared/sophos-central-api.ts";

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

  // GET /api/config-upload-requests — list requests (JWT required). ?team_id= to filter by team.
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

  // Config upload token routes (config-upload/:token/...)
  if (segments[0] === "config-upload" && segments.length >= 2) {
    const token = segments[1];
    const subRoute = segments[2] ?? null;
    const db = adminClient();

    // GET /api/config-upload/:token — public status check
    if (req.method === "GET" && !subRoute) {
      await runConfigUploadCleanup();

      const { data, error } = await db
        .from("config_upload_requests")
        .select("status, customer_name, expires_at, file_name, central_connected_at, central_data, central_linked_firewall_id, central_linked_firewall_name")
        .eq("token", token)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Upload link not found" }, 404);
      if (new Date(data.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410);

      return json({
        status: data.status,
        customer_name: data.customer_name,
        expires_at: data.expires_at,
        file_name: data.file_name,
        central_connected: !!data.central_connected_at,
        central_tenants: data.central_data ? (data.central_data as Record<string, unknown>).tenants ?? null : null,
        central_firewalls: data.central_data ? (data.central_data as Record<string, unknown>).firewalls ?? null : null,
        central_account_type: data.central_data ? (data.central_data as Record<string, unknown>).accountType ?? null : null,
        central_linked_firewall_id: data.central_linked_firewall_id,
        central_linked_firewall_name: data.central_linked_firewall_name,
      });
    }

    // POST /api/config-upload/:token — customer uploads XML (public)
    if (req.method === "POST" && !subRoute) {
      const { data: existing, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, status, expires_at, se_email, customer_name, se_user_id")
        .eq("token", token)
        .maybeSingle();

      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!existing) return json({ error: "Upload link not found" }, 404);
      if (new Date(existing.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410);
      if (existing.status === "downloaded") return json({ error: "This configuration has already been downloaded by the SE. Please request a new upload link." }, 409);

      const contentType = req.headers.get("content-type") ?? "";
      let xmlContent = "";
      let fileName = "entities.xml";

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file");
        if (!file || !(file instanceof File)) return json({ error: "No file provided" }, 400);
        if (file.size > MAX_CONFIG_SIZE) return json({ error: "File exceeds 10 MB limit" }, 413);
        fileName = file.name || "entities.xml";
        xmlContent = await file.text();
      } else {
        const contentLength = parseInt(req.headers.get("content-length") ?? "0");
        if (contentLength > MAX_CONFIG_SIZE) return json({ error: "File exceeds 10 MB limit" }, 413);
        xmlContent = await req.text();
      }

      if (!xmlContent.trim()) return json({ error: "Empty file" }, 400);

      if (!isValidSophosXml(xmlContent)) {
        return json({
          error: "This doesn't appear to be a Sophos firewall configuration export. Please export your entities.xml from Sophos Firewall and try again.",
        }, 422);
      }

      const { error: updateErr } = await db
        .from("config_upload_requests")
        .update({
          config_xml: xmlContent,
          file_name: fileName,
          status: "uploaded",
          uploaded_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateErr) return json({ error: updateErr.message }, 500);

      if (existing.se_email) {
        const { data: freshRow } = await db
          .from("config_upload_requests")
          .select("central_connected_at, central_linked_firewall_name")
          .eq("id", existing.id)
          .maybeSingle();
        let centralNote = "";
        if (freshRow?.central_connected_at) {
          centralNote = freshRow.central_linked_firewall_name
            ? `<p style="margin:0 0 12px;">The customer also connected <strong>Sophos Central</strong> (linked to firewall: <strong>${freshRow.central_linked_firewall_name}</strong>).</p>`
            : `<p style="margin:0 0 12px;">The customer also connected <strong>Sophos Central</strong>.</p>`;
        }
        let seName = "";
        if (existing.se_user_id) {
          const { data: seProfile } = await db
            .from("se_profiles")
            .select("display_name, health_check_prepared_by")
            .eq("id", existing.se_user_id)
            .maybeSingle();
          seName = seProfile?.display_name || seProfile?.health_check_prepared_by || "";
        }
        const notifHtml = buildSeNotificationEmailHtml(existing.customer_name ?? "", `${APP_URL}/health-check-2`, centralNote, seName);
        await sendConfigUploadEmail(
          existing.se_email,
          `Config received${existing.customer_name ? ` from ${existing.customer_name}` : ""}`,
          notifHtml,
        );
      }

      return json({ ok: true, message: "Configuration uploaded successfully" });
    }

    // POST /api/config-upload/:token/resend — SE re-sends email (JWT required)
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

    // GET /api/config-upload/:token/download — SE downloads the XML (JWT required, owner or teammate)
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

    // POST /api/config-upload/:token/claim — teammate claims the request (JWT required, team member)
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

    // POST /api/config-upload/:token/central-connect — customer connects Sophos Central (public, apikey)
    if (req.method === "POST" && subRoute === "central-connect") {
      const { data: row, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, status, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Upload request not found" }, 404);
      if (new Date(row.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410);

      const body = await req.json();
      const { client_id, client_secret } = body as { client_id?: string; client_secret?: string };
      if (!client_id?.trim() || !client_secret?.trim()) {
        return json({ error: "Client ID and Client Secret are required" }, 400);
      }

      try {
        const accessToken = await sophosGetToken(client_id.trim(), client_secret.trim());
        const identity = await sophosWhoAmI(accessToken);
        const tenants = await sophosFetchTenants(accessToken, identity);

        let centralData: Record<string, unknown> = {
          accountType: identity.idType,
          tenants,
        };

        if (tenants.length === 1) {
          const fwData = await sophosFetchFirewalls(accessToken, identity, tenants[0].id, tenants);
          centralData = { ...centralData, ...fwData, selectedTenantId: tenants[0].id };
        }

        const encClientId = await centralEncrypt(client_id.trim());
        const encClientSecret = await centralEncrypt(client_secret.trim());

        await db
          .from("config_upload_requests")
          .update({
            central_client_id_enc: encClientId,
            central_client_secret_enc: encClientSecret,
            central_data: centralData,
            central_connected_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        return json({
          ok: true,
          account_type: identity.idType,
          tenants: tenants.map((t) => ({ id: t.id, name: t.name })),
          firewalls: (centralData as Record<string, unknown>).firewalls ?? null,
        });
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "Central connection failed" }, 400);
      }
    }

    // POST /api/config-upload/:token/central-firewalls — fetch firewalls for a selected tenant (public, apikey)
    if (req.method === "POST" && subRoute === "central-firewalls") {
      const { data: row, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, expires_at, central_client_id_enc, central_client_secret_enc, central_data")
        .eq("token", token)
        .maybeSingle();
      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Upload request not found" }, 404);
      if (new Date(row.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410);
      if (!row.central_client_id_enc) return json({ error: "Central not connected yet" }, 400);

      const body = await req.json();
      const { tenant_id } = body as { tenant_id?: string };
      if (!tenant_id?.trim()) return json({ error: "tenant_id is required" }, 400);

      try {
        const clientId = await centralDecrypt(row.central_client_id_enc);
        const clientSecret = await centralDecrypt(row.central_client_secret_enc);
        const accessToken = await sophosGetToken(clientId, clientSecret);
        const identity = await sophosWhoAmI(accessToken);
        const tenants = (row.central_data as Record<string, unknown>)?.tenants as Array<{ id: string; apiHost?: string }> ?? [];
        const fwData = await sophosFetchFirewalls(accessToken, identity, tenant_id.trim(), tenants);

        const updatedCentralData = { ...(row.central_data as Record<string, unknown>), ...fwData, selectedTenantId: tenant_id.trim() };
        await db
          .from("config_upload_requests")
          .update({ central_data: updatedCentralData })
          .eq("id", row.id);

        return json({ ok: true, firewalls: fwData.firewalls });
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "Failed to fetch firewalls" }, 400);
      }
    }

    // POST /api/config-upload/:token/central-link — customer links XML to a firewall (public, apikey)
    if (req.method === "POST" && subRoute === "central-link") {
      const { data: row, error: fetchErr } = await db
        .from("config_upload_requests")
        .select("id, expires_at, central_connected_at")
        .eq("token", token)
        .maybeSingle();
      if (fetchErr) return json({ error: fetchErr.message }, 500);
      if (!row) return json({ error: "Upload request not found" }, 404);
      if (new Date(row.expires_at) <= new Date()) return json({ error: "This upload link has expired" }, 410);
      if (!row.central_connected_at) return json({ error: "Central not connected yet" }, 400);

      const body = await req.json();
      const { firewall_id, firewall_name } = body as { firewall_id?: string; firewall_name?: string };
      if (!firewall_id?.trim()) return json({ error: "firewall_id is required" }, 400);

      await db
        .from("config_upload_requests")
        .update({
          central_linked_firewall_id: firewall_id.trim(),
          central_linked_firewall_name: (firewall_name?.trim()) || null,
        })
        .eq("id", row.id);

      return json({ ok: true });
    }

    // GET /api/config-upload/:token/central-data — SE reads stored Central data (JWT required)
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

    // DELETE /api/config-upload/:token — SE revokes the request (JWT required)
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
