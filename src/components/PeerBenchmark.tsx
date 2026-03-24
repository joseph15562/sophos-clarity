import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore, type RiskScoreResult } from "@/lib/risk-score";
import { getBenchmark, getBenchmarkData, getBenchmarkLabel, BENCHMARK_ENVIRONMENTS } from "@/lib/benchmarks";
import { loadScoreHistory } from "@/lib/score-history";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  environment: string;
}

export function PeerBenchmark({ analysisResults, environment }: Props) {
  const { org } = useAuth();
  const initialSector = useMemo(() => {
    const env = environment.trim();
    if (!env) return "All Sectors";
    const match = BENCHMARK_ENVIRONMENTS.find((k) => env.toLowerCase().includes(k.toLowerCase()));
    return match ?? "All Sectors";
  }, [environment]);
  const [sector, setSector] = useState(initialSector);
  const [benchmark, setBenchmark] = useState(() => getBenchmark(initialSector));
  const [scoreHistory, setScoreHistory] = useState<{ prev: number; current: number } | null>(null);

  const sectorLabel = sector && sector !== "All Sectors" ? getBenchmarkLabel(sector) : "All Sectors";

  useEffect(() => {
    if (!sector) return;
    getBenchmarkData(sector).then(setBenchmark);
  }, [sector]);

  useEffect(() => {
    if (!org?.id) return;
    let cancelled = false;
    loadScoreHistory(org.id, undefined, 5).then((entries) => {
      if (cancelled || entries.length < 1) return;
      const prev = entries[entries.length - 1].overall_score;
      setScoreHistory({ prev, current: 0 });
    });
    return () => { cancelled = true; };
  }, [org?.id]);

  const score = useMemo<RiskScoreResult>(() => {
    const entries = Object.values(analysisResults);
    if (entries.length === 0) return { overall: 0, grade: "F", categories: [] };
    if (entries.length === 1) return computeRiskScore(entries[0]);
    const scores = entries.map((e) => computeRiskScore(e));
    const labels = scores[0].categories.map((c) => c.label);
    const cats = labels.map((label) => {
      const vals = scores.map((s) => s.categories.find((c) => c.label === label)?.pct ?? 0);
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      return { label, score: avg, maxScore: 100, pct: avg, details: "" };
    });
    const overall = Math.round(cats.reduce((s, c) => s + c.pct, 0) / cats.length);
    const grade: RiskScoreResult["grade"] =
      overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";
    return { overall, grade, categories: cats };
  }, [analysisResults]);

  const delta = score.overall - benchmark.overall;

  const estimatedPercentile = Math.min(99, Math.max(1, Math.round(50 + (score.overall - benchmark.overall) * 1.5)));
  const topX = 100 - estimatedPercentile;

  const vsPrevious = scoreHistory != null
    ? score.overall - scoreHistory.prev
    : null;

  return (
    <section className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 space-y-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-brand-accent/10 dark:bg-[#00EDFF]/10">
            <svg className="h-5 w-5 text-brand-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="7" width="4" height="14" rx="1" /><rect x="17" y="3" width="4" height="18" rx="1" /></svg>
          </div>
          <div className="flex items-baseline gap-2.5">
            <h3 className="text-base font-display font-bold tracking-tight text-foreground">Peer Benchmark</h3>
            <span className="text-[11px] text-muted-foreground/60 font-medium">vs {sectorLabel} average (n={benchmark.sampleSize})</span>
          </div>
        </div>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-lg border border-border/60 bg-card px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30 focus:border-brand-accent/30 transition-colors"
        >
          <option value="All Sectors">All Sectors</option>
          {BENCHMARK_ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </select>
      </div>

      {topX > 0 && topX < 100 && (
        <p className="text-[11px] font-display font-semibold text-foreground">
          Top {topX}% of {sectorLabel}
        </p>
      )}

      {vsPrevious !== null && vsPrevious !== 0 && (
        <p className={`text-[11px] font-semibold ${vsPrevious > 0 ? "text-[#00F2B3] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
          {vsPrevious > 0 ? "+" : ""}{vsPrevious} vs previous assessment
        </p>
      )}

      {/* Overall comparison */}
      <div className="grid grid-cols-3 gap-4 items-center">
        <div className="rounded-xl bg-muted/15 dark:bg-muted/10 border border-border/30 px-4 py-4 text-center space-y-1.5">
          <p className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.12em]">Your Score</p>
          <p className={`text-4xl font-display font-black tracking-tight tabular-nums ${gradeColor(score.grade)}`}>{score.overall}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-4 space-y-1">
          <span className={`text-2xl font-display font-bold tabular-nums ${delta >= 0 ? "text-[#00F2B3] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
            {delta >= 0 ? "+" : ""}{delta}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-medium">
            {delta >= 0 ? "above" : "below"} average
          </span>
        </div>
        <div className="rounded-xl bg-muted/15 dark:bg-muted/10 border border-border/30 px-4 py-4 text-center space-y-1.5">
          <p className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.12em]">{sectorLabel} Avg</p>
          <p className="text-4xl font-display font-black tracking-tight tabular-nums text-muted-foreground">{benchmark.overall}</p>
        </div>
      </div>

      {/* Category comparison bars */}
      <div className="space-y-3">
        {score.categories.map((cat) => {
          const benchVal = benchmark.categories[cat.label] ?? benchmark.overall;
          const d = cat.pct - benchVal;
          const barColor = cat.pct >= 80 ? "bg-[#00F2B3]" : cat.pct >= 50 ? "bg-[#F29400]" : "bg-[#EA0022]";
          const barGlow = cat.pct >= 80 ? "shadow-[0_0_8px_rgba(0,242,179,0.3)]" : cat.pct >= 50 ? "shadow-[0_0_8px_rgba(242,148,0,0.3)]" : "shadow-[0_0_8px_rgba(234,0,34,0.3)]";
          return (
            <div key={cat.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-display font-semibold tracking-tight text-foreground">{cat.label}</span>
                <div className="flex items-center gap-2.5">
                  <span className="text-[12px] font-display font-bold text-foreground tabular-nums">{cat.pct}%</span>
                  <span className="text-[10px] text-muted-foreground/50 font-medium tabular-nums">vs {benchVal}%</span>
                  {d !== 0 && (
                    <span className={`text-[11px] font-bold tabular-nums ${d > 0 ? "text-[#00F2B3] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
                      {d > 0 ? "+" : ""}{d}
                    </span>
                  )}
                </div>
              </div>
              <div className="relative h-2.5 rounded-full bg-muted/40 dark:bg-muted/20 overflow-hidden">
                <div
                  className={`absolute h-full rounded-full transition-all duration-700 ${barColor} ${barGlow}`}
                  style={{ width: `${Math.max(cat.pct, 2)}%` }}
                />
                <div
                  className="absolute h-full w-[2px] bg-foreground/30 dark:bg-foreground/25 rounded-full"
                  style={{ left: `${benchVal}%` }}
                  title={`${sectorLabel} average: ${benchVal}%`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed pt-1">
        Benchmarks are based on industry estimates and will be replaced with live aggregated data as usage grows. Vertical lines show sector average.
      </p>
    </section>
  );
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": case "B": return "text-[#00F2B3] dark:text-[#00F2B3]";
    case "C": return "text-[#b8a200] dark:text-[#F8E300]";
    case "D": return "text-[#c47800] dark:text-[#F29400]";
    default: return "text-[#EA0022]";
  }
}
