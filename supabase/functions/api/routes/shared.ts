import { adminClient, json as jsonResponse } from "../../_shared/db.ts";

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return jsonResponse(body, status, corsHeaders);
}

export async function handleSharedRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  // ── Shared report (public, no auth) ──
  if (req.method === "GET" && segments[0] === "shared" && segments.length === 2) {
    const token = segments[1];
    const db = adminClient();
    const { data, error } = await db
      .from("shared_reports")
      .select("share_token, markdown, customer_name, expires_at, created_at, allow_download, advisor_notes")
      .eq("share_token", token)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500, corsHeaders);
    if (!data) return json({ error: "Report not found" }, 404, corsHeaders);

    const expiresAt = new Date(data.expires_at);
    if (expiresAt <= new Date()) {
      return json({ error: "Report has expired" }, 410, corsHeaders);
    }

    return json({
      share_token: data.share_token,
      markdown: data.markdown,
      customer_name: data.customer_name,
      expires_at: data.expires_at,
      created_at: data.created_at,
      allow_download: (data as { allow_download?: boolean }).allow_download !== false,
      advisor_notes: (data as { advisor_notes?: string | null }).advisor_notes ?? null,
    }, 200, corsHeaders);
  }

  // ── Shared SE health check (public, no auth) ──
  if (req.method === "GET" && segments[0] === "shared-health-check" && segments.length === 2) {
    const token = segments[1];
    const db = adminClient();
    const { data, error } = await db
      .from("se_health_checks")
      .select("share_token, shared_html, customer_name, share_expires_at, checked_at")
      .eq("share_token", token)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500, corsHeaders);
    if (!data) return json({ error: "Health check not found" }, 404, corsHeaders);

    const expiresAt = new Date(data.share_expires_at);
    if (expiresAt <= new Date()) {
      return json({ error: "This shared health check has expired" }, 410, corsHeaders);
    }

    return json({
      share_token: data.share_token,
      html: data.shared_html,
      customer_name: data.customer_name,
      expires_at: data.share_expires_at,
      checked_at: data.checked_at,
    }, 200, corsHeaders);
  }

  return null;
}
