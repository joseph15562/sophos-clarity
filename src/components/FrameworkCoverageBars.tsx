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

  const shellClass =
    "relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-8 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated";

  if (selectedFrameworks.length === 0) {
    return (
      <div
        className={shellClass}
        style={{
          background:
            "linear-gradient(145deg, rgba(32,6,247,0.06), rgba(0,237,255,0.04), transparent)",
          minHeight: "min(320px, 55vh)",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(0,237,255,0.25), rgba(32,6,247,0.15), transparent)",
          }}
        />
        <div className="flex flex-col justify-center min-h-[200px] sm:min-h-[240px]">
          <h3 className="text-lg font-display font-black tracking-tight text-foreground mb-2">
            Framework Coverage
          </h3>
          <p className="text-base text-foreground/50 max-w-md leading-relaxed">
            Select compliance frameworks in setup to see how each maps to your export and where
            coverage is strongest.
          </p>
          <div
            className="mt-6 rounded-xl p-4 backdrop-blur-sm max-w-md"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <p className="text-sm font-semibold text-foreground/70">No frameworks selected yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Open setup and pick one or more frameworks to populate this panel.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (coverage.length === 0) return null;

  return (
    <div
      className={shellClass}
      style={{
        background:
          "linear-gradient(145deg, rgba(32,6,247,0.05), rgba(0,237,255,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,237,255,0.2), rgba(32,6,247,0.12), transparent)",
        }}
      />
      <h3 className="text-lg font-display font-black tracking-tight text-foreground mb-6">
        Framework Coverage
      </h3>
      <div className="space-y-5">
        {coverage.map(({ framework, pct, color }) => {
          const glow =
            pct >= 75
              ? "shadow-[0_0_12px_rgba(0,242,179,0.35)]"
              : pct >= 50
                ? "shadow-[0_0_12px_rgba(242,148,0,0.35)]"
                : "shadow-[0_0_12px_rgba(234,0,34,0.35)]";
          return (
            <div
              key={framework}
              className="space-y-2 rounded-xl p-3 -mx-1 backdrop-blur-sm"
              style={{
                border: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className="text-sm font-display font-bold tracking-tight text-foreground truncate"
                  title={framework}
                >
                  {framework}
                </span>
                <span className="text-lg font-display font-black tabular-nums text-foreground shrink-0">
                  {pct}%
                </span>
              </div>
              <div
                className="h-3 rounded-full overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
                }}
              >
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
