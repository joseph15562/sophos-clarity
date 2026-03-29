import { getOrgMembership } from "../../_shared/auth.ts";
import { adminClient, json as jsonResponse, userClient } from "../../_shared/db.ts";
import { getServiceKeyContext } from "../../_shared/service-key.ts";

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return jsonResponse(body, status, corsHeaders);
}

export async function handleAssessmentRoutes(
  req: Request,
  url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (!(req.method === "GET" && segments[0] === "assessments")) return null;

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
    if (sk?.scopes.includes("api:read:assessments")) orgId = sk.orgId;
  }
  if (!orgId) return json({ error: "Unauthorized" }, 401, corsHeaders);

  const db = adminClient();

  // GET /api/assessments — list (cursor-based pagination)
  if (segments.length === 1) {
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "50"), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count } = await db
      .from("assessments")
      .select("id, org_id, customer_name, environment, overall_score, overall_grade, created_at", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(from, to);

    const total = count ?? 0;
    const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

    return json({
      data: data ?? [],
      total,
      page,
      pageSize,
      totalPages,
    }, 200, corsHeaders);
  }

  // GET /api/assessments/:id — single assessment with scores, findings, full details
  if (segments.length === 2) {
    const id = segments[1];
    const { data: assessment, error: assErr } = await db
      .from("assessments")
      .select("*")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (assErr || !assessment) return json({ error: "Assessment not found" }, 404, corsHeaders);

    // Try to find matching agent_submission for findings/full_analysis (created within 5s)
    const createdAt = assessment.created_at as string;
    const windowStart = new Date(new Date(createdAt).getTime() - 5000).toISOString();
    const windowEnd = new Date(new Date(createdAt).getTime() + 5000).toISOString();

    const { data: submissions } = await db
      .from("agent_submissions")
      .select("id, findings_summary, full_analysis, overall_score, overall_grade, created_at")
      .eq("org_id", orgId)
      .gte("created_at", windowStart)
      .lte("created_at", windowEnd)
      .order("created_at", { ascending: false })
      .limit(1);

    const submission = submissions?.[0];
    const payload = {
      ...assessment,
      findings: submission?.findings_summary ?? [],
      full_analysis: submission?.full_analysis ?? null,
    };

    return json(payload, 200, corsHeaders);
  }

  return null;
}
