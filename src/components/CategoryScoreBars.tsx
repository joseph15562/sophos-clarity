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
  return "bg-[#00A878] dark:bg-[#00F2B3]";
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
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(56,136,255,0.05), rgba(0,242,179,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(56,136,255,0.18), rgba(0,242,179,0.1), transparent)",
        }}
      />
      <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-5">
        Category Scores
      </h3>
      <div className="space-y-4">
        {aggregated.map(({ label, pct }) => {
          const grade = gradeForScore(pct);
          return (
            <div key={label} className="flex items-center gap-3">
              <span className="text-sm text-foreground/90 w-40 shrink-0 font-medium">{label}</span>
              <div
                className="flex-1 h-3 rounded-full overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColorClass(pct)}`}
                  style={{ width: `${pct}%`, boxShadow: "0 0 10px rgba(255,255,255,0.08)" }}
                />
              </div>
              <span className="text-sm font-black tabular-nums w-11 text-right">{pct}%</span>
              <span
                className={`text-sm font-black w-7 shrink-0 ${
                  grade === "A" || grade === "B"
                    ? "text-[#007A5A] dark:text-[#00F2B3]"
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
