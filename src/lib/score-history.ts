import { supabase } from "@/integrations/supabase/client";

export interface ScoreHistoryEntry {
  id: string;
  hostname: string;
  customer_name: string;
  overall_score: number;
  overall_grade: string;
  category_scores: Array<{ label: string; score: number }>;
  findings_count: number;
  assessed_at: string;
}

export async function saveScoreSnapshot(
  orgId: string,
  hostname: string,
  customerName: string,
  overallScore: number,
  overallGrade: string,
  categoryScores: Array<{ label: string; score: number }>,
  findingsCount: number,
): Promise<void> {
  const { error } = await supabase.from("score_history").insert({
    org_id: orgId,
    hostname,
    customer_name: customerName,
    overall_score: overallScore,
    overall_grade: overallGrade,
    category_scores: categoryScores,
    findings_count: findingsCount,
  } as Record<string, unknown>);
  if (error) console.warn("[score-history] save failed", error.message);
}

export async function loadScoreHistory(
  orgId: string,
  hostname?: string,
  limit = 30,
): Promise<ScoreHistoryEntry[]> {
  let query = supabase
    .from("score_history")
    .select("*")
    .eq("org_id", orgId)
    .order("assessed_at", { ascending: true })
    .limit(limit);

  if (hostname) query = query.eq("hostname", hostname);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as ScoreHistoryEntry[];
}

/** Load all score history for org (for fleet-level queries). Ordered by assessed_at desc. */
export async function loadScoreHistoryForFleet(
  orgId: string,
  limit = 500,
): Promise<ScoreHistoryEntry[]> {
  const { data, error } = await supabase
    .from("score_history")
    .select("*")
    .eq("org_id", orgId)
    .order("assessed_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as ScoreHistoryEntry[];
}
