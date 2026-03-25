"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { loadScoreHistory, type ScoreHistoryEntry } from "@/lib/score-history";
import { BRAND } from "@/lib/design-tokens";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

async function getOrgId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  if (score >= 75) return "text-[#007A5A] dark:text-[#00F2B3]";
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
    return () => {
      cancelled = true;
    };
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
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(90,0,255,0.04), rgba(56,136,255,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(90,0,255,0.15), rgba(56,136,255,0.12), transparent)",
        }}
      />
      <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-5">
        Category Trends
      </h3>
      {aggregated.length === 0 ? (
        <p className="text-sm text-foreground/45">No analysis data</p>
      ) : (
        <div className="space-y-1">
          {aggregated.map(({ label, score }) => {
            const points = getSparklinePoints(label);
            const trend = getTrend(label);
            const min = Math.min(0, ...points);
            const max = Math.max(100, ...points);
            const range = max - min || 1;
            const w = 100;
            const h = 24;
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
                className="flex items-center justify-between gap-3 py-3 px-3 rounded-xl transition-colors duration-150 hover:bg-slate-950/[0.04] dark:hover:bg-white/[0.03]"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <span className="text-sm font-semibold text-foreground/90 shrink-0 min-w-[8rem]">
                  {label}
                </span>
                <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                  <span className={`text-sm font-black tabular-nums ${scoreColorClass(score)}`}>
                    {score}
                  </span>
                  {hasTrends && points.length >= 2 && (
                    <>
                      <svg width={100} height={24} className="shrink-0" aria-hidden>
                        <polyline
                          points={polyPoints}
                          fill="none"
                          stroke={BRAND.blue}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ filter: "drop-shadow(0 0 4px rgba(56,136,255,0.4))" }}
                        />
                      </svg>
                      {trend === "up" && (
                        <ArrowUp
                          className="h-4 w-4 text-[#007A5A] dark:text-[#00F2B3]"
                          aria-hidden
                        />
                      )}
                      {trend === "down" && (
                        <ArrowDown className="h-4 w-4 text-[#EA0022]" aria-hidden />
                      )}
                      {trend === "stable" && (
                        <Minus className="h-4 w-4 text-foreground/35" aria-hidden />
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
        <p className="text-xs text-foreground/45 mt-4 font-medium">Trends require 2+ assessments</p>
      )}
    </div>
  );
}
