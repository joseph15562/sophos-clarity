import { useMemo, useState } from "react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import { type Severity, SEVERITY_COLORS, SEVERITY_ORDER } from "@/lib/design-tokens";

export function TopFindings({
  analysisResults,
}: {
  analysisResults: Record<string, AnalysisResult>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const findings = useMemo(() => {
    const all: (Finding & { firewall: string })[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      for (const f of ar.findings) all.push({ ...f, firewall: label });
    }
    return all.sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5),
    );
  }, [analysisResults]);

  if (findings.length === 0) return null;

  const shown = showAll ? findings : findings.slice(0, 6);

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 shadow-card transition-all duration-200 hover:shadow-elevated flex flex-col h-full"
      style={{
        backgroundImage:
          "linear-gradient(145deg, rgba(242,148,0,0.04), rgba(234,0,34,0.02), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent, rgba(242,148,0,0.15), rgba(234,0,34,0.08), transparent)",
        }}
      />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-display font-bold tracking-tight text-foreground">
          Top Findings
        </h3>
        <span className="text-[11px] text-muted-foreground/70">{findings.length} total</span>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
        {shown.map((f, i) => {
          const uid = `${f.id}-${f.firewall}-${i}`;
          const isExpanded = expandedId === uid;
          const sevColor = SEVERITY_COLORS[f.severity as Severity];
          return (
            <div
              key={uid}
              className="group relative rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.01]"
              style={{
                border: isExpanded ? `1px solid ${sevColor}30` : "1px solid rgba(255,255,255,0.06)",
                backgroundImage: isExpanded
                  ? `linear-gradient(145deg, ${sevColor}12, ${sevColor}06)`
                  : "linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                boxShadow: isExpanded
                  ? `0 0 16px ${sevColor}15, inset 0 1px 0 rgba(255,255,255,0.06)`
                  : "inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 6px rgba(0,0,0,0.1)",
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-px pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(90deg, transparent, ${sevColor}20, transparent)`,
                }}
              />
              <button
                onClick={() => setExpandedId(isExpanded ? null : uid)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left cursor-pointer"
              >
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wide"
                  style={{
                    backgroundColor: sevColor + "20",
                    color: sevColor,
                    boxShadow: `0 0 8px ${sevColor}15`,
                  }}
                >
                  {f.severity.toUpperCase()}
                </span>
                <span className="text-xs font-semibold text-foreground/90 flex-1 truncate">
                  {f.title}
                </span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.5)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {f.section}
                </span>
              </button>
              {isExpanded && (
                <div className="px-3.5 pb-3 border-t border-slate-900/[0.10] dark:border-white/[0.06] pt-2.5 space-y-2">
                  <p className="text-[10px] text-foreground/50 leading-relaxed">{f.detail}</p>
                  {f.remediation && (
                    <p className="text-[10px] leading-relaxed">
                      <span className="font-bold" style={{ color: "#F29400" }}>
                        Recommendation:
                      </span>{" "}
                      <span className="text-foreground/80">{f.remediation}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(analysisResults).length > 1 && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold"
                        style={{
                          backgroundColor: "rgba(56,136,255,0.12)",
                          color: "rgba(56,136,255,0.8)",
                        }}
                      >
                        {f.firewall}
                      </span>
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
          className="mt-3 text-[10px] font-bold transition-all duration-200 cursor-pointer hover:brightness-125"
          style={{ color: "rgba(56,136,255,0.8)" }}
        >
          {showAll ? "Show less" : `Show all ${findings.length}`}
        </button>
      )}
    </div>
  );
}
