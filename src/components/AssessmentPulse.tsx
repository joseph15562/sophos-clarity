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

export function AssessmentPulse({
  orgId,
  currentScore,
  currentGrade,
  isGuest,
}: AssessmentPulseProps) {
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
      <div className="rounded-xl border border-border/50 bg-card p-5 transition-[box-shadow,border-color] duration-200 hover:shadow-elevated hover:border-border/70 flex items-start gap-3">
        <LogIn className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm text-muted-foreground">Sign in to track score history</p>
      </div>
    );
  }

  if (!orgId) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-5 transition-[box-shadow,border-color] duration-200 hover:shadow-elevated hover:border-border/70 space-y-3">
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
    <div
      className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 shadow-card transition-all duration-200 hover:shadow-elevated hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
      style={{ background: "linear-gradient(145deg, rgba(32,6,247,0.08), rgba(32,6,247,0.02))" }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full blur-[28px] opacity-25 bg-brand-accent" />
      </div>
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(32,6,247,0.22), transparent)",
        }}
      />

      <div className="relative flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-accent/20 bg-brand-accent/10">
          <Activity className="h-3.5 w-3.5 text-brand-accent" aria-hidden />
        </div>
        <span className="text-sm font-display font-bold tracking-tight text-foreground">
          Assessment Pulse
        </span>
      </div>

      <div className="relative space-y-3 text-sm">
        {displayScore !== undefined && (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-3xl font-black tabular-nums text-foreground">{displayScore}</span>
            {displayGrade && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md border border-slate-900/[0.12] dark:border-white/[0.08] bg-white/75 dark:bg-white/[0.04] text-foreground">
                {displayGrade}
              </span>
            )}
            {firstOnly && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-brand-accent/20 bg-brand-accent/10 text-brand-accent">
                First assessment
              </span>
            )}
            {!firstOnly && delta !== null && delta !== 0 && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${
                  delta > 0 ? "text-[#00F2B3]" : "text-[#EA0022]"
                }`}
              >
                {delta > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {delta > 0 ? "+" : ""}
                {delta} vs previous
              </span>
            )}
            {!firstOnly && delta === 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                No change vs previous
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          <span className="font-bold text-foreground tabular-nums">{count30}</span> assessment
          {count30 === 1 ? "" : "s"} in the last 30 days
        </p>
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
          Keep assessing monthly to track improvement
        </p>
      </div>
    </div>
  );
}
