import { useMemo, useState } from "react";
import { useResolvedIsDark } from "@/hooks/use-resolved-appearance";
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
import { ScoringMethodology } from "./ScoringMethodology";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  projected?: RiskScoreResult | null;
}

const GRADE_COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  A: {
    ring: "ring-[#008F69]/35 dark:ring-[#00F2B3]/30",
    text: "text-[#007A5A] dark:text-[#00F2B3]",
    bg: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 dark:bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10",
  },
  B: {
    ring: "ring-[#008F69]/25 dark:ring-[#00F2B3]/20",
    text: "text-[#00774a] dark:text-[#00F2B3]",
    bg: "bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 dark:bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5",
  },
  C: {
    ring: "ring-[#ca8a04]/35 dark:ring-[#F8E300]/30",
    text: "text-[#92400e] dark:text-[#F8E300]",
    bg: "bg-[#ca8a04]/12 dark:bg-[#F8E300]/10",
  },
  D: {
    ring: "ring-[#F29400]/30",
    text: "text-[#c47800] dark:text-[#F29400]",
    bg: "bg-[#F29400]/10",
  },
  F: { ring: "ring-[#EA0022]/30", text: "text-[#EA0022]", bg: "bg-[#EA0022]/10" },
};

function GaugeRing({
  score,
  grade,
  projectedScore,
  projectedGrade,
}: {
  score: number;
  grade: string;
  projectedScore?: number;
  projectedGrade?: string;
}) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.C;
  const hasProjection = projectedScore != null && projectedScore !== score;

  const strokeColor =
    grade === "A" || grade === "B"
      ? "#00F2B3"
      : grade === "C"
        ? "#ca8a04"
        : grade === "D"
          ? "#F29400"
          : "#EA0022";

  const projOffset = hasProjection
    ? circumference - (projectedScore / 100) * circumference
    : circumference;
  const delta = hasProjection ? projectedScore - score : 0;

  const gaugeId = `ring-${score}-${grade}`;

  const tipAngle = (score / 100) * 360 - 90;
  const tipX = 60 + r * Math.cos((tipAngle * Math.PI) / 180);
  const tipY = 60 + r * Math.sin((tipAngle * Math.PI) / 180);

  return (
    <div className="relative flex items-center justify-center w-52 h-52 group transition-transform duration-300 hover:scale-[1.06]">
      {/* Glass disc */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-300 group-hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
        style={{
          background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.18)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      />

      {/* Glow ring behind the arc */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-300"
        style={{
          inset: "14%",
          boxShadow: `0 0 16px 4px ${strokeColor}18, 0 0 32px 8px ${strokeColor}0a`,
        }}
      />

      {/* Hover glow intensifier */}
      <div
        className="absolute rounded-full pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          inset: "10%",
          boxShadow: `0 0 24px 8px ${strokeColor}20, 0 0 48px 16px ${strokeColor}10`,
        }}
      />

      {/* SVG arcs */}
      <svg
        className="absolute -rotate-90"
        style={{ width: "76%", height: "76%" }}
        viewBox="0 0 120 120"
        role="img"
        aria-label={`Risk score gauge: ${score} out of 100`}
      >
        <defs>
          <linearGradient id={`${gaugeId}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.7} />
          </linearGradient>
        </defs>

        {/* Track — light */}
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="hsl(213 27% 86%)"
          strokeWidth="8"
          strokeLinecap="round"
          className="dark:hidden"
        />
        {/* Track — dark */}
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
          strokeLinecap="round"
          className="hidden dark:block"
        />

        {hasProjection && (
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="#00EDFF"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={projOffset}
            strokeLinecap="round"
            className="transition-all duration-700"
            opacity={0.5}
          />
        )}

        {/* Main arc */}
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={`url(#${gaugeId}-grad)`}
          strokeWidth={hasProjection ? 6 : 8}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>

      {/* Centre text */}
      <div className="text-center z-10">
        <span
          className="text-4xl font-display font-black tracking-tight tabular-nums transition-all duration-300 group-hover:scale-105"
          style={{ color: strokeColor, display: "inline-block" }}
        >
          {score}
        </span>
        {hasProjection && (
          <span className="block text-sm font-display font-bold text-[#00b8d4] dark:text-[#00EDFF]">
            → {projectedScore}
            <span className="text-[10px] ml-0.5">{delta > 0 ? `+${delta}` : delta}</span>
          </span>
        )}
        {!hasProjection && (
          <span
            className="block text-xs font-display font-semibold mt-0.5 tracking-wide"
            style={{ color: strokeColor, opacity: 0.7 }}
          >
            Grade {grade}
          </span>
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
      const scores = perFirewall.map(
        (fw) => fw.result.categories.find((c) => c.label === label)?.pct ?? 0,
      );
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      return {
        label,
        score: avg,
        maxScore: 100,
        pct: avg,
        details: `Average across ${perFirewall.length} firewalls`,
      };
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
  const isDark = useResolvedIsDark();
  const polarGridStroke = isDark ? "rgba(255,255,255,0.16)" : "rgba(51, 65, 85, 0.32)";
  const polarTickFill = isDark ? "rgba(226, 232, 240, 0.92)" : "rgba(30, 41, 59, 0.88)";

  return (
    <section className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] p-6 sm:p-8 space-y-6 shadow-[0_18px_50px_rgba(32,6,247,0.08)]">
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
                <h3 className="text-xl font-display font-black tracking-tight text-foreground">
                  Security Risk Score
                </h3>
                <span className="text-[11px] text-muted-foreground/60 font-medium">
                  {perFirewall.length > 1
                    ? `aggregated across ${perFirewall.length} firewalls`
                    : "single firewall"}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed pl-[56px]">
              Firewall configuration posture only. Does not represent overall organisational
              security risk.
            </p>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2.5 rounded-xl border border-border/50 bg-card shadow-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            aria-label="How scoring works"
            title="How scoring works"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: "Purpose",
              text: "Summarise firewall posture in an executive-friendly score",
              color: "#2006F7",
            },
            {
              label: "Use case",
              text: "MSP reviews, SE health checks, and customer reporting",
              color: "#00BFFF",
            },
            {
              label: "Trust model",
              text: "Deterministic scoring based on extracted configuration evidence",
              color: "#00F2B3",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="group relative overflow-hidden rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm px-5 py-4 transition-all duration-200 hover:scale-[1.02] hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
              style={{ background: `linear-gradient(145deg, ${card.color}08, transparent)` }}
            >
              <div
                className="absolute inset-x-0 top-0 h-px pointer-events-none"
                style={{
                  background: `linear-gradient(90deg, transparent, ${card.color}18, transparent)`,
                }}
              />
              <div
                className="absolute -top-4 -right-4 h-12 w-12 rounded-full blur-[20px] opacity-10 transition-opacity group-hover:opacity-25 pointer-events-none"
                style={{ backgroundColor: card.color }}
              />
              <p className="relative text-[9px] font-display font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
                {card.label}
              </p>
              <p className="relative text-[13px] font-display font-semibold text-foreground mt-1.5">
                {card.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {showHelp && <ScoringMethodology onClose={() => setShowHelp(false)} />}

      <div
        className="relative grid gap-8 md:grid-cols-2 items-center rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm p-6 sm:p-8 transition-all duration-200 hover:shadow-elevated"
        style={{
          background:
            "linear-gradient(145deg, rgba(32,6,247,0.05), rgba(0,191,255,0.02), transparent)",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(32,6,247,0.15), rgba(0,191,255,0.08), transparent)",
          }}
        />
        <div
          className="absolute -top-10 -left-10 h-28 w-28 rounded-full blur-[50px] opacity-10 pointer-events-none"
          style={{ background: "#2006F7" }}
        />

        {/* Gauge */}
        <div className="flex items-center justify-center" data-tour="score-grade">
          <GaugeRing
            score={aggregated.overall}
            grade={aggregated.grade}
            projectedScore={projected?.overall}
            projectedGrade={projected?.grade}
          />
        </div>

        {/* Radar chart */}
        <div className="relative h-72 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke={polarGridStroke} strokeWidth={1.15} />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fontSize: 11, fill: polarTickFill, fontWeight: 500 }}
              />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              {projected && (
                <Radar
                  dataKey="projected"
                  stroke="#00EDFF"
                  fill="#00EDFF"
                  fillOpacity={0.08}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              )}
              <Radar
                dataKey="score"
                stroke="url(#radarGradientStroke)"
                fill="url(#radarGradientFill)"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <defs>
                <linearGradient id="radarGradientStroke" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#2006F7" />
                  <stop offset="100%" stopColor="#00BFFF" />
                </linearGradient>
                <linearGradient id="radarGradientFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#2006F7" />
                  <stop offset="100%" stopColor="#00BFFF" />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={
                  isDark
                    ? {
                        background: "rgba(10,14,28,0.92)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        fontSize: 11,
                        padding: "8px 12px",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                        color: "#fff",
                      }
                    : {
                        background: "rgba(255,255,255,0.96)",
                        border: "1px solid rgba(15,23,42,0.12)",
                        borderRadius: 12,
                        fontSize: 11,
                        padding: "8px 12px",
                        boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                        color: "#0f172a",
                      }
                }
                formatter={(value: number, name: string) => [
                  `${value}%`,
                  name === "projected" ? "Projected" : "Current",
                ]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" data-tour="score-categories">
        {aggregated.categories.map((c) => {
          const projCat = projected?.categories.find((p) => p.label === c.label);
          const delta = projCat ? projCat.pct - c.pct : 0;
          const catColor = c.pct >= 80 ? "#00F2B3" : c.pct >= 50 ? "#ca8a04" : "#EA0022";
          return (
            <div
              key={c.label}
              className="group/cat relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-3 py-2.5 text-center transition-all duration-200 hover:scale-[1.04] hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated cursor-default"
              style={{ background: `linear-gradient(145deg, ${catColor}08, transparent)` }}
              title={c.details}
            >
              <div
                className="absolute inset-x-0 top-0 h-px pointer-events-none"
                style={{
                  background: `linear-gradient(90deg, transparent, ${catColor}18, transparent)`,
                }}
              />
              <span
                className="block font-display font-bold tabular-nums text-lg"
                style={{ color: catColor }}
              >
                {c.pct}%
                {delta > 0 && (
                  <span className="text-[9px] font-bold text-[#00EDFF] ml-1">→{projCat!.pct}%</span>
                )}
              </span>
              <span className="block text-[9px] text-muted-foreground/60 font-medium mt-0.5 leading-tight">
                {c.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Per-firewall scores (estate view) */}
      {perFirewall.length > 1 && (
        <div className="space-y-3 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-5 sm:p-6">
          <p className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.12em]">
            Per-Firewall Scores
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {perFirewall
              .sort((a, b) => a.result.overall - b.result.overall)
              .map(({ label, result: r }) => {
                const gc = GRADE_COLORS[r.grade] ?? GRADE_COLORS.C;
                return (
                  <div
                    key={label}
                    className={`rounded-xl border border-border/40 ${gc.bg} px-4 py-3.5 flex items-center justify-between shadow-sm hover:shadow-card transition-shadow`}
                  >
                    <span className="text-[12px] font-display font-medium text-foreground truncate mr-3">
                      {label}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xl font-display font-bold tabular-nums ${gc.text}`}>
                        {r.overall}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${gc.text} px-2 py-0.5 rounded-md ring-1 ${gc.ring}`}
                      >
                        {r.grade}
                      </span>
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
