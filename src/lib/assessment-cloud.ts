import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult } from "./analyse-config";
import { computeRiskScore } from "./risk-score";
import type { AssessmentSnapshot } from "./assessment-history";

export async function saveAssessmentCloud(
  analysisResults: Record<string, AnalysisResult>,
  customerName: string,
  environment: string,
  orgId: string,
): Promise<AssessmentSnapshot | null> {
  const firewalls = Object.entries(analysisResults).map(([label, ar]) => ({
    label,
    riskScore: computeRiskScore(ar),
    totalRules: ar.stats.totalRules,
    totalFindings: ar.findings.length,
  }));

  const scores = firewalls.map((f) => f.riskScore.overall);
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const overallGrade =
    overallScore >= 90 ? "A" : overallScore >= 75 ? "B" : overallScore >= 60 ? "C" : overallScore >= 40 ? "D" : "F";

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      org_id: orgId,
      created_by: user.user.id,
      customer_name: customerName || "Unnamed",
      environment: environment || "Unknown",
      firewalls: firewalls as unknown as Record<string, unknown>,
      overall_score: overallScore,
      overall_grade: overallGrade,
    })
    .select("id, created_at")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    timestamp: new Date(data.created_at).getTime(),
    customerName: customerName || "Unnamed",
    environment: environment || "Unknown",
    firewalls,
    overallScore,
    overallGrade,
  };
}

export async function loadHistoryCloud(): Promise<AssessmentSnapshot[]> {
  const { data, error } = await supabase
    .from("assessments")
    .select("id, customer_name, environment, firewalls, overall_score, overall_grade, created_at")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    customerName: row.customer_name,
    environment: row.environment,
    firewalls: row.firewalls as unknown as AssessmentSnapshot["firewalls"],
    overallScore: row.overall_score,
    overallGrade: row.overall_grade,
  }));
}

export async function deleteAssessmentCloud(id: string): Promise<void> {
  await supabase.from("assessments").delete().eq("id", id);
}

export async function renameAssessmentCloud(
  id: string,
  customerName: string,
  environment: string,
): Promise<void> {
  await supabase
    .from("assessments")
    .update({ customer_name: customerName, environment })
    .eq("id", id);
}
