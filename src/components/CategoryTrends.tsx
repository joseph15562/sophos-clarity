"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { loadScoreHistory, type ScoreHistoryEntry } from "@/lib/score-history";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}

function scoreColorClass(score: number): string {
  if (score >= 75) return "text-[#00995a] dark:text-[#00F2B3]";
  if (score >= 40) return "text-[#F29400]";
  return "text-[#EA0022]";
}

interface CategoryTrendsProps {
  analysisResults: Record<string, AnalysisResult>;
}

export function CategoryTrends({ analysisResults }: CategoryTrendsProps) {
  const [history, setHistory] = useState<ScoreHistoryEntry[]>([]);

  const aggregated = useMemo(() => {
    const results = Object.values(analysisResults);
    if (results.length === 0) return [];
    const scores = results.map((r) => computeRiskScore(r));
    const labelToPcts = new Map<string, number[]>();
    for (const { categories } of scores) {
      for (const c of categories) {
        const arr = labelToPcts.get(c.label) ?? [];
        arr.push(c.pct);
        labelToPcts.set(c.label, arr);
      }
    }
    return Array.from(labelToPcts.entries()).map(([label, pcts]) => ({
      label,
      score: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
    }));
  }, [analysisResults]);

  const hostname = useMemo(() => {
    const first = Object.values(analysisResults)[0];
    return first?.hostname ?? undefined;
  }, [analysisResults]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orgId = await getOrgId();
      if (!orgId || cancelled) return;
      const entries = await loadScoreHistory(orgId, hostname, 30);
      if (!cancelled) setHistory(entries);
    })();
    return () => { cancelled = true; };
  }, [hostname]);

  const hasTrends = history.length >= 2;

  const getSparklinePoints = (label: string): number[] => {
    if (!hasTrends) return [];
    const last5 = history.slice(-5);
    return last5
      .map((e) => e.category_scores?.find((c) => c.label === label)?.score ?? 0)
      .filter((_, i, arr) => arr.some((v) => v > 0) || i === arr.length - 1);
  };

  const getTrend = (label: string): "up" | "down" | "stable" => {
    if (!hasTrends) return "stable";
    const points = getSparklinePoints(label);
    if (points.length < 2) return "stable";
    const first = points[0];
    const last = points[points.length - 1];
    const diff = last - first;
    if (diff > 0) return "up";
    if (diff < 0) return "down";
    return "stable";
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Category Trends</h3>
      {aggregated.length === 0 ? (
        <p className="text-xs text-muted-foreground">No analysis data</p>
      ) : (
        <div className="space-y-0">
          {aggregated.map(({ label, score }) => {
            const points = getSparklinePoints(label);
            const trend = getTrend(label);
            const min = Math.min(0, ...points);
            const max = Math.max(100, ...points);
            const range = max - min || 1;
            const w = 80;
            const h = 20;
            const pad = 2;
            const chartW = w - pad * 2;
            const chartH = h - pad * 2;
            const polyPoints =
              points.length >= 2
                ? points
                    .map((v, i) => {
                      const x = pad + (i / (points.length - 1)) * chartW;
                      const y = pad + chartH - ((v - min) / range) * chartH;
                      return `${x},${y}`;
                    })
                    .join(" ")
                : "";

            return (
              <div
                key={label}
                className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0"
              >
                <span className="text-xs font-medium text-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold tabular-nums ${scoreColorClass(score)}`}>
                    {score}
                  </span>
                  {hasTrends && points.length >= 2 && (
                    <>
                      <svg width={80} height={20} className="shrink-0" aria-hidden>
                        <polyline
                          points={polyPoints}
                          fill="none"
                          stroke="#2006F7"
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {trend === "up" && (
                        <ArrowUp className="h-3 w-3 text-[#00995a] dark:text-[#00F2B3]" aria-hidden />
                      )}
                      {trend === "down" && (
                        <ArrowDown className="h-3 w-3 text-[#EA0022]" aria-hidden />
                      )}
                      {trend === "stable" && (
                        <Minus className="h-3 w-3 text-muted-foreground" aria-hidden />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {aggregated.length > 0 && !hasTrends && (
        <p className="text-xs text-muted-foreground mt-3">Trends require 2+ assessments</p>
      )}
    </div>
  );
}
