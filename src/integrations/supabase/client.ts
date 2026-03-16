import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    lock: async (name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => {
      if (!navigator?.locks) return fn();
      try {
        return await navigator.locks.request(name, { mode: "exclusive" }, async () => fn());
      } catch {
        return fn();
      }
    },
  }
});