"use client";

import { useEffect, useMemo, useState } from "react";
import { Upload, RefreshCw, Sparkles, TrendingUp, ShieldCheck, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadScoreHistoryForFleet, type ScoreHistoryEntry } from "@/lib/score-history";

export interface WelcomeBackCardProps {
  orgId: string;
  onUpload: () => void;
  onLoadAgent: () => void;
}

export function WelcomeBackCard({ orgId, onUpload, onLoadAgent }: WelcomeBackCardProps) {
  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState<ScoreHistoryEntry | null>(null);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      setLatest(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadScoreHistoryForFleet(orgId, 500).then((entries) => {
      if (cancelled) return;
      setLatest(entries[0] ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const summary = useMemo(() => {
    if (!latest) return null;
    const score = latest.overall_score;
    const grade = latest.overall_grade;
    const posture = score >= 90 ? "Excellent posture" : score >= 75 ? "Strong baseline" : score >= 60 ? "Improvement opportunity" : "Needs attention";
    const delta = score >= 80 ? "Keep momentum with another assessment" : "Run another assessment to uncover the fastest gains";
    const accent = score >= 80 ? "text-[#00F2B3]" : score >= 60 ? "text-[#F29400]" : "text-[#EA0022]";
    return { score, grade, posture, delta, accent };
  }, [latest]);

  if (loading) {
    return (
      <Card className="rounded-[28px] border border-brand-accent/15 bg-card shadow-[0_16px_50px_rgba(32,6,247,0.08)]">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="grid gap-2 sm:grid-cols-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-44" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!latest || !summary) return null;

  const assessed = new Date(latest.assessed_at);
  const dateLabel = Number.isNaN(assessed.getTime())
    ? latest.assessed_at
    : assessed.toLocaleDateString(undefined, { dateStyle: "medium" });

  return (
    <Card className="relative overflow-hidden rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.10),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.12),transparent_28%),linear-gradient(135deg,rgba(8,13,26,0.98),rgba(12,18,34,0.98))] shadow-[0_20px_60px_rgba(32,6,247,0.10)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />
      <CardHeader className="pb-3 pt-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-accent mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Welcome back
            </div>
            <CardTitle className="text-2xl font-display font-black tracking-tight">Your last assessment is ready to build on</CardTitle>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Last assessed on <span className="font-medium text-foreground">{dateLabel}</span>. FireComply can take you from your previous posture to a fresh, client-ready assessment in under two minutes.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 px-5 py-4 text-center min-w-[110px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Last score</p>
            <p className={`text-4xl font-black mt-1 ${summary.accent}`}>{summary.score}</p>
            <p className="text-[11px] font-semibold text-foreground mt-0.5">Grade {summary.grade}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard icon={<ShieldCheck className="h-4 w-4 text-brand-accent" />} label="Posture" value={summary.posture} />
          <MetricCard icon={<TrendingUp className="h-4 w-4 text-[#00F2B3]" />} label="Next best move" value={summary.delta} />
          <MetricCard icon={<Clock3 className="h-4 w-4 text-[#F29400]" />} label="Expected effort" value="Fresh review in under 2 minutes" />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" size="lg" className="gap-2 rounded-xl px-5" onClick={onUpload}>
            <Upload className="h-4 w-4" />
            Upload New Config
          </Button>
          <Button type="button" variant="outline" size="lg" className="gap-2 rounded-xl px-5" onClick={onLoadAgent}>
            <RefreshCw className="h-4 w-4" />
            Load from Agent
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-card/70 px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-sm font-semibold text-foreground mt-2 leading-relaxed">{value}</p>
    </div>
  );
}
