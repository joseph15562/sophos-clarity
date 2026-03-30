import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logJson } from "../_shared/logger.ts";
import { redisGet, redisSet } from "../_shared/upstash-redis.ts";
import { portalDataGetQuerySchema } from "./portal_data_query.ts";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://sophos-firecomply.vercel.app",
  Deno.env.get("ALLOWED_ORIGIN") ?? "",
].filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPlaceholderCustomerName(raw: string): boolean {
  const key = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return (
    key === "thistenant" ||
    key === "unnamed" ||
    key === "unknown" ||
    key === "customer" ||
    key === ""
  );
}

function resolveCustomerName(
  raw: string | null | undefined,
  orgName: string,
): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || isPlaceholderCustomerName(trimmed)) {
    return String(orgName ?? "").trim() || "Customer";
  }
  return trimmed;
}

function normHost(h: string): string {
  return String(h ?? "").split(":")[0].trim().toLowerCase();
}

function gradeFromNumericScore(s: number): string {
  if (s >= 85) return "A";
  if (s >= 70) return "B";
  if (s >= 55) return "C";
  if (s >= 40) return "D";
  return "F";
}

type PortalFindingRich = {
  id: string;
  title: string;
  severity: string;
  section?: string;
  detail?: string;
  remediation?: string;
  evidence?: string;
  confidence?: string;
};

function extractFindingsRich(fullAnalysis: unknown): PortalFindingRich[] {
  if (!fullAnalysis || typeof fullAnalysis !== "object") return [];
  const findings = (fullAnalysis as Record<string, unknown>).findings;
  if (!Array.isArray(findings)) return [];
  return findings.map((raw) => {
    const f = raw as Record<string, unknown>;
    const row: PortalFindingRich = {
      id: String(f.id ?? crypto.randomUUID()),
      title: String(f.title ?? f.message ?? ""),
      severity: String(f.severity ?? "info"),
    };
    if (f.section != null) row.section = String(f.section);
    if (f.detail != null) row.detail = String(f.detail);
    if (f.remediation != null) row.remediation = String(f.remediation);
    if (f.evidence != null) row.evidence = String(f.evidence);
    if (f.confidence != null) row.confidence = String(f.confidence);
    return row;
  });
}

export async function handlePortalDataRequest(req: Request): Promise<Response> {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const parsedQuery = portalDataGetQuerySchema.safeParse({
      slug: url.searchParams.get("slug") ?? undefined,
      org_id: url.searchParams.get("org_id") ?? undefined,
    });
    if (!parsedQuery.success) {
      logJson("warn", "portal_data_invalid_query", {
        issues: parsedQuery.error.issues.length,
      });
      return new Response(
        JSON.stringify({ error: "Invalid query parameters" }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const identifier = parsedQuery.data.slug?.trim() ??
      parsedQuery.data.org_id?.trim() ?? "";

    if (!identifier) {
      return new Response(
        JSON.stringify({ error: "Missing slug or org_id parameter" }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const isUuid = UUID_RE.test(identifier);

    // 1. Resolve portal config
    let configQuery = admin.from("portal_config").select("*");
    if (isUuid) {
      configQuery = configQuery.eq("org_id", identifier);
    } else {
      configQuery = configQuery.eq("slug", identifier.toLowerCase());
    }
    const { data: config, error: configErr } = await configQuery.maybeSingle();

    if (configErr) {
      logJson("error", "portal_data_config_lookup", {
        message: configErr.message,
        code: configErr.code ?? "",
      });
      return new Response(
        JSON.stringify({ error: "Portal not found" }),
        {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const orgId: string = config?.org_id ?? (isUuid ? identifier : "");
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "Portal not found" }),
        {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const tenantName: string | null = config?.tenant_name ?? null;

    const visibleSections: string[] = config?.visible_sections ?? [
      "score",
      "history",
      "findings",
      "compliance",
      "reports",
      "feedback",
    ];

    const includeDetailedFindings = visibleSections.includes(
      "detailed_findings",
    );

    const cacheKey = `portal_data:v2:${orgId}:${
      encodeURIComponent(tenantName ?? "")
    }:${includeDetailedFindings ? "d" : "s"}`;
    const cached = await redisGet(cacheKey);
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    // 2. Build data from agents + agent_submissions (tenant-filtered when applicable)
    let scoreHistory: Array<Record<string, unknown>> = [];
    const findings: Array<{ id: string; title: string; severity: string }> = [];
    const firewallBreakdown: Array<Record<string, unknown>> = [];
    let tenantDisplayName: string | null = null;
    let aggregateScore: number | null = null;
    let aggregateGrade: string | null = null;
    let summaryLatestAssessedAt: string | null = null;
    let savedReportPackages: Array<Record<string, unknown>> = [];

    const { data: orgRow } = await admin
      .from("organisations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();
    const orgDisplayName = String(
      (orgRow as Record<string, unknown> | null)?.name ?? "",
    );

    if (tenantName) {
      const displayTenant = resolveCustomerName(tenantName, orgDisplayName);
      tenantDisplayName = displayTenant;

      const { data: ctRows } = await admin
        .from("central_tenants")
        .select("central_tenant_id, name")
        .eq("org_id", orgId);

      const matchingCentralTenantIds: string[] = [];
      for (const t of ctRows ?? []) {
        const row = t as Record<string, unknown>;
        const tid = String(row.central_tenant_id ?? "");
        const nm = String(row.name ?? "");
        if (!tid) continue;
        if (resolveCustomerName(nm, orgDisplayName) === displayTenant) {
          matchingCentralTenantIds.push(tid);
        }
      }

      let centralFwRows: Array<Record<string, unknown>> = [];
      if (matchingCentralTenantIds.length > 0) {
        const { data: cf } = await admin
          .from("central_firewalls")
          .select(
            "firewall_id, hostname, name, model, serial_number, central_tenant_id, cluster_json",
          )
          .eq("org_id", orgId)
          .in("central_tenant_id", matchingCentralTenantIds);
        centralFwRows = (cf ?? []) as Array<Record<string, unknown>>;
      }

      const { data: agents } = await admin
        .from("agents")
        .select(
          "id, name, serial_number, hardware_model, tenant_name, last_seen_at, firewall_host",
        )
        .eq("org_id", orgId)
        .eq("tenant_name", tenantName)
        .limit(500);

      const agentList = (agents ?? []) as Array<Record<string, unknown>>;

      const tenantHostnames = new Set<string>();
      for (const cf of centralFwRows) {
        const h = normHost(String(cf.hostname ?? cf.name ?? ""));
        if (h) tenantHostnames.add(h);
      }
      for (const ag of agentList) {
        const h = normHost(String(ag.firewall_host ?? ag.name ?? ""));
        if (h) tenantHostnames.add(h);
      }

      const { data: shAll } = await admin
        .from("score_history")
        .select(
          "id, overall_score, overall_grade, findings_count, assessed_at, customer_name, hostname, category_scores",
        )
        .eq("org_id", orgId)
        .order("assessed_at", { ascending: false })
        .limit(500);

      const tenantHistoryRaw = ((shAll ?? []) as Array<Record<string, unknown>>)
        .filter((row) => {
          const hn = normHost(String(row.hostname ?? ""));
          if (tenantHostnames.size > 0 && hn && tenantHostnames.has(hn)) {
            return true;
          }
          const cn = resolveCustomerName(
            String(row.customer_name ?? ""),
            orgDisplayName,
          );
          return cn === displayTenant;
        });
      scoreHistory = tenantHistoryRaw.slice(0, 30);

      const { data: assessBatch } = await admin
        .from("assessments")
        .select(
          "firewalls, customer_name, created_at, overall_score, overall_grade",
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);

      let tenantLatestAssessment: Record<string, unknown> | null = null;
      for (const a of assessBatch ?? []) {
        const ar = a as Record<string, unknown>;
        if (
          resolveCustomerName(
            String(ar.customer_name ?? ""),
            orgDisplayName,
          ) === displayTenant
        ) {
          tenantLatestAssessment = ar;
          break;
        }
      }

      const assessmentScoreByHost = new Map<
        string,
        { score: number; grade: string; at: string }
      >();
      if (
        tenantLatestAssessment?.firewalls &&
        Array.isArray(tenantLatestAssessment.firewalls)
      ) {
        const assessedAt = String(tenantLatestAssessment.created_at ?? "");
        for (
          const fw of tenantLatestAssessment.firewalls as Array<
            Record<string, unknown>
          >
        ) {
          const label = String(fw.label ?? fw.hostname ?? "").trim();
          const rs = fw.riskScore as
            | { overall?: number; grade?: string }
            | undefined;
          const overall = rs?.overall;
          if (overall == null || overall <= 0) continue;
          const grade = rs?.grade ?? gradeFromNumericScore(overall);
          const key = normHost(label) || label.toLowerCase();
          if (!assessmentScoreByHost.has(key)) {
            assessmentScoreByHost.set(key, {
              score: overall,
              grade,
              at: assessedAt,
            });
          }
        }
      }

      const latestHistByHost = new Map<string, Record<string, unknown>>();
      for (const row of tenantHistoryRaw) {
        const hn = normHost(String(row.hostname ?? ""));
        if (!hn || latestHistByHost.has(hn)) continue;
        latestHistByHost.set(hn, row);
      }

      const agentIds = agentList.map((a) => a.id as string);
      const latestByAgent = new Map<string, Record<string, unknown>>();
      const allSubs: Array<Record<string, unknown>> = [];

      if (agentIds.length > 0) {
        const submissionSelect = includeDetailedFindings
          ? "id, agent_id, overall_score, overall_grade, findings_summary, created_at, full_analysis"
          : "id, agent_id, overall_score, overall_grade, findings_summary, created_at";

        const { data: submissions } = await admin
          .from("agent_submissions")
          .select(submissionSelect)
          .eq("org_id", orgId)
          .in("agent_id", agentIds)
          .order("created_at", { ascending: false })
          .limit(1000);

        for (
          const sub of (submissions ?? []) as unknown as Array<
            Record<string, unknown>
          >
        ) {
          const aid = sub.agent_id as string;
          if (!latestByAgent.has(aid)) latestByAgent.set(aid, sub);
          allSubs.push(sub);
        }
      }

      const agentByHostNorm = new Map<string, Record<string, unknown>>();
      const agentBySerial = new Map<string, Record<string, unknown>>();
      for (const a of agentList) {
        const h = normHost(String(a.firewall_host ?? a.name ?? ""));
        if (h) agentByHostNorm.set(h, a);
        const sn = String(a.serial_number ?? "").trim().toLowerCase();
        if (sn) agentBySerial.set(sn, a);
      }

      function pickFirewallScore(cf: Record<string, unknown>): {
        score: number | null;
        grade: string | null;
        lastAssessed: string | null;
        agent: Record<string, unknown> | null;
        submission: Record<string, unknown> | null;
      } {
        const hn = normHost(String(cf.hostname ?? cf.name ?? ""));
        const serial = String(cf.serial_number ?? "").trim().toLowerCase();
        const agent = (serial ? agentBySerial.get(serial) : null) ??
          (hn ? agentByHostNorm.get(hn) : null);
        if (agent) {
          const sub = latestByAgent.get(agent.id as string);
          if (
            sub && sub.overall_score != null && Number(sub.overall_score) > 0
          ) {
            return {
              score: Number(sub.overall_score),
              grade: String(sub.overall_grade ?? ""),
              lastAssessed: String(sub.created_at ?? ""),
              agent,
              submission: sub,
            };
          }
        }
        const hist = hn ? latestHistByHost.get(hn) : undefined;
        if (
          hist && hist.overall_score != null && Number(hist.overall_score) > 0
        ) {
          return {
            score: Number(hist.overall_score),
            grade: String(hist.overall_grade ?? ""),
            lastAssessed: String(hist.assessed_at ?? ""),
            agent: agent ?? null,
            submission: null,
          };
        }
        const lbl = String(cf.hostname ?? cf.name ?? "").trim();
        const ak = normHost(lbl) || lbl.toLowerCase();
        const fromAssess = assessmentScoreByHost.get(ak);
        if (fromAssess) {
          return {
            score: fromAssess.score,
            grade: fromAssess.grade,
            lastAssessed: fromAssess.at,
            agent: agent ?? null,
            submission: null,
          };
        }
        return {
          score: null,
          grade: null,
          lastAssessed: null,
          agent: agent ?? null,
          submission: null,
        };
      }

      const usedAgentIds = new Set<string>();

      if (centralFwRows.length > 0) {
        const seenCfIds = new Set<string>();
        for (const cf of centralFwRows) {
          const fwid = String(cf.firewall_id ?? "");
          if (fwid && seenCfIds.has(fwid)) continue;
          if (fwid) seenCfIds.add(fwid);
          const label = String(cf.hostname ?? cf.name ?? "Firewall");
          const hnRaw = String(cf.hostname ?? cf.name ?? "");
          const picked = pickFirewallScore(cf);
          if (picked.agent) usedAgentIds.add(picked.agent.id as string);

          const base: Record<string, unknown> = {
            agentId: fwid ? `cf:${fwid}` : `cf:${label}`,
            hostname: hnRaw || label,
            label,
            serialNumber: cf.serial_number ?? null,
            model: cf.model ?? null,
            score: picked.score,
            grade: picked.grade,
            lastSeen: null,
            lastAssessed: picked.lastAssessed,
          };
          if (includeDetailedFindings && picked.submission) {
            base.findingsRich = extractFindingsRich(
              picked.submission.full_analysis,
            );
          }
          firewallBreakdown.push(base);
        }
      }

      for (const agent of agentList) {
        if (usedAgentIds.has(agent.id as string)) continue;
        const label = String(agent.name ?? agent.firewall_host ?? "Firewall");
        const latest = latestByAgent.get(agent.id as string);
        const row: Record<string, unknown> = {
          agentId: agent.id,
          hostname: String(agent.firewall_host ?? agent.name ?? label),
          label,
          serialNumber: agent.serial_number ?? null,
          model: agent.hardware_model ?? null,
          score: latest && latest.overall_score != null &&
              Number(latest.overall_score) > 0
            ? Number(latest.overall_score)
            : null,
          grade: latest ? (latest.overall_grade as string) : null,
          lastSeen: agent.last_seen_at ?? null,
          lastAssessed: latest ? String(latest.created_at ?? "") : null,
        };
        if (includeDetailedFindings && latest) {
          row.findingsRich = extractFindingsRich(latest.full_analysis);
        }
        firewallBreakdown.push(row);
      }

      firewallBreakdown.sort((a, b) =>
        String(a.label ?? "").localeCompare(String(b.label ?? ""), undefined, {
          sensitivity: "base",
        })
      );

      if (scoreHistory.length === 0 && allSubs.length > 0) {
        scoreHistory = allSubs.slice(0, 30).map((sub) => {
          const ag = agentList.find((x) => x.id === sub.agent_id);
          return {
            id: sub.id,
            overall_score: sub.overall_score,
            overall_grade: sub.overall_grade,
            findings_count: Array.isArray(sub.findings_summary)
              ? (sub.findings_summary as unknown[]).length
              : 0,
            assessed_at: sub.created_at,
            customer_name: displayTenant,
            hostname: String(ag?.firewall_host ?? ag?.name ?? ""),
          };
        });
      }

      const scoredFw = firewallBreakdown
        .map((f) => f.score as number | null)
        .filter((s): s is number => s != null && s > 0);
      if (scoredFw.length > 0) {
        aggregateScore = Math.round(
          scoredFw.reduce((a, b) => a + b, 0) / scoredFw.length,
        );
        aggregateGrade = gradeFromNumericScore(aggregateScore);
      } else if (tenantHistoryRaw[0]) {
        const top = tenantHistoryRaw[0];
        aggregateScore = Number(top.overall_score ?? 0);
        aggregateGrade = String(top.overall_grade ?? "F");
      } else if (
        tenantLatestAssessment && tenantLatestAssessment.overall_score != null
      ) {
        aggregateScore = Number(tenantLatestAssessment.overall_score);
        aggregateGrade = String(
          tenantLatestAssessment.overall_grade ??
            gradeFromNumericScore(aggregateScore),
        );
      }

      const dates: string[] = [];
      for (const f of firewallBreakdown) {
        if (f.lastAssessed) dates.push(String(f.lastAssessed));
      }
      for (const row of tenantHistoryRaw.slice(0, 5)) {
        if (row.assessed_at) dates.push(String(row.assessed_at));
      }
      if (tenantLatestAssessment?.created_at) {
        dates.push(String(tenantLatestAssessment.created_at));
      }
      if (dates.length > 0) {
        summaryLatestAssessedAt = dates.sort(
          (a, b) => new Date(b).getTime() - new Date(a).getTime(),
        )[0];
      }

      if (
        tenantLatestAssessment?.firewalls &&
        Array.isArray(tenantLatestAssessment.firewalls)
      ) {
        for (
          const fw of tenantLatestAssessment.firewalls as Array<
            Record<string, unknown>
          >
        ) {
          const fwFindings = fw.findings;
          if (Array.isArray(fwFindings)) {
            for (const f of fwFindings) {
              const finding = f as Record<string, unknown>;
              findings.push({
                id: String(finding.id ?? crypto.randomUUID()),
                title: String(finding.title ?? finding.message ?? ""),
                severity: String(finding.severity ?? "info"),
              });
            }
          }
        }
      }

      if (findings.length === 0) {
        for (const [, sub] of latestByAgent) {
          const fs = sub.findings_summary;
          if (Array.isArray(fs)) {
            for (const f of fs as Array<Record<string, unknown>>) {
              findings.push({
                id: String(f.id ?? crypto.randomUUID()),
                title: String(f.title ?? f.message ?? ""),
                severity: String(f.severity ?? "info"),
              });
            }
          }
        }
      }

      if (
        findings.length === 0 && tenantHistoryRaw.length > 0 &&
        !tenantLatestAssessment
      ) {
        const { data: latestAny } = await admin
          .from("assessments")
          .select("firewalls")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestAny?.firewalls && Array.isArray(latestAny.firewalls)) {
          for (const fw of latestAny.firewalls) {
            const fwFindings = (fw as Record<string, unknown>)?.findings;
            if (Array.isArray(fwFindings)) {
              for (const f of fwFindings) {
                const finding = f as Record<string, unknown>;
                findings.push({
                  id: String(finding.id ?? crypto.randomUUID()),
                  title: String(finding.title ?? finding.message ?? ""),
                  severity: String(finding.severity ?? "info"),
                });
              }
            }
          }
        }
      }

      const { data: srRows } = await admin
        .from("saved_reports")
        .select(
          "id, customer_name, environment, report_type, reports, analysis_summary, created_at",
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(80);

      savedReportPackages = ((srRows ?? []) as Array<Record<string, unknown>>)
        .filter((row) =>
          resolveCustomerName(
            String(row.customer_name ?? ""),
            orgDisplayName,
          ) === displayTenant
        )
        .map((row) => ({
          id: row.id,
          customer_name: row.customer_name,
          environment: row.environment ?? "",
          report_type: row.report_type ?? "full",
          created_at: row.created_at,
          reports: Array.isArray(row.reports) ? row.reports : [],
          analysis_summary: row.analysis_summary ?? {},
        }));
    } else {
      // ── Org-wide fallback: use score_history + assessments (legacy behaviour) ──
      const { data: sh } = await admin
        .from("score_history")
        .select(
          "id, overall_score, overall_grade, findings_count, assessed_at, customer_name, hostname, category_scores",
        )
        .eq("org_id", orgId)
        .order("assessed_at", { ascending: false })
        .limit(30);

      scoreHistory = (sh ?? []) as Array<Record<string, unknown>>;

      const { data: latestAssessment } = await admin
        .from("assessments")
        .select(
          "id, overall_score, overall_grade, customer_name, firewalls, created_at",
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestAssessment?.firewalls) {
        const fws = Array.isArray(latestAssessment.firewalls)
          ? latestAssessment.firewalls
          : [];
        for (const fw of fws) {
          const fwFindings = (fw as Record<string, unknown>)?.findings;
          if (Array.isArray(fwFindings)) {
            for (const f of fwFindings) {
              const finding = f as Record<string, unknown>;
              findings.push({
                id: String(finding.id ?? crypto.randomUUID()),
                title: String(finding.title ?? finding.message ?? ""),
                severity: String(finding.severity ?? "info"),
              });
            }
          }
        }
      }
    }

    // 3. Build branding object
    const branding = config
      ? {
        logoUrl: config.logo_url,
        companyName: config.company_name,
        accentColor: config.accent_color ?? "#2006F7",
        welcomeMessage: config.welcome_message,
        slaInfo: config.sla_info,
        contactEmail: config.contact_email,
        contactPhone: config.contact_phone,
        footerText: config.footer_text,
        showBranding: config.show_branding ?? true,
      }
      : null;

    const historyCustomerRaw = String(
      (scoreHistory[0] as Record<string, unknown> | undefined)?.customer_name ??
        "",
    );
    const customerNameResolved = resolveCustomerName(
      (tenantDisplayName ??
        tenantName ??
        historyCustomerRaw ??
        "") as string,
      orgDisplayName,
    ) || orgDisplayName || "Customer";

    const payload: Record<string, unknown> = {
      orgId,
      tenantName,
      tenantDisplayName,
      organizationName: orgDisplayName || null,
      aggregateScore,
      aggregateGrade,
      summaryLatestAssessedAt,
      branding,
      visibleSections,
      customerName: customerNameResolved,
      scoreHistory,
      findings,
      savedReports: savedReportPackages,
    };

    if (firewallBreakdown.length > 0) {
      payload.firewalls = firewallBreakdown;
    }

    const body = JSON.stringify(payload);
    await redisSet(cacheKey, body, 45);

    return new Response(body, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    logJson("error", "portal_data_unexpected", {
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
}

serve(handlePortalDataRequest);
