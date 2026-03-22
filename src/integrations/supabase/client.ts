import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

const PLACEHOLDER_URL = "https://dev-placeholder.supabase.co";
const PLACEHOLDER_KEY = "dev-placeholder-anon-key";

/** URL + anon key actually passed to createClient (after dev placeholder resolution). */
let resolvedPublicUrl = "";
let resolvedPublicKey = "";

/**
 * Use for Edge Function calls that must send the same anon key as the Supabase client (e.g. SE guest Central).
 */
export function getSupabasePublicEdgeAuth(): { url: string; anonKey: string } {
  return { url: resolvedPublicUrl, anonKey: resolvedPublicKey };
}

/**
 * Missing/invalid Supabase env used to make `createClient` throw at import time — React never mounted
 * (blank dark `body` only). Allow dev placeholders for Vite dev, localhost, and Vite’s alternate loopback
 * hosts (e.g. 127.50.100.1) so Cursor Simple Browser / LAN URLs work without `.env.local`.
 */
function allowSupabaseDevPlaceholder(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (h === "localhost" || h === "[::1]") return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

function buildClient(): ReturnType<typeof createClient<Database>> {
  let supabaseUrl = rawUrl;
  let supabaseKey = rawKey;

  // #region agent log
  {
    const allow = allowSupabaseDevPlaceholder();
    const hn = typeof window !== "undefined" ? window.location.hostname : "(no window)";
    fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
      body: JSON.stringify({
        sessionId: "360061",
        runId: "verify",
        hypothesisId: "H1",
        location: "client.ts:buildClient:entry",
        message: "supabase buildClient entry",
        data: {
          hasUrl: Boolean(rawUrl),
          hasKey: Boolean(rawKey),
          allowDevPlaceholder: allow,
          viteDev: import.meta.env.DEV,
          hostname: hn,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  if (!supabaseUrl || !supabaseKey) {
    if (allowSupabaseDevPlaceholder()) {
      console.warn(
        "[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY missing — using dev placeholders. Copy .env.example to .env.local for real auth/API.",
      );
      supabaseUrl = PLACEHOLDER_URL;
      supabaseKey = PLACEHOLDER_KEY;
    } else {
      // #region agent log
      fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
        body: JSON.stringify({
          sessionId: "360061",
          runId: "verify",
          hypothesisId: "H1",
          location: "client.ts:buildClient:throw-missing-env",
          message: "throwing missing env (no dev placeholder)",
          data: {
            viteDev: import.meta.env.DEV,
            hostname: typeof window !== "undefined" ? window.location.hostname : "(no window)",
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      throw new Error(
        "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Set them in your deployment environment (see .env.example).",
      );
    }
  }

  const options = {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => {
        return fn();
      },
    },
  };

  try {
    const c = createClient<Database>(supabaseUrl, supabaseKey, options);
    resolvedPublicUrl = supabaseUrl;
    resolvedPublicKey = supabaseKey;
    // #region agent log
    fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
      body: JSON.stringify({
        sessionId: "360061",
        runId: "verify",
        hypothesisId: "H1",
        location: "client.ts:buildClient:success",
        message: "createClient ok",
        data: { usedPlaceholder: supabaseUrl === PLACEHOLDER_URL },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return c;
  } catch (err) {
    if (allowSupabaseDevPlaceholder()) {
      console.warn(
        "[supabase] createClient failed with your env (invalid URL/key?). Using dev placeholders.",
        err,
      );
      resolvedPublicUrl = PLACEHOLDER_URL;
      resolvedPublicKey = PLACEHOLDER_KEY;
      return createClient<Database>(PLACEHOLDER_URL, PLACEHOLDER_KEY, options);
    }
    throw err;
  }
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = buildClient();
