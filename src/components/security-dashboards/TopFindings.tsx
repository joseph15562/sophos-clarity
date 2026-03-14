import { useMemo, useState } from "react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import { SEV_COLORS } from "./constants";

export function TopFindings({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const findings = useMemo(() => {
    const all: (Finding & { firewall: string })[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      for (const f of ar.findings) all.push({ ...f, firewall: label });
    }
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return all.sort((a, b) => (order[a.severity] ?? 5) - (order[b.severity] ?? 5));
  }, [analysisResults]);

  if (findings.length === 0) return null;

  const shown = showAll ? findings : findings.slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Top Findings</h3>
        <span className="text-[10px] text-muted-foreground">{findings.length} total</span>
      </div>
      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {shown.map((f, i) => {
          const uid = `${f.id}-${f.firewall}-${i}`;
          const isExpanded = expandedId === uid;
          return (
            <div key={uid} className="rounded-lg border border-border bg-muted/10 overflow-hidden transition-colors hover:bg-muted/20">
              <button
                onClick={() => setExpandedId(isExpanded ? null : uid)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
              >
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold" style={{
                  backgroundColor: SEV_COLORS[f.severity] + "18",
                  color: SEV_COLORS[f.severity],
                }}>
                  {f.severity.toUpperCase()}
                </span>
                <span className="text-xs font-medium text-foreground flex-1 truncate">{f.title}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{f.section}</span>
              </button>
              {isExpanded && (
                <div className="px-3 pb-2.5 border-t border-border/50 pt-2 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{f.detail}</p>
                  {f.remediation && (
                    <p className="text-[10px] text-foreground"><strong>Recommendation:</strong> {f.remediation}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(analysisResults).length > 1 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF]">{f.firewall}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {findings.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-[10px] font-medium text-[#2006F7] dark:text-[#00EDFF] hover:underline"
        >
          {showAll ? "Show less" : `Show all ${findings.length}`}
        </button>
      )}
    </div>
  );
}
