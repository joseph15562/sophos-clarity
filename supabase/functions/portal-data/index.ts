import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://sophos-clarity.vercel.app",
  Deno.env.get("ALLOWED_ORIGIN") ?? "",
].filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? "";
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

    // If no config row exists but we have a UUID, serve data without branding
    const orgId: string = config?.org_id ?? (isUuid ? identifier : "");
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "Portal not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const visibleSections: string[] = config?.visible_sections ?? [
      "score",
      "history",
      "findings",
      "compliance",
      "reports",
      "feedback",
    ];

    // 2. Fetch score history (last 30 entries)
    const { data: scoreHistory } = await admin
      .from("score_history")
      .select("id, overall_score, overall_grade, findings_count, assessed_at, customer_name, hostname, category_scores")
      .eq("org_id", orgId)
      .order("assessed_at", { ascending: false })
      .limit(30);

    // 3. Fetch latest assessment for findings
    const { data: latestAssessment } = await admin
      .from("assessments")
      .select("id, overall_score, overall_grade, customer_name, firewalls, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Extract findings from the latest assessment's firewalls JSONB
    let findings: Array<{ id: string; title: string; severity: string }> = [];
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

    // 5. Build branding object
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

    const payload = {
      orgId,
      branding,
      visibleSections,
      customerName: latestAssessment?.customer_name
        ?? scoreHistory?.[0]?.customer_name
        ?? "Customer",
      scoreHistory: scoreHistory ?? [],
      findings,
    };

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
