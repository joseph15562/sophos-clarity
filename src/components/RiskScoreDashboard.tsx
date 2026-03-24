import { useMemo, useState } from "react";
import { HelpCircle, ShieldCheck } from "lucide-react";
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

  const gaugeId = `ring-${score}-${grade}`;

  return (
    <div className="relative flex items-center justify-center w-44 h-44">
      <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 120 120" role="img" aria-label={`Risk score gauge: ${score} out of 100`}>
        <defs>
          <linearGradient id={`${gaugeId}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.8} />
            <stop offset="100%" stopColor={strokeColor} />
          </linearGradient>
          <filter id={`${gaugeId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track — light */}
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(213 27% 86%)" strokeWidth="8" className="dark:hidden" />
        {/* Track — dark */}
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(215 40% 22%)" strokeWidth="8" className="hidden dark:block" />

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

        {/* Glow layer */}
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={strokeColor}
          strokeWidth="16"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          opacity={0.15}
          filter={`url(#${gaugeId}-glow)`}
        />

        {/* Filled arc with gradient */}
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={`url(#${gaugeId}-grad)`}
          strokeWidth={hasProjection ? 5 : 8}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="text-center z-10">
        <span className="text-4xl font-display font-black tracking-tight tabular-nums" style={{ color: strokeColor }}>{score}</span>
        {hasProjection && (
          <span className="block text-sm font-display font-bold text-[#00b8d4] dark:text-[#00EDFF]">
            → {projectedScore}
            <span className="text-[10px] ml-0.5">{delta > 0 ? `+${delta}` : delta}</span>
          </span>
        )}
        {!hasProjection && (
          <span className="block text-sm font-display font-bold mt-0.5" style={{ color: strokeColor }}>Grade {grade}</span>
        )}
        {hasProjection && (
          <span className="block text-[10px] font-display font-bold text-[#00b8d4] dark:text-[#00EDFF]">
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
    <section className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] p-6 sm:p-8 space-y-6 shadow-[0_18px_50px_rgba(32,6,247,0.08)] overflow-hidden">
      <div className="space-y-5">
        <div className="flex items-start gap-3 justify-between flex-wrap">
          <div className="space-y-2.5 min-w-[220px] max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-accent">
              Risk benchmark
            </div>
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-brand-accent/10 dark:bg-[#00EDFF]/10 border border-brand-accent/15 shadow-sm">
                <ShieldCheck className="h-5 w-5 text-brand-accent" />
              </div>
              <div className="flex items-baseline gap-2.5 flex-1 min-w-0 flex-wrap">
                <h3 className="text-xl font-display font-black tracking-tight text-foreground">Security Risk Score</h3>
                <span className="text-[11px] text-muted-foreground/60 font-medium">
                  {perFirewall.length > 1 ? `aggregated across ${perFirewall.length} firewalls` : "single firewall"}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed pl-[56px]">Firewall configuration posture only. Does not represent overall organisational security risk.</p>
          </div>
          <button onClick={() => setShowHelp(true)} className="p-2.5 rounded-xl border border-border/50 bg-card shadow-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors" aria-label="How scoring works" title="How scoring works">
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm px-5 py-4 shadow-sm">
            <p className="text-[9px] font-display font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">Purpose</p>
            <p className="text-[13px] font-display font-semibold text-foreground mt-1.5">Summarise firewall posture in an executive-friendly score</p>
          </div>
          <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm px-5 py-4 shadow-sm">
            <p className="text-[9px] font-display font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">Use case</p>
            <p className="text-[13px] font-display font-semibold text-foreground mt-1.5">MSP reviews, SE health checks, and customer reporting</p>
          </div>
          <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm px-5 py-4 shadow-sm">
            <p className="text-[9px] font-display font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">Trust model</p>
            <p className="text-[13px] font-display font-semibold text-foreground mt-1.5">Deterministic scoring based on extracted configuration evidence</p>
          </div>
        </div>
      </div>

      {showHelp && <ScoringMethodology onClose={() => setShowHelp(false)} />}

      <div className="grid gap-8 md:grid-cols-2 items-center rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-6 sm:p-8">
        {/* Gauge + legend */}
        <div className="flex flex-col items-center gap-6" data-tour="score-grade">
          <GaugeRing
            score={aggregated.overall}
            grade={aggregated.grade}
            projectedScore={projected?.overall}
            projectedGrade={projected?.grade}
          />
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px]" data-tour="score-categories">
            {aggregated.categories.map((c) => {
              const projCat = projected?.categories.find((p) => p.label === c.label);
              const delta = projCat ? projCat.pct - c.pct : 0;
              const color =
                c.pct >= 80 ? "text-[#00F2B3] dark:text-[#00F2B3]" :
                c.pct >= 50 ? "text-[#b8a200] dark:text-[#F8E300]" :
                "text-[#EA0022]";
              return (
                <div key={c.label} className="flex items-center gap-2.5" title={c.details}>
                  <span className={`font-display font-bold tabular-nums text-[14px] ${color}`}>{c.pct}%</span>
                  {delta > 0 && (
                    <span className="font-bold tabular-nums text-[#00b8d4] dark:text-[#00EDFF] text-[10px]">→{projCat!.pct}%</span>
                  )}
                  <span className="text-muted-foreground/70 text-[12px]">{c.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Radar chart */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }} />
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
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11, padding: "8px 12px" }}
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
        <div className="space-y-3 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-5 sm:p-6">
          <p className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.12em]">Per-Firewall Scores</p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {perFirewall
              .sort((a, b) => a.result.overall - b.result.overall)
              .map(({ label, result: r }) => {
                const gc = GRADE_COLORS[r.grade] ?? GRADE_COLORS.C;
                return (
                  <div key={label} className={`rounded-xl border border-border/40 ${gc.bg} px-4 py-3.5 flex items-center justify-between shadow-sm hover:shadow-card transition-shadow`}>
                    <span className="text-[12px] font-display font-medium text-foreground truncate mr-3">{label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xl font-display font-bold tabular-nums ${gc.text}`}>{r.overall}</span>
                      <span className={`text-[10px] font-bold ${gc.text} px-2 py-0.5 rounded-md ring-1 ${gc.ring}`}>{r.grade}</span>
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
