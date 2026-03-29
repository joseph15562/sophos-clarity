import { json as jsonResponse, safeError } from "../../_shared/db.ts";
import { getServiceKeyContext } from "../../_shared/service-key.ts";

/** GET /api/service-key/ping — verify X-FireComply-Service-Key / Bearer service secret. */
export async function handleServiceKeyRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  function json(body: unknown, status = 200, headers: Record<string, string> = corsHeaders) {
    return jsonResponse(body, status, headers);
  }

  if (!(req.method === "GET" && segments[0] === "service-key" && segments[1] === "ping" && segments.length === 2)) {
    return null;
  }

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
