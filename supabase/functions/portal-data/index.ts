import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
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
    const identifier = url.searchParams.get("slug") ?? url.searchParams.get("org_id") ?? "";

    if (!identifier) {
      return new Response(
        JSON.stringify({ error: "Missing slug or org_id parameter" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
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
      console.error("[portal-data] config lookup failed", configErr);
      return new Response(
        JSON.stringify({ error: "Portal not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const orgId: string = config?.org_id ?? (isUuid ? identifier : "");
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "Portal not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
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

    // 2. Build data from agents + agent_submissions (tenant-filtered when applicable)
    let scoreHistory: Array<Record<string, unknown>> = [];
    let findings: Array<{ id: string; title: string; severity: string }> = [];
    let firewallBreakdown: Array<Record<string, unknown>> = [];

    if (tenantName) {
      // ── Tenant-scoped: query agents with matching tenant_name ──
      const { data: agents } = await admin
        .from("agents")
        .select("id, name, serial_number, hardware_model, tenant_name, last_seen_at")
        .eq("org_id", orgId)
        .eq("tenant_name", tenantName);

      if (agents && agents.length > 0) {
        const agentIds = agents.map((a: Record<string, unknown>) => a.id as string);

        // Fetch latest submission per agent
        const { data: submissions } = await admin
          .from("agent_submissions")
          .select("id, agent_id, overall_score, overall_grade, findings_summary, created_at")
          .eq("org_id", orgId)
          .in("agent_id", agentIds)
          .order("created_at", { ascending: false });

        // Group by agent_id — keep only latest per agent
        const latestByAgent = new Map<string, Record<string, unknown>>();
        const allSubs: Array<Record<string, unknown>> = [];
        for (const sub of (submissions ?? []) as Array<Record<string, unknown>>) {
          const aid = sub.agent_id as string;
          if (!latestByAgent.has(aid)) {
            latestByAgent.set(aid, sub);
          }
          allSubs.push(sub);
        }

        // Build score history from all submissions (most recent first)
        scoreHistory = allSubs.slice(0, 30).map((sub) => ({
          id: sub.id,
          overall_score: sub.overall_score,
          overall_grade: sub.overall_grade,
          findings_count: Array.isArray(sub.findings_summary)
            ? (sub.findings_summary as unknown[]).length
            : 0,
          assessed_at: sub.created_at,
          customer_name: tenantName,
        }));

        // Extract findings from the latest submission across all agents
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

        // Per-firewall breakdown for display
        firewallBreakdown = agents.map((agent: Record<string, unknown>) => {
          const latest = latestByAgent.get(agent.id as string);
          return {
            agentId: agent.id,
            label: agent.name ?? "Unnamed",
            serialNumber: agent.serial_number ?? null,
            model: agent.hardware_model ?? null,
            score: latest ? (latest.overall_score as number) : null,
            grade: latest ? (latest.overall_grade as string) : null,
            lastSeen: agent.last_seen_at ?? null,
            lastAssessed: latest ? (latest.created_at as string) : null,
          };
        });
      }
    } else {
      // ── Org-wide fallback: use score_history + assessments (legacy behaviour) ──
      const { data: sh } = await admin
        .from("score_history")
        .select("id, overall_score, overall_grade, findings_count, assessed_at, customer_name, hostname, category_scores")
        .eq("org_id", orgId)
        .order("assessed_at", { ascending: false })
        .limit(30);

      scoreHistory = (sh ?? []) as Array<Record<string, unknown>>;

      const { data: latestAssessment } = await admin
        .from("assessments")
        .select("id, overall_score, overall_grade, customer_name, firewalls, created_at")
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

    const payload: Record<string, unknown> = {
      orgId,
      tenantName,
      branding,
      visibleSections,
      customerName: tenantName
        ?? (scoreHistory[0] as Record<string, unknown>)?.customer_name
        ?? "Customer",
      scoreHistory,
      findings,
    };

    if (firewallBreakdown.length > 0) {
      payload.firewalls = firewallBreakdown;
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
    });
  } catch (err) {
    console.error("[portal-data] unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
