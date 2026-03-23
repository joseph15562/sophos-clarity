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
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-[#2006F7]/10 flex items-center justify-center">
            <span className="text-sm">📊</span>
          </div>
          <h3 className="text-sm font-semibold text-foreground">Peer Benchmark</h3>
          <span className="text-[10px] text-muted-foreground">vs {sectorLabel} average (n={benchmark.sampleSize})</span>
        </div>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
        >
          <option value="All Sectors">All Sectors</option>
          {BENCHMARK_ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </select>
      </div>

      {topX > 0 && topX < 100 && (
        <p className="text-[10px] font-medium text-foreground">
          Top {topX}% of {sectorLabel}
        </p>
      )}

      {vsPrevious !== null && vsPrevious !== 0 && (
        <p className={`text-[10px] ${vsPrevious > 0 ? "text-[#00F2B3] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
          {vsPrevious > 0 ? "+" : ""}{vsPrevious} vs previous assessment
        </p>
      )}

      {/* Overall comparison */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Your Score</p>
          <p className={`text-2xl font-extrabold ${gradeColor(score.grade)}`}>{score.overall}</p>
        </div>
        <div className="flex flex-col items-center justify-center">
          <span className={`text-lg font-bold ${delta >= 0 ? "text-[#00F2B3] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
            {delta >= 0 ? "+" : ""}{delta}
          </span>
          <span className="text-[9px] text-muted-foreground">
            {delta >= 0 ? "above" : "below"} average
          </span>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">{sectorLabel} Avg</p>
          <p className="text-2xl font-extrabold text-muted-foreground">{benchmark.overall}</p>
        </div>
      </div>

      {/* Category comparison bars */}
      <div className="space-y-2">
        {score.categories.map((cat) => {
          const benchVal = benchmark.categories[cat.label] ?? benchmark.overall;
          const d = cat.pct - benchVal;
          return (
            <div key={cat.label} className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground font-medium">{cat.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{cat.pct}%</span>
                  <span className="text-muted-foreground">vs {benchVal}%</span>
                  {d !== 0 && (
                    <span className={`font-bold ${d > 0 ? "text-[#00F2B3] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
                      {d > 0 ? "+" : ""}{d}
                    </span>
                  )}
                </div>
              </div>
              <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`absolute h-full rounded-full transition-all ${
                    cat.pct >= 80 ? "bg-[#00F2B3] dark:bg-[#00F2B3]" : cat.pct >= 50 ? "bg-[#F29400]" : "bg-[#EA0022]"
                  }`}
                  style={{ width: `${cat.pct}%` }}
                />
                <div
                  className="absolute h-full w-0.5 bg-foreground/40"
                  style={{ left: `${benchVal}%` }}
                  title={`${sectorLabel} average: ${benchVal}%`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
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
