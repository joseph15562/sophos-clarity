import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { loadHistory } from "@/lib/assessment-history";
import { loadHistoryCloud } from "@/lib/assessment-cloud";
import { loadScoreHistory, type ScoreHistoryEntry } from "@/lib/score-history";
import type { Assessment } from "@/components/ClientPortalView";

/** Stable cache key for TanStack Query when in-memory analysis results change. */
export function analysisResultsFingerprint(results: Record<string, AnalysisResult>): string {
  const entries = Object.entries(results)
    .map(([label, ar]) => `${label}:${computeRiskScore(ar).overall}`)
    .sort();
  return entries.join("|");
}

export async function fetchClientPortalPreviewData(args: {
  isGuest: boolean;
  orgId: string | undefined;
  analysisResults: Record<string, AnalysisResult>;
  signal?: AbortSignal;
}): Promise<{ assessments: Assessment[]; scoreHistory: ScoreHistoryEntry[] }> {
  const { isGuest, orgId, analysisResults, signal } = args;
  const useCloud = !isGuest && !!orgId;
  const snapshots = useCloud ? await loadHistoryCloud(signal) : await loadHistory();

  const assessments: Assessment[] = snapshots
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((s) => ({
      id: s.id,
      date: new Date(s.timestamp).toISOString(),
      score: s.overallScore,
      grade: s.overallGrade,
      label: s.environment,
    }));

  if (Object.keys(analysisResults).length > 0) {
    const scores = Object.values(analysisResults).map((r) => computeRiskScore(r).overall);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const grade =
      avgScore >= 90
        ? "A"
        : avgScore >= 75
          ? "B"
          : avgScore >= 60
            ? "C"
            : avgScore >= 40
              ? "D"
              : "F";
    assessments.unshift({
      id: "current",
      date: new Date().toISOString(),
      score: avgScore,
      grade,
      label: "Current",
    });
  }

  let scoreHistory: ScoreHistoryEntry[] = [];
  if (orgId) {
    scoreHistory = await loadScoreHistory(orgId, undefined, 30, signal);
  }

  return { assessments, scoreHistory };
}
