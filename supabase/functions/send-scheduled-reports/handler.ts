import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { safeDbError, safeError } from "../_shared/db.ts";
import { logJson } from "../_shared/logger.ts";
import { initEdgeSentry } from "../_shared/sentry-edge.ts";
import {
  buildScheduledReportContent,
  scheduledReportIdempotencyKey,
} from "../_shared/scheduled-report-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export async function handleSendScheduledReports(
  req: Request,
): Promise<Response> {
  initEdgeSentry({ functionName: "send-scheduled-reports" });

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({})) as {
        report_id?: string;
        preview?: boolean;
      };
      if (body.preview && body.report_id) {
        const authHeader = req.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const userJwt = authHeader.slice(7);
        const userClient = createClient(
          SUPABASE_URL,
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: `Bearer ${userJwt}` } } },
        );
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { data: member } = await sb.from("org_members").select("org_id")
          .eq("user_id", user.id).limit(1).maybeSingle();
        if (!member?.org_id) {
          return new Response(JSON.stringify({ error: "No organisation" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { data: report, error: reportErr } = await sb
          .from("scheduled_reports")
          .select("*, organisations!inner(name, logo_url)")
          .eq("id", body.report_id)
          .eq("org_id", member.org_id)
          .maybeSingle();
        if (reportErr || !report) {
          return new Response(JSON.stringify({ error: "Report not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { data: submissions } = await sb
          .from("agent_submissions")
          .select("full_analysis, customer_name")
          .eq("org_id", report.org_id)
          .order("created_at", { ascending: false })
          .limit(5);
        const org = report.organisations as
          | { name?: string; logo_url?: string }
          | undefined;
        const built = buildScheduledReportContent(
          report,
          org,
          submissions ?? [],
          { requireRecipients: false },
        );
        if ("error" in built) {
          return new Response(JSON.stringify({ error: built.error }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const recipients = (report.recipients as string[]) ?? [];
        return new Response(
          JSON.stringify({
            subject: built.subject,
            markdown: built.markdown,
            html: built.html,
            recipients,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
    } catch {
      // Fall through to cron logic
    }
  }

  const { data: dueReports, error: queryErr } = await sb
    .from("scheduled_reports")
    .select("id, org_id, name, next_due_at, recipients")
    .eq("enabled", true)
    .lte("next_due_at", new Date().toISOString())
    .limit(500);

  if (queryErr) {
    return new Response(JSON.stringify({ error: safeDbError(queryErr) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!dueReports || dueReports.length === 0) {
    logJson("info", "send_scheduled_reports_complete", {
      dueCount: 0,
      enqueued: 0,
      skippedDuplicate: 0,
      failed: 0,
    });
    return new Response(
      JSON.stringify({ message: "No reports due", processed: 0 }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  logJson("info", "send_scheduled_reports_start", {
    dueCount: dueReports.length,
  });

  const results: Array<
    { id: string; name: string; success: boolean; error?: string }
  > = [];

  let enqueued = 0;
  let skippedDuplicate = 0;
  const nextRunAt = new Date().toISOString();

  for (const report of dueReports) {
    const recipients = (report.recipients as string[]) ?? [];
    if (recipients.length === 0) {
      results.push({
        id: report.id,
        name: report.name,
        success: false,
        error: "No recipients",
      });
      continue;
    }

    try {
      const idempotencyKey = scheduledReportIdempotencyKey(
        report.id,
        report.next_due_at as string,
      );
      const { error: insErr } = await sb.from("job_outbox").insert({
        org_id: report.org_id,
        kind: "scheduled_report",
        payload: { scheduled_report_id: report.id },
        status: "pending",
        next_run_at: nextRunAt,
        idempotency_key: idempotencyKey,
      });

      if (insErr) {
        const code = (insErr as { code?: string }).code;
        const dup = code === "23505" ||
          /duplicate key|unique constraint/i.test(insErr.message ?? "");
        if (dup) {
          skippedDuplicate += 1;
          results.push({
            id: report.id,
            name: report.name,
            success: true,
            error: "duplicate idempotency (already queued)",
          });
          continue;
        }
        logJson("error", "send_scheduled_reports_enqueue", {
          reportId: report.id,
          message: insErr.message,
          code,
        });
        results.push({
          id: report.id,
          name: report.name,
          success: false,
          error: insErr.message,
        });
        continue;
      }

      enqueued += 1;
      results.push({
        id: report.id,
        name: report.name,
        success: true,
      });
    } catch (err) {
      results.push({
        id: report.id,
        name: report.name,
        success: false,
        error: safeError(err, "Enqueue failed"),
      });
    }
  }

  const failed = results.filter((r) => !r.success).length;

  logJson("info", "send_scheduled_reports_complete", {
    dueCount: dueReports.length,
    enqueued,
    skippedDuplicate,
    failed,
  });

  return new Response(
    JSON.stringify({
      message:
        `Enqueued ${enqueued} job(s), ${skippedDuplicate} duplicate(s) skipped, ${failed} failed`,
      enqueued,
      skippedDuplicate,
      failed,
      results,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
