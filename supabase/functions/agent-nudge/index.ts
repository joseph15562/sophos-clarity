import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logJson } from "../_shared/logger.ts";

/**
 * agent-nudge — Supabase cron Edge Function
 *
 * Runs daily. For every agent that hasn't submitted an assessment in
 * the last 24 hours, queues a `run-assessment` pending command so the
 * agent picks it up on its next heartbeat.
 *
 * Also marks agents with no heartbeat in 48 h as "offline".
 *
 * Invoke via Supabase cron (pg_cron + pg_net) or manually:
 *   curl -X POST <FUNCTION_URL>/agent-nudge
 */

serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const now = Date.now();
  const oneDayAgo = new Date(now - 24 * 3_600_000).toISOString();
  const twoDaysAgo = new Date(now - 48 * 3_600_000).toISOString();

  // 1. Queue run-assessment for agents that haven't submitted in 24 h
  const { data: staleAgents, error: fetchErr } = await db
    .from("agents")
    .select("id, name, last_seen_at, pending_command")
    .lt("last_seen_at", oneDayAgo)
    .is("pending_command", null);

  if (fetchErr) {
    logJson("error", "agent_nudge_fetch", { message: fetchErr.message });
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  let nudged = 0;
  for (const agent of staleAgents ?? []) {
    const { error } = await db
      .from("agents")
      .update({ pending_command: "run-assessment" })
      .eq("id", agent.id);
    if (!error) nudged++;
  }

  // 2. Mark agents with no heartbeat in 48 h as offline
  const { count: offlined } = await db
    .from("agents")
    .update({ status: "offline" }, { count: "exact" })
    .lt("last_seen_at", twoDaysAgo)
    .neq("status", "offline");

  logJson("info", "agent_nudge_complete", { nudged, offlined: offlined ?? 0 });

  return new Response(
    JSON.stringify({ nudged, offlined: offlined ?? 0, checked: staleAgents?.length ?? 0 }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
