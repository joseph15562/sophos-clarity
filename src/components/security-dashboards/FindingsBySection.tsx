import { useMemo, useState } from "react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import { type Severity, SEVERITY_COLORS, SEVERITY_ORDER } from "@/lib/design-tokens";

const SEVERITY_KEYS: Severity[] = ["critical", "high", "medium", "low", "info"];

export function FindingsBySection({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const allFindings = useMemo(() => {
    const items: (Finding & { firewall: string })[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      for (const f of ar.findings) items.push({ ...f, firewall: label });
    }
    return items;
  }, [analysisResults]);

  const data = useMemo(() => {
    const sectionCounts: Record<string, Record<string, number>> = {};
    for (const f of allFindings) {
      if (!sectionCounts[f.section]) sectionCounts[f.section] = {};
      sectionCounts[f.section][f.severity] = (sectionCounts[f.section][f.severity] || 0) + 1;
    }
    return Object.entries(sectionCounts)
      .map(([section, sevs]) => ({
        section,
        displaySection: section.length > 22 ? section.slice(0, 20) + "…" : section,
        critical: sevs.critical || 0,
        high: sevs.high || 0,
        medium: sevs.medium || 0,
        low: sevs.low || 0,
        info: sevs.info || 0,
        total: Object.values(sevs).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [allFindings]);

  const drillFindings = useMemo(() => {
    if (!activeSection) return [];
    return allFindings
      .filter((f) => f.section === activeSection)
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5));
  }, [allFindings, activeSection]);

  if (data.length === 0) return null;

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">Findings by Section</h3>
        <span className="text-[10px] text-muted-foreground">{allFindings.length} total findings</span>
      </div>

      {/* Custom interactive bar chart */}
      <div className="space-y-1.5">
        {data.map((d) => {
          const isActive = activeSection === d.section;
          const isFaded = activeSection !== null && !isActive;
          const sevs: { key: Severity; count: number; color: string }[] = SEVERITY_KEYS.filter((key) => d[key] > 0).map((key) => ({
            key,
            count: d[key],
            color: SEVERITY_COLORS[key],
          }));

          return (
            <button
              key={d.section}
              onClick={() => setActiveSection(isActive ? null : d.section)}
              className={`w-full flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-all ${
                isActive ? "bg-muted/30 ring-1 ring-border" : "hover:bg-muted/15"
              } ${isFaded ? "opacity-40" : ""}`}
            >
              <span className="text-[10px] text-muted-foreground font-medium w-[110px] shrink-0 truncate text-right">{d.displaySection}</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 flex h-4 rounded overflow-hidden bg-muted/20">
                  {sevs.map((s) => (
                    <div
                      key={s.key}
                      className="h-full transition-all duration-300 relative group/seg"
                      style={{ width: `${(s.count / maxTotal) * 100}%`, backgroundColor: s.color }}
                    >
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 opacity-0 group-hover/seg:opacity-100 pointer-events-none transition-opacity z-30">
                        <div className="bg-popover border border-border rounded px-1.5 py-0.5 text-[9px] text-foreground whitespace-nowrap shadow-lg">
                          {s.count} {s.key}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <span className="text-[10px] font-bold text-foreground tabular-nums w-6 text-right">{d.total}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Severity legend */}
      <div className="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-border/50">
        {[
          { label: "Critical", color: SEVERITY_COLORS.critical },
          { label: "High", color: SEVERITY_COLORS.high },
          { label: "Medium", color: SEVERITY_COLORS.medium },
          { label: "Low", color: SEVERITY_COLORS.low },
          { label: "Info", color: SEVERITY_COLORS.info },
        ].map((s) => (
          <span key={s.label} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      {/* Drill-down findings list */}
      {activeSection && drillFindings.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-muted/10 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border bg-muted/20 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-foreground">{activeSection}</span>
            <button onClick={() => setActiveSection(null)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
            {drillFindings.map((f, i) => (
              <div key={`${f.id}-${i}`} className="px-3 py-2 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded" style={{ backgroundColor: SEVERITY_COLORS[f.severity as Severity] + "18", color: SEVERITY_COLORS[f.severity as Severity] }}>
                    {f.severity}
                  </span>
                  <span className="text-[10px] font-medium text-foreground flex-1 truncate">{f.title}</span>
                  {Object.keys(analysisResults).length > 1 && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{f.firewall}</span>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground line-clamp-2 leading-relaxed">{f.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
