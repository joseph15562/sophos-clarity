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

  if (!supabaseUrl || !supabaseKey) {
    if (allowSupabaseDevPlaceholder()) {
      console.warn(
        "[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY missing — using dev placeholders. Copy .env.example to .env.local for real auth/API.",
      );
      supabaseUrl = PLACEHOLDER_URL;
      supabaseKey = PLACEHOLDER_KEY;
    } else {
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
    // Custom auth.lock is supported at runtime; generated client options type is narrower.
    const c = createClient<Database>(supabaseUrl, supabaseKey, options as never);
    resolvedPublicUrl = supabaseUrl;
    resolvedPublicKey = supabaseKey;
    return c;
  } catch (err) {
    if (allowSupabaseDevPlaceholder()) {
      console.warn(
        "[supabase] createClient failed with your env (invalid URL/key?). Using dev placeholders.",
        err,
      );
      resolvedPublicUrl = PLACEHOLDER_URL;
      resolvedPublicKey = PLACEHOLDER_KEY;
      return createClient<Database>(PLACEHOLDER_URL, PLACEHOLDER_KEY, options as never);
    }
    throw err;
  }
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = buildClient();
