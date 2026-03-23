"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Activity, LogIn } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadScoreHistoryForFleet, type ScoreHistoryEntry } from "@/lib/score-history";
import { Skeleton } from "@/components/ui/skeleton";

export interface AssessmentPulseProps {
  orgId: string;
  currentScore?: number;
  currentGrade?: string;
  isGuest: boolean;
}

function countLast30Days(entries: ScoreHistoryEntry[]): number {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return entries.filter((e) => {
    const t = new Date(e.assessed_at).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  }).length;
}

export function AssessmentPulse({ orgId, currentScore, currentGrade, isGuest }: AssessmentPulseProps) {
  const [loading, setLoading] = useState(!isGuest && !!orgId);
  const [history, setHistory] = useState<ScoreHistoryEntry[]>([]);

  useEffect(() => {
    if (isGuest || !orgId) {
      setHistory([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadScoreHistoryForFleet(orgId, 10).then((rows) => {
      if (cancelled) return;
      setHistory(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, isGuest]);

  if (isGuest) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-3">
        <LogIn className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm text-muted-foreground">Sign in to track score history</p>
      </div>
    );
  }

  if (!orgId) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }

  const recent = history[0];
  const prior = history[1];
  const displayScore = currentScore ?? recent?.overall_score;
  const displayGrade = currentGrade ?? recent?.overall_grade;
  const prevScore = prior?.overall_score;
  const hasDelta = displayScore !== undefined && prevScore !== undefined;
  const delta = hasDelta ? displayScore - prevScore : null;
  const count30 = countLast30Days(history);
  const firstOnly = history.length <= 1;

  return (
    <Card className="rounded-xl border border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
          <CardTitle className="text-base font-display">Assessment Pulse</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {displayScore !== undefined && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-extrabold tabular-nums">{displayScore}</span>
            {displayGrade && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-muted text-foreground">{displayGrade}</span>
            )}
            {firstOnly && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF]">
                First assessment
              </span>
            )}
            {!firstOnly && delta !== null && delta !== 0 && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
                  delta > 0 ? "text-[#00F2B3] dark:text-[#00F2B3]" : "text-[#EA0022]"
                }`}
              >
                {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {delta > 0 ? "+" : ""}
                {delta} vs previous
              </span>
            )}
            {!firstOnly && delta === 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">No change vs previous</span>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{count30}</span> assessment
          {count30 === 1 ? "" : "s"} in the last 30 days
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">Keep assessing monthly to track improvement</p>
      </CardContent>
    </Card>
  );
}
