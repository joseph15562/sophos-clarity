import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logJson } from "../_shared/logger.ts";

/**
 * agent-daily-presence — Supabase cron Edge Function
 *
 * Records one UTC calendar-day row per agent in `agent_daily_presence` so the
 * fleet **Agent Status (Last 7 Days)** timeline can show activity without a
 * full assessment submission. Does not update `agents.last_seen_at`.
 *
 * Invoke via pg_cron + pg_net (see migration) or manually:
 *   curl -X POST <FUNCTION_URL>/agent-daily-presence
 */

const PAGE = 1000;
const UPSERT_CHUNK = 500;

serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const dayStr = new Date().toISOString().slice(0, 10);

  const agents: { id: string; org_id: string }[] = [];
  for (let from = 0;; from += PAGE) {
    const { data, error } = await db
      .from("agents")
      .select("id, org_id")
      .range(from, from + PAGE - 1);
    if (error) {
      logJson("error", "agent_daily_presence_agents", {
        message: error.message,
      });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!data?.length) break;
    agents.push(...(data as { id: string; org_id: string }[]));
    if (data.length < PAGE) break;
  }

  logJson("info", "agent_daily_presence_start", {
    day: dayStr,
    agentCount: agents.length,
  });

  let upserted = 0;
  for (let i = 0; i < agents.length; i += UPSERT_CHUNK) {
    const chunk = agents.slice(i, i + UPSERT_CHUNK).map((a) => ({
      agent_id: a.id,
      org_id: a.org_id,
      day: dayStr,
    }));
    const { error } = await db.from("agent_daily_presence").upsert(chunk, {
      onConflict: "agent_id,day",
      ignoreDuplicates: false,
    });
    if (error) {
      logJson("error", "agent_daily_presence_upsert", {
        message: error.message,
      });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    upserted += chunk.length;
  }

  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(
    0,
    10,
  );
  const { error: delErr } = await db.from("agent_daily_presence").delete().lt(
    "day",
    cutoff,
  );
  if (delErr) {
    logJson("warn", "agent_daily_presence_prune", { message: delErr.message });
  }

  logJson("info", "agent_daily_presence_complete", { day: dayStr, upserted });

  return new Response(
    JSON.stringify({ ok: true, day: dayStr, agents: agents.length, upserted }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
