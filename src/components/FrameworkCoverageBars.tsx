import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { mapToAllFrameworks } from "@/lib/compliance-map";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  selectedFrameworks: string[];
}

function barColor(pct: number): string {
  if (pct >= 75) return "#00F2B3";
  if (pct >= 50) return "#F29400";
  return "#EA0022";
}

export function FrameworkCoverageBars({ analysisResults, selectedFrameworks }: Props) {
  const firstResult = Object.values(analysisResults)[0];
  const coverage = useMemo(() => {
    if (!firstResult || selectedFrameworks.length === 0) return [];
    const mappings = mapToAllFrameworks(selectedFrameworks, firstResult);
    return mappings
      .map((m) => {
        const applicable = m.summary.pass + m.summary.partial + m.summary.fail;
        const pct = applicable > 0 ? Math.round((m.summary.pass / applicable) * 100) : 0;
        return { framework: m.framework, pct, color: barColor(pct) };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [firstResult, selectedFrameworks]);

  if (selectedFrameworks.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 shadow-card">
        <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-3">Framework Coverage</h3>
        <p className="text-sm text-muted-foreground/60">Select compliance frameworks in setup to see coverage</p>
      </div>
    );
  }
  if (coverage.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 shadow-card">
      <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-5">Framework Coverage</h3>
      <div className="space-y-4">
        {coverage.map(({ framework, pct, color }) => {
          const glow = pct >= 75 ? "shadow-[0_0_8px_rgba(0,242,179,0.3)]" : pct >= 50 ? "shadow-[0_0_8px_rgba(242,148,0,0.3)]" : "shadow-[0_0_8px_rgba(234,0,34,0.3)]";
          return (
            <div key={framework} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-display font-semibold tracking-tight text-foreground truncate" title={framework}>
                  {framework}
                </span>
                <span className="text-[12px] font-display font-bold tabular-nums text-foreground ml-3">
                  {pct}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted/40 dark:bg-muted/20 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${glow}`}
                  style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
