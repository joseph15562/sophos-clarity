import { useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore, type RiskScoreResult } from "@/lib/risk-score";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  projected?: RiskScoreResult | null;
}

const GRADE_COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  A: { ring: "ring-[#00F2B3]/30 dark:ring-[#00F2B3]/30", text: "text-[#00F2B3] dark:text-[#00F2B3]", bg: "bg-[#00F2B3]/10 dark:bg-[#00F2B3]/10" },
  B: { ring: "ring-[#00F2B3]/20 dark:ring-[#00F2B3]/20", text: "text-[#00774a] dark:text-[#00F2B3]", bg: "bg-[#00F2B3]/5 dark:bg-[#00F2B3]/5" },
  C: { ring: "ring-[#F8E300]/30", text: "text-[#b8a200] dark:text-[#F8E300]", bg: "bg-[#F8E300]/10" },
  D: { ring: "ring-[#F29400]/30", text: "text-[#c47800] dark:text-[#F29400]", bg: "bg-[#F29400]/10" },
  F: { ring: "ring-[#EA0022]/30", text: "text-[#EA0022]", bg: "bg-[#EA0022]/10" },
};

function GaugeRing({ score, grade, projectedScore, projectedGrade }: {
  score: number; grade: string; projectedScore?: number; projectedGrade?: string;
}) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.C;
  const hasProjection = projectedScore != null && projectedScore !== score;

  const strokeColor =
    grade === "A" || grade === "B" ? "#00F2B3" : grade === "C" ? "#F8E300" : grade === "D" ? "#F29400" : "#EA0022";

  const projOffset = hasProjection ? circumference - (projectedScore / 100) * circumference : circumference;
  const delta = hasProjection ? projectedScore - score : 0;

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 120 120" role="img" aria-label={`Risk score gauge: ${score} out of 100`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        {hasProjection && (
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke="#00EDFF"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={projOffset}
            strokeLinecap="round"
            className="transition-all duration-700"
            opacity={0.5}
          />
        )}
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={strokeColor}
          strokeWidth={hasProjection ? 4 : 8}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="text-center z-10">
        <span className={`text-3xl font-extrabold ${colors.text}`}>{score}</span>
        {hasProjection && (
          <span className="block text-sm font-extrabold text-[#00b8d4] dark:text-[#00EDFF]">
            → {projectedScore}
            <span className="text-[10px] ml-0.5">{delta > 0 ? `+${delta}` : delta}</span>
          </span>
        )}
        {!hasProjection && (
          <span className={`block text-xs font-bold ${colors.text} mt-0.5`}>Grade {grade}</span>
        )}
        {hasProjection && (
          <span className="block text-[10px] font-bold text-[#00b8d4] dark:text-[#00EDFF]">
            {projectedGrade !== grade ? `${grade} → ${projectedGrade}` : `Grade ${grade}`}
          </span>
        )}
      </div>
    </div>
  );
}

import { ScoringMethodology } from "./ScoringMethodology";

export function RiskScoreDashboard({ analysisResults, projected }: Props) {
  const perFirewall = useMemo(() => {
    const entries: { label: string; result: RiskScoreResult }[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      entries.push({ label, result: computeRiskScore(ar) });
    }
    return entries;
  }, [analysisResults]);

  const aggregated = useMemo<RiskScoreResult>(() => {
    if (perFirewall.length === 1) return perFirewall[0].result;
    const categoryLabels = perFirewall[0]?.result.categories.map((c) => c.label) ?? [];
    const categories = categoryLabels.map((label) => {
      const scores = perFirewall.map((fw) => fw.result.categories.find((c) => c.label === label)?.pct ?? 0);
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      return { label, score: avg, maxScore: 100, pct: avg, details: `Average across ${perFirewall.length} firewalls` };
    });
    const overall = Math.round(categories.reduce((s, c) => s + c.pct, 0) / categories.length);
    const grade: RiskScoreResult["grade"] =
      overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";
    return { overall, grade, categories };
  }, [perFirewall]);

  const radarData = aggregated.categories.map((c) => {
    const projCat = projected?.categories.find((p) => p.label === c.label);
    return {
      category: c.label,
      score: c.pct,
      projected: projCat ? projCat.pct : c.pct,
      fullMark: 100,
    };
  });

  const [showHelp, setShowHelp] = useState(false);

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <img src="/icons/sophos-security.svg" alt="" className="h-5 w-5 sophos-icon" />
          <h3 className="text-sm font-semibold text-foreground">Security Risk Score</h3>
          <span className="text-[10px] text-muted-foreground">
            {perFirewall.length > 1 ? `aggregated across ${perFirewall.length} firewalls` : "single firewall"}
          </span>
          <button onClick={() => setShowHelp(true)} className="ml-auto text-muted-foreground hover:text-foreground transition-colors" aria-label="How scoring works" title="How scoring works">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 pl-7">Firewall configuration posture only. Does not represent overall organisational security risk.</p>
      </div>

      {showHelp && <ScoringMethodology onClose={() => setShowHelp(false)} />}

      <div className="grid gap-6 md:grid-cols-2 items-center">
        {/* Gauge + legend */}
        <div className="flex flex-col items-center gap-4" data-tour="score-grade">
          <GaugeRing
            score={aggregated.overall}
            grade={aggregated.grade}
            projectedScore={projected?.overall}
            projectedGrade={projected?.grade}
          />
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs" data-tour="score-categories">
            {aggregated.categories.map((c) => {
              const projCat = projected?.categories.find((p) => p.label === c.label);
              const delta = projCat ? projCat.pct - c.pct : 0;
              const color =
                c.pct >= 80 ? "text-[#00F2B3] dark:text-[#00F2B3]" :
                c.pct >= 50 ? "text-[#b8a200] dark:text-[#F8E300]" :
                "text-[#EA0022]";
              return (
                <div key={c.label} className="flex items-center gap-2" title={c.details}>
                  <span className={`font-bold tabular-nums ${color}`}>{c.pct}%</span>
                  {delta > 0 && (
                    <span className="font-bold tabular-nums text-[#00b8d4] dark:text-[#00EDFF] text-[10px]">→{projCat!.pct}%</span>
                  )}
                  <span className="text-muted-foreground">{c.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Radar chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              {projected && (
                <Radar
                  dataKey="projected"
                  stroke="#00EDFF"
                  fill="#00EDFF"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              )}
              <Radar
                dataKey="score"
                stroke="#2006F7"
                fill="#2006F7"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                formatter={(value: number, name: string) => [
                  `${value}%`,
                  name === "projected" ? "Projected" : "Current",
                ]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-firewall scores (estate view) */}
      {perFirewall.length > 1 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Per-Firewall Scores</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {perFirewall
              .sort((a, b) => a.result.overall - b.result.overall)
              .map(({ label, result: r }) => {
                const gc = GRADE_COLORS[r.grade] ?? GRADE_COLORS.C;
                return (
                  <div key={label} className={`rounded-lg border border-border ${gc.bg} px-3 py-2 flex items-center justify-between`}>
                    <span className="text-xs font-medium text-foreground truncate mr-2">{label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-lg font-extrabold ${gc.text}`}>{r.overall}</span>
                      <span className={`text-[10px] font-bold ${gc.text} px-1.5 py-0.5 rounded ring-1 ${gc.ring}`}>{r.grade}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </section>
  );
}
