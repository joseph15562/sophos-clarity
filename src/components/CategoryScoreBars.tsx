import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { gradeForScore } from "@/lib/design-tokens";
import { computeRiskScore } from "@/lib/risk-score";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

function barColorClass(pct: number): string {
  if (pct < 40) return "bg-[#EA0022]";
  if (pct <= 75) return "bg-[#F29400]";
  return "bg-[#00F2B3] dark:bg-[#00F2B3]";
}

export function CategoryScoreBars({ analysisResults }: Props) {
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

    return Array.from(labelToPcts.entries()).map(([label, pcts]) => {
      const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      return { label, pct: avg };
    });
  }, [analysisResults]);

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">
        Category Scores
      </h3>
      <div className="space-y-3">
        {aggregated.map(({ label, pct }) => {
          const grade = gradeForScore(pct);
          return (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs text-foreground w-36 shrink-0">{label}</span>
              <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColorClass(pct)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums w-10 text-right">{pct}%</span>
              <span
                className={`text-xs font-bold w-6 shrink-0 ${
                  grade === "A" || grade === "B"
                    ? "text-[#00F2B3] dark:text-[#00F2B3]"
                    : grade === "C"
                      ? "text-[#F29400]"
                      : grade === "D"
                        ? "text-[#F29400]"
                        : "text-[#EA0022]"
                }`}
              >
                {grade}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
