import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
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
    overallScore >= 90
      ? "A"
      : overallScore >= 75
        ? "B"
        : overallScore >= 60
          ? "C"
          : overallScore >= 40
            ? "D"
            : "F";

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      org_id: orgId,
      created_by: user.user.id,
      customer_name: customerName || "Unnamed",
      environment: environment || "Unknown",
      firewalls: firewalls as unknown as Json,
      overall_score: overallScore,
      overall_grade: overallGrade,
    })
    .select("id, created_at, reviewer_signed_by, reviewer_signed_at, reviewer_signoff_notes")
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
    reviewerSignedBy: data.reviewer_signed_by,
    reviewerSignedAt: data.reviewer_signed_at,
    reviewerSignoffNotes: data.reviewer_signoff_notes,
  };
}

export async function loadHistoryCloud(signal?: AbortSignal): Promise<AssessmentSnapshot[]> {
  let q = supabase
    .from("assessments")
    .select(
      "id, customer_name, environment, firewalls, overall_score, overall_grade, created_at, reviewer_signed_by, reviewer_signed_at, reviewer_signoff_notes",
    )
    .order("created_at", { ascending: false });
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    customerName: row.customer_name,
    environment: row.environment,
    firewalls: row.firewalls as unknown as AssessmentSnapshot["firewalls"],
    overallScore: row.overall_score,
    overallGrade: row.overall_grade,
    reviewerSignedBy: row.reviewer_signed_by,
    reviewerSignedAt: row.reviewer_signed_at,
    reviewerSignoffNotes: row.reviewer_signoff_notes,
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

export type ReviewerSignoffPayload = {
  signedBy: string;
  signedAtIso: string;
  notes: string | null;
};

/** Clears sign-off when `payload` is null. */
export async function updateAssessmentReviewerSignoff(
  id: string,
  payload: ReviewerSignoffPayload | null,
): Promise<void> {
  if (payload === null) {
    const { error } = await supabase
      .from("assessments")
      .update({
        reviewer_signed_by: null,
        reviewer_signed_at: null,
        reviewer_signoff_notes: null,
      })
      .eq("id", id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("assessments")
    .update({
      reviewer_signed_by: payload.signedBy,
      reviewer_signed_at: payload.signedAtIso,
      reviewer_signoff_notes: payload.notes,
    })
    .eq("id", id);
  if (error) throw error;
}
