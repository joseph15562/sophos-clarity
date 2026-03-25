import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

export function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export function userClient(authHeader: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

export function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Log the real error server-side, return a generic message for the client. */
export function safeError(err: unknown, fallback = "Internal server error"): string {
  console.error("[edge-fn-error]", err instanceof Error ? (err.stack ?? err.message) : err);
  return fallback;
}

/** Log a DB/PostgREST error, return generic message. */
export function safeDbError(err: { message: string; code?: string } | null): string {
  if (err) console.error("[db-error]", err.message, err.code ?? "");
  return "Database query failed";
}
