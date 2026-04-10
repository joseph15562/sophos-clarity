/**
 * healthz — Ops liveness / readiness probe.
 * Returns 200 with status and optional DB connectivity check.
 * No auth required (verify_jwt = false).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async () => {
  const ts = new Date().toISOString();

  let dbOk: boolean | null = null;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (url && key) {
    try {
      const db = createClient(url, key);
      const { error } = await db.rpc("", {}).maybeSingle();
      // rpc("") will 404 but proves DB connectivity; any non-network error is fine.
      dbOk = !error || !error.message.includes("FetchError");
    } catch {
      dbOk = false;
    }
  }

  const body = {
    status: "ok",
    ts,
    ...(dbOk !== null ? { db: dbOk ? "ok" : "unreachable" } : {}),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
});
