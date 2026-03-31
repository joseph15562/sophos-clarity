import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { initEdgeSentry } from "../_shared/sentry-edge.ts";
import { logJson } from "../_shared/logger.ts";
import {
  buildScheduledReportContent,
  computeNextDue,
  type ScheduledReportJobPayload,
  sendScheduledReportEmail,
} from "../_shared/scheduled-report-email.ts";

const CLAIM_BATCH = 20;
const MAX_ATTEMPTS = 6;

function backoffMs(attempts: number): number {
  const base = 60_000;
  const exp = Math.max(0, attempts - 1);
  return Math.min(base * 2 ** exp, 24 * 60 * 60 * 1000);
}

type JobOutboxRow = {
  id: string;
  org_id: string;
  kind: string;
  payload: unknown;
  status: string;
  attempts: number;
  next_run_at: string;
};

type ScheduledReportRow = {
  id: string;
  org_id: string;
  name: string;
  schedule: string;
  recipients: unknown;
  customer_name: string | null;
  organisations?: { name?: string; logo_url?: string };
};

serve(async (req: Request) => {
  initEdgeSentry({ functionName: "process-job-outbox" });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (cronSecret && auth !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sb = createClient(url, key);

  // Recover jobs left in `processing` if a previous invocation crashed mid-batch.
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { error: reapErr } = await sb.from("job_outbox").update({
    status: "pending",
    next_run_at: new Date().toISOString(),
  })
    .eq("status", "processing")
    .lt("updated_at", staleBefore);
  if (reapErr) {
    logJson("warn", "process_job_outbox_reap_stale", {
      message: reapErr.message,
    });
  }

  const { data: claimed, error: claimErr } = await sb.rpc(
    "claim_job_outbox_batch",
    { batch_size: CLAIM_BATCH },
  );

  if (claimErr) {
    logJson("error", "process_job_outbox_claim", { message: claimErr.message });
    return new Response(JSON.stringify({ error: claimErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const jobs = (claimed ?? []) as JobOutboxRow[];
  if (jobs.length === 0) {
    logJson("info", "process_job_outbox_tick", { claimed: 0 });
    return new Response(
      JSON.stringify({ ok: true, claimed: 0, processed: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  logJson("info", "process_job_outbox_claimed", { count: jobs.length });

  const scheduledReportIds = new Set<string>();
  for (const job of jobs) {
    if (job.kind !== "scheduled_report") continue;
    const payload = job.payload as ScheduledReportJobPayload;
    if (payload?.scheduled_report_id) {
      scheduledReportIds.add(payload.scheduled_report_id);
    }
  }

  const reportList: ScheduledReportRow[] = [];
  if (scheduledReportIds.size > 0) {
    const { data: rows, error: repErr } = await sb
      .from("scheduled_reports")
      .select("*, organisations!inner(name, logo_url)")
      .in("id", [...scheduledReportIds]);

    if (repErr) {
      logJson("error", "process_job_outbox_load_reports", {
        message: repErr.message,
      });
      for (const job of jobs) {
        await sb.from("job_outbox").update({
          status: "pending",
          last_error: repErr.message,
          next_run_at: new Date(Date.now() + backoffMs(job.attempts))
            .toISOString(),
        }).eq("id", job.id);
      }
      return new Response(JSON.stringify({ error: repErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    reportList.push(...(rows ?? []) as ScheduledReportRow[]);
  }

  const reportById = new Map(reportList.map((r) => [r.id, r]));
  const orgIds = [...new Set(reportList.map((r) => r.org_id))];

  const submissionsByOrg = new Map<
    string,
    { full_analysis: unknown; customer_name: unknown }[]
  >();

  if (orgIds.length > 0) {
    const { data: subsRows } = await sb
      .from("agent_submissions")
      .select("full_analysis, customer_name, org_id, created_at")
      .in("org_id", orgIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(5000, orgIds.length * 8));

    for (const row of subsRows ?? []) {
      const oid = row.org_id as string;
      const list = submissionsByOrg.get(oid) ?? [];
      if (list.length < 5) {
        list.push({
          full_analysis: row.full_analysis,
          customer_name: row.customer_name,
        });
        submissionsByOrg.set(oid, list);
      }
    }
  }

  let done = 0;
  let retried = 0;
  let dead = 0;

  for (const job of jobs) {
    if (job.kind !== "scheduled_report") {
      logJson("warn", "process_job_outbox_unknown_kind", {
        jobId: job.id,
        kind: job.kind,
      });
      await sb.from("job_outbox").update({
        status: "dead",
        last_error: `Unsupported job kind: ${job.kind}`,
      }).eq("id", job.id);
      dead += 1;
      continue;
    }

    const payload = job.payload as ScheduledReportJobPayload;
    const reportId = payload?.scheduled_report_id;
    if (!reportId) {
      await sb.from("job_outbox").update({
        status: "dead",
        last_error: "Missing scheduled_report_id in payload",
      }).eq("id", job.id);
      dead += 1;
      continue;
    }

    const report = reportById.get(reportId);
    if (!report) {
      await sb.from("job_outbox").update({
        status: "dead",
        last_error: "Scheduled report not found",
      }).eq("id", job.id);
      logJson("error", "process_job_outbox_report_missing", {
        jobId: job.id,
        reportId,
      });
      dead += 1;
      continue;
    }

    const org = report.organisations as
      | { name?: string; logo_url?: string }
      | undefined;
    const submissions = submissionsByOrg.get(report.org_id) ?? [];
    const built = buildScheduledReportContent(report, org, submissions);

    if ("error" in built) {
      const errMsg = built.error;
      await sb.from("job_outbox").update({
        status: "dead",
        last_error: errMsg,
      }).eq("id", job.id);
      logJson("error", "process_job_outbox_build_failed", {
        jobId: job.id,
        reportId,
        error: errMsg,
      });
      dead += 1;
      continue;
    }

    const recipients = (report.recipients as string[]) ?? [];
    const emailResult = await sendScheduledReportEmail(
      recipients,
      built.subject,
      built.html,
    );

    if (emailResult.success) {
      const now = new Date();
      await sb.from("scheduled_reports").update({
        last_sent_at: now.toISOString(),
        next_due_at: computeNextDue(report.schedule, now),
      }).eq("id", report.id);

      await sb.from("job_outbox").update({
        status: "done",
        last_error: null,
      }).eq("id", job.id);

      done += 1;
      logJson("info", "process_job_outbox_sent", {
        jobId: job.id,
        reportId: report.id,
      });
      continue;
    }

    const errText = emailResult.error ?? "Email delivery failed";
    logJson("error", "process_job_outbox_resend", {
      jobId: job.id,
      reportId: report.id,
      attempts: job.attempts,
      error: errText,
    });

    if (job.attempts >= MAX_ATTEMPTS) {
      await sb.from("job_outbox").update({
        status: "dead",
        last_error: errText,
      }).eq("id", job.id);
      logJson("error", "process_job_outbox_dead", {
        jobId: job.id,
        reportId: report.id,
        attempts: job.attempts,
      });
      dead += 1;
    } else {
      await sb.from("job_outbox").update({
        status: "pending",
        last_error: errText,
        next_run_at: new Date(Date.now() + backoffMs(job.attempts))
          .toISOString(),
      }).eq("id", job.id);
      retried += 1;
    }
  }

  logJson("info", "process_job_outbox_complete", {
    claimed: jobs.length,
    done,
    retried,
    dead,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      claimed: jobs.length,
      done,
      retried,
      dead,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
