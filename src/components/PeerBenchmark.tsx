import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore, type RiskScoreResult } from "@/lib/risk-score";
import { getBenchmark, getBenchmarkLabel, type BenchmarkData } from "@/lib/benchmarks";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  environment: string;
}

export function PeerBenchmark({ analysisResults, environment }: Props) {
  const benchmark = useMemo(() => getBenchmark(environment), [environment]);
  const sectorLabel = useMemo(() => getBenchmarkLabel(environment), [environment]);

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

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-md bg-[#2006F7]/10 flex items-center justify-center">
          <span className="text-sm">📊</span>
        </div>
        <h3 className="text-sm font-semibold text-foreground">Peer Benchmark</h3>
        <span className="text-[10px] text-muted-foreground">vs {sectorLabel} average (n={benchmark.sampleSize})</span>
      </div>

      {/* Overall comparison */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Your Score</p>
          <p className={`text-2xl font-extrabold ${gradeColor(score.grade)}`}>{score.overall}</p>
        </div>
        <div className="flex flex-col items-center justify-center">
          <span className={`text-lg font-bold ${delta >= 0 ? "text-[#00995a] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
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
                    <span className={`font-bold ${d > 0 ? "text-[#00995a] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
                      {d > 0 ? "+" : ""}{d}
                    </span>
                  )}
                </div>
              </div>
              <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`absolute h-full rounded-full transition-all ${
                    cat.pct >= 80 ? "bg-[#00995a] dark:bg-[#00F2B3]" : cat.pct >= 50 ? "bg-[#F29400]" : "bg-[#EA0022]"
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
        Benchmark based on aggregated {sectorLabel.toLowerCase()} sector assessments. Vertical lines show sector average. Data is indicative and will improve over time.
      </p>
    </section>
  );
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": case "B": return "text-[#00995a] dark:text-[#00F2B3]";
    case "C": return "text-[#b8a200] dark:text-[#F8E300]";
    case "D": return "text-[#c47800] dark:text-[#F29400]";
    default: return "text-[#EA0022]";
  }
}
