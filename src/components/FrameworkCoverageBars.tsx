import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { mapToAllFrameworks } from "@/lib/compliance-map";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  selectedFrameworks: string[];
}

function barColor(pct: number): string {
  if (pct >= 75) return "#00995a";
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
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Framework Coverage</h3>
        <p className="text-sm text-muted-foreground">Select compliance frameworks in setup to see coverage</p>
      </div>
    );
  }
  if (coverage.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Framework Coverage</h3>
      <div className="space-y-3">
        {coverage.map(({ framework, pct, color }) => (
          <div key={framework} className="flex items-center gap-3">
            <span className="text-xs text-foreground min-w-[140px] truncate" title={framework}>
              {framework}
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums text-foreground min-w-[2.5rem] text-right">
              {pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
