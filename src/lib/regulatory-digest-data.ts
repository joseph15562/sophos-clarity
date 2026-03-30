import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type RegulatoryUpdateRow = Tables<"regulatory_updates">;

export async function fetchRegulatoryDigestRecent(
  signal?: AbortSignal,
): Promise<RegulatoryUpdateRow[]> {
  let q = supabase
    .from("regulatory_updates")
    .select("id, source, title, summary, link, framework, published_at, created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
