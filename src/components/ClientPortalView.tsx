/**
 * Client portal view — simplified, read-only view for MSP clients.
 * Provides a customer-scoped display with score, trend, and report download.
 */

import { Download } from "lucide-react";
import { ScoreTrendChart } from "@/components/ScoreTrendChart";
import type { ScoreHistoryEntry } from "@/lib/score-history";

export interface Assessment {
  id: string;
  date: string;
  score: number;
  grade: string;
  label?: string;
}

interface ClientPortalViewProps {
  customerName: string;
  assessments: Assessment[];
  scoreHistory: ScoreHistoryEntry[];
  onDownloadReport?: () => void;
  /** Optional org ID for ScoreTrendChart when using cloud score history */
  orgId?: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-[#007A5A] dark:text-[#00F2B3]",
  B: "text-[#009CFB]",
  C: "text-[#F8E300] dark:text-[#F8E300]",
  D: "text-[#F29400]",
  F: "text-[#EA0022]",
};

function gradeColor(grade: string): string {
  return GRADE_COLORS[grade] ?? GRADE_COLORS.C;
}

export function ClientPortalView({
  customerName,
  assessments,
  scoreHistory,
  onDownloadReport,
  orgId,
}: ClientPortalViewProps) {
  const latest = assessments.length > 0 ? assessments[0] : null;
  const latestScore = latest?.score ?? 0;
  const latestGrade = latest?.grade ?? "—";

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-lg font-display font-bold text-foreground">{customerName}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Firewall Configuration Assessment</p>
      </header>

      <main id="main-content" className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Score display */}
        <section className="rounded-xl border border-border/50 bg-card p-8 text-center">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Overall Security Score
          </p>
          <div className="flex items-center justify-center gap-4">
            <span
              className={`text-5xl font-black tabular-nums ${gradeColor(latestGrade)}`}
              aria-label={`Score ${latestScore}`}
            >
              {latestScore}
            </span>
            <span
              className={`text-4xl font-black ${gradeColor(latestGrade)}`}
              aria-label={`Grade ${latestGrade}`}
            >
              {latestGrade}
            </span>
          </div>
          {latest && (
            <p className="text-xs text-muted-foreground mt-2">
              As of{" "}
              {new Date(latest.date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </section>

        {/* Score trend */}
        {(scoreHistory.length > 0 || orgId) && (
          <section>
            <ScoreTrendChart
              orgId={orgId}
              data={scoreHistory.length > 0 ? scoreHistory : undefined}
            />
          </section>
        )}

        {/* Recent assessments */}
        {assessments.length > 0 && (
          <section className="rounded-xl border border-border/50 bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Recent Assessments</h2>
            <ul className="space-y-3">
              {assessments.slice(0, 10).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <span className="text-xs text-foreground">
                      {new Date(a.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {a.label && (
                      <span className="text-[10px] text-muted-foreground ml-2">{a.label}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold tabular-nums ${gradeColor(a.grade)}`}>
                      {a.score}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 ring-current/20 ${gradeColor(a.grade)}`}
                    >
                      {a.grade}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Download report */}
        {onDownloadReport && (
          <section className="flex justify-center">
            <button
              onClick={onDownloadReport}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#2006F7] dark:bg-[#6B5BFF] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Download className="h-4 w-4" />
              Download Latest Report
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
