import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("REPORT_FROM_EMAIL") ?? "reports@firecomply.io";

const SCHEDULE_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
};

// ---------------------------------------------------------------------------
// One-pager report generation (deterministic, no AI)
// ---------------------------------------------------------------------------

interface Finding {
  title: string;
  severity: string;
  detail?: string;
}

interface ScoreResult {
  overall: number;
  grade: string;
  categories: Array<{ name: string; score: number }>;
}

function computeSimpleScore(findings: Finding[]): ScoreResult {
  let score = 100;
  for (const f of findings) {
    if (f.severity === "critical") score -= 15;
    else if (f.severity === "high") score -= 8;
    else if (f.severity === "medium") score -= 3;
    else if (f.severity === "low") score -= 1;
  }
  score = Math.max(0, Math.min(100, score));
  const grade =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  return { overall: score, grade, categories: [] };
}

function buildOnePagerContent(
  customerName: string,
  findings: Finding[],
  score: ScoreResult
): { subject: string; markdown: string } {
  const severityOrder = ["critical", "high", "medium", "low", "info"];
  const sorted = [...findings].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );
  const top5 = sorted.slice(0, 5);

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;

  const lines: string[] = [];
  lines.push(`# Compliance Report — ${customerName || "Assessment"}`);
  lines.push("");
  lines.push(`**Overall Score:** ${score.overall}/100 | **Grade:** ${score.grade}`);
  lines.push("");
  lines.push(`**Findings:** ${criticalCount} Critical · ${highCount} High · ${mediumCount} Medium · ${findings.length} Total`);
  lines.push("");
  lines.push("## Top 5 Risks");
  lines.push("");
  if (top5.length === 0) {
    lines.push("No findings identified — excellent posture.");
  } else {
    top5.forEach((f, i) => {
      lines.push(`${i + 1}. **${f.title}** — *${f.severity}*`);
    });
  }
  lines.push("");
  lines.push("## Recommended Next Steps");
  lines.push("");
  lines.push("1. Address critical and high severity findings first.");
  lines.push("2. Review and remediate the top 5 risks listed above.");
  lines.push("3. Schedule a follow-up assessment after remediation.");

  const subject = `${customerName || "Firewall"} Compliance Report — Score: ${score.overall}/100 (${score.grade})`;
  return { subject, markdown: lines.join("\n") };
}

// ---------------------------------------------------------------------------
// Markdown to HTML conversion (simple)
// ---------------------------------------------------------------------------

function markdownToHtml(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 style=\"margin-top:24px;margin-bottom:8px;font-size:18px;color:#111;\">$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 style=\"margin-top:0;margin-bottom:16px;font-size:24px;color:#111;\">$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>");

  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ol style=\"padding-left:20px;margin:8px 0;\">$1</ol>");
  html = html.replace(/\n{2,}/g, "<br/><br/>");
  html = html.replace(/\n/g, "<br/>");

  return html;
}

// ---------------------------------------------------------------------------
// Email HTML template
// ---------------------------------------------------------------------------

function buildEmailHtml(
  bodyHtml: string,
  orgName: string,
  logoUrl?: string
): string {
  const logo = logoUrl
    ? `<img src="${logoUrl}" alt="${orgName}" style="max-height:40px;max-width:200px;margin-bottom:16px;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#0a0f1e;padding:24px 32px;color:#ffffff;">
      ${logo}
      <p style="margin:0;font-size:12px;opacity:0.7;">${orgName}</p>
    </div>
    <div style="padding:32px;color:#333;font-size:14px;line-height:1.6;">
      ${bodyHtml}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
      Generated by FireComply · <a href="https://sophos-clarity.vercel.app" style="color:#2006F7;text-decoration:none;">Open Dashboard</a>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Resend email sender
// ---------------------------------------------------------------------------

async function sendEmail(
  to: string[],
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return { success: false, error: `Resend ${resp.status}: ${body}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Compute next due date
// ---------------------------------------------------------------------------

function computeNextDue(schedule: string, from: Date): string {
  const days = SCHEDULE_DAYS[schedule] ?? 30;
  const next = new Date(from.getTime() + days * 86_400_000);
  return next.toISOString();
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // Allow both POST (cron) and GET (manual trigger)
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Preview: POST { report_id, preview: true } with Authorization → return subject, markdown, html, recipients (no send)
  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({})) as { report_id?: string; preview?: boolean };
      if (body.preview && body.report_id) {
        const authHeader = req.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        const userJwt = authHeader.slice(7);
        const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: `Bearer ${userJwt}` } } });
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
        if (!member?.org_id) {
          return new Response(JSON.stringify({ error: "No organisation" }), { status: 403, headers: { "Content-Type": "application/json" } });
        }
        const { data: report, error: reportErr } = await sb
          .from("scheduled_reports")
          .select("*, organisations!inner(name, logo_url)")
          .eq("id", body.report_id)
          .eq("org_id", member.org_id)
          .maybeSingle();
        if (reportErr || !report) {
          return new Response(JSON.stringify({ error: "Report not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        }
        const { data: submissions } = await sb
          .from("agent_submissions")
          .select("full_analysis, customer_name")
          .eq("org_id", report.org_id)
          .order("created_at", { ascending: false })
          .limit(5);
        const allFindings: Finding[] = [];
        for (const sub of submissions ?? []) {
          const analysis = sub.full_analysis as Record<string, unknown> | null;
          if (analysis && Array.isArray(analysis.findings)) {
            for (const f of analysis.findings) {
              if (f && typeof f === "object" && "title" in f && "severity" in f) {
                allFindings.push({ title: String(f.title), severity: String(f.severity), detail: String(f.detail ?? "") });
              }
            }
          }
        }
        const customerName = report.customer_name || (submissions?.[0]?.customer_name as string) || "Client";
        const score = computeSimpleScore(allFindings);
        const { subject, markdown } = buildOnePagerContent(customerName, allFindings, score);
        const org = report.organisations as { name?: string; logo_url?: string } | undefined;
        const orgName = org?.name ?? "FireComply";
        const logoUrl = org?.logo_url ?? undefined;
        const bodyHtml = markdownToHtml(markdown);
        const emailHtml = buildEmailHtml(bodyHtml, orgName, logoUrl);
        const recipients = (report.recipients as string[]) ?? [];
        return new Response(
          JSON.stringify({ subject, markdown, html: emailHtml, recipients }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch {
      // Fall through to cron logic
    }
  }

  // Query reports that are due
  const { data: dueReports, error: queryErr } = await sb
    .from("scheduled_reports")
    .select("*, organisations!inner(name, logo_url)")
    .eq("enabled", true)
    .lte("next_due_at", new Date().toISOString());

  if (queryErr) {
    return new Response(JSON.stringify({ error: queryErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!dueReports || dueReports.length === 0) {
    return new Response(JSON.stringify({ message: "No reports due", processed: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: Array<{ id: string; name: string; success: boolean; error?: string }> = [];

  for (const report of dueReports) {
    try {
      // Get latest assessment data for the org
      const { data: submissions } = await sb
        .from("agent_submissions")
        .select("full_analysis, customer_name")
        .eq("org_id", report.org_id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Extract findings from the latest submissions
      const allFindings: Finding[] = [];
      for (const sub of submissions ?? []) {
        const analysis = sub.full_analysis as Record<string, unknown> | null;
        if (analysis && Array.isArray(analysis.findings)) {
          for (const f of analysis.findings) {
            if (f && typeof f === "object" && "title" in f && "severity" in f) {
              allFindings.push({ title: String(f.title), severity: String(f.severity), detail: String(f.detail ?? "") });
            }
          }
        }
      }

      // Build the report content
      const customerName = report.customer_name || (submissions?.[0]?.customer_name as string) || "Client";
      const score = computeSimpleScore(allFindings);
      const { subject, markdown } = buildOnePagerContent(customerName, allFindings, score);

      // Convert to HTML email
      const org = report.organisations as { name?: string; logo_url?: string } | undefined;
      const orgName = org?.name ?? "FireComply";
      const logoUrl = org?.logo_url ?? undefined;
      const bodyHtml = markdownToHtml(markdown);
      const emailHtml = buildEmailHtml(bodyHtml, orgName, logoUrl);

      // Send via Resend
      const recipients = (report.recipients as string[]) ?? [];
      if (recipients.length === 0) {
        results.push({ id: report.id, name: report.name, success: false, error: "No recipients" });
        continue;
      }

      const emailResult = await sendEmail(recipients, subject, emailHtml);

      // Update the scheduled report
      const now = new Date();
      await sb
        .from("scheduled_reports")
        .update({
          last_sent_at: now.toISOString(),
          next_due_at: computeNextDue(report.schedule, now),
        })
        .eq("id", report.id);

      results.push({
        id: report.id,
        name: report.name,
        success: emailResult.success,
        error: emailResult.error,
      });
    } catch (err) {
      results.push({ id: report.id, name: report.name, success: false, error: String(err) });
    }
  }

  const processed = results.length;
  const succeeded = results.filter((r) => r.success).length;

  return new Response(
    JSON.stringify({ message: `Processed ${processed} reports, ${succeeded} sent`, results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
