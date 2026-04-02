/**
 * public-demo-session — Issue a real Supabase session for the demo workspace.
 *
 * POST only. Credentials live in server secrets (DEMO_AUTH_EMAIL, DEMO_AUTH_PASSWORD).
 * The browser never sees the password — it receives standard access_token + refresh_token.
 *
 * verify_jwt = false (gateway JWT disabled; no user JWT needed to call this).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logJson } from "../_shared/logger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const DEMO_EMAIL = Deno.env.get("DEMO_AUTH_EMAIL") ?? "";
const DEMO_PASSWORD = Deno.env.get("DEMO_AUTH_PASSWORD") ?? "";

const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function json(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, corsHeaders);
  }

  if (!DEMO_EMAIL || !DEMO_PASSWORD) {
    logJson("error", "demo_session_not_configured", {});
    return json(
      { error: "Demo mode is not configured on this instance" },
      503,
      corsHeaders,
    );
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ?? "unknown";

  if (isRateLimited(clientIp)) {
    logJson("warn", "demo_session_rate_limited", { ip: clientIp });
    return json(
      { error: "Too many requests — try again shortly" },
      429,
      corsHeaders,
    );
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await sb.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (error || !data.session) {
      logJson("error", "demo_session_sign_in_failed", {
        detail: error?.message ?? "No session returned",
      });
      return json({ error: "Demo sign-in failed" }, 500, corsHeaders);
    }

    logJson("info", "demo_session_issued", { ip: clientIp });

    return json(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        user: data.session.user,
      },
      200,
      corsHeaders,
    );
  } catch (err) {
    logJson("error", "demo_session_unhandled", {
      detail: err instanceof Error ? err.message : String(err),
    });
    return json({ error: "Internal server error" }, 500, corsHeaders);
  }
});
