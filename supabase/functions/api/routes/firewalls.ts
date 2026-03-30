import { getOrgMembership } from "../../_shared/auth.ts";
import {
  adminClient,
  json as jsonResponse,
  safeDbError,
  safeError,
  userClient,
} from "../../_shared/db.ts";
import { getServiceKeyContext } from "../../_shared/service-key.ts";

export async function handleFirewallRoutes(
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

  if (
    !(req.method === "GET" && segments[0] === "firewalls" &&
      segments.length === 1)
  ) {
    return null;
  }

  let orgId: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const uc = userClient(authHeader);
    const {
      data: { user },
    } = await uc.auth.getUser();
    if (user) {
      const membership = await getOrgMembership(user.id);
      if (membership) orgId = membership.org_id;
    }
  }
  if (!orgId) {
    const sk = await getServiceKeyContext(req);
    if (sk?.scopes.includes("api:read")) orgId = sk.orgId;
  }
  if (!orgId) return json({ error: "Unauthorized" }, 401);

  const db = adminClient();

  try {
    const { data: firewalls, error: fwErr } = await db
      .from("central_firewalls")
      .select(
        "id, firewall_id, serial_number, hostname, name, firmware_version, model, central_tenant_id",
      )
      .eq("org_id", orgId)
      .limit(1000);

    if (fwErr) return json({ error: safeDbError(fwErr) }, 500);

    // Bounded by org scope; 500 covers most estates
    const { data: submissions } = await db
      .from("agent_submissions")
      .select("id, firewalls, overall_score, overall_grade, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500);

    const byFirewallId: Record<
      string,
      { score: number; grade: string; submitted_at: string }
    > = {};
    for (const sub of submissions ?? []) {
      const fwList =
        (sub.firewalls as Array<{ id?: string; hostname?: string }>) ?? [];
      for (const fw of fwList) {
        const fid = fw.id ?? fw.hostname;
        if (!fid || byFirewallId[fid]) continue;
        byFirewallId[fid] = {
          score: sub.overall_score ?? 0,
          grade: sub.overall_grade ?? "F",
          submitted_at: sub.created_at as string,
        };
      }
    }

    const byHostname: Record<
      string,
      { score: number; grade: string; submitted_at: string }
    > = {};
    for (const sub of submissions ?? []) {
      const fwList =
        (sub.firewalls as Array<{ id?: string; hostname?: string }>) ?? [];
      for (const fw of fwList) {
        const h = fw.hostname;
        if (!h || byHostname[h]) continue;
        byHostname[h] = {
          score: sub.overall_score ?? 0,
          grade: sub.overall_grade ?? "F",
          submitted_at: sub.created_at as string,
        };
      }
    }

    const result = (firewalls ?? []).map((fw) => {
      const scoreInfo = byFirewallId[fw.firewall_id] ??
        byHostname[fw.hostname] ?? null;
      return {
        id: fw.id,
        firewall_id: fw.firewall_id,
        serial_number: fw.serial_number,
        hostname: fw.hostname,
        name: fw.name,
        firmware_version: fw.firmware_version,
        model: fw.model,
        central_tenant_id: fw.central_tenant_id,
        current_score: scoreInfo?.score ?? null,
        current_grade: scoreInfo?.grade ?? null,
        last_assessed_at: scoreInfo?.submitted_at ?? null,
      };
    });

    return json({ data: result });
  } catch (err) {
    return json({ error: safeError(err) }, 500);
  }
}
