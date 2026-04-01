import { useMemo, useState } from "react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import {
  type Severity,
  DASHBOARD_HOVER_TOOLTIP_CLASS,
  SEVERITY_COLORS,
  SEVERITY_ORDER,
} from "@/lib/design-tokens";

const SEVERITY_KEYS: Severity[] = ["critical", "high", "medium", "low", "info"];

export function FindingsBySection({
  analysisResults,
}: {
  analysisResults: Record<string, AnalysisResult>;
}) {
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
    <div
      className="relative rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 shadow-card transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(56,136,255,0.04), rgba(0,191,255,0.02), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(56,136,255,0.15), rgba(0,191,255,0.08), transparent)",
        }}
      />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-display font-bold tracking-tight text-foreground">
          Findings by Section
        </h3>
        <span className="text-[10px] text-muted-foreground/70">
          {allFindings.length} total findings
        </span>
      </div>

      {/* Custom interactive bar chart */}
      <div className="space-y-1.5">
        {data.map((d) => {
          const isActive = activeSection === d.section;
          const isFaded = activeSection !== null && !isActive;
          const sevs: { key: Severity; count: number; color: string }[] = SEVERITY_KEYS.filter(
            (key) => d[key] > 0,
          ).map((key) => ({
            key,
            count: d[key],
            color: SEVERITY_COLORS[key],
          }));

          return (
            <button
              key={d.section}
              onClick={() => setActiveSection(isActive ? null : d.section)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200 cursor-pointer ${
                isFaded ? "opacity-30" : ""
              }`}
              style={{
                background: isActive
                  ? "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))"
                  : "transparent",
                border: isActive ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                boxShadow: isActive
                  ? "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15)"
                  : "none",
              }}
            >
              <span className="text-[10px] text-foreground/60 font-semibold w-[110px] shrink-0 truncate text-right">
                {d.displaySection}
              </span>
              <div className="flex-1 flex items-center gap-1.5">
                <div
                  className="flex-1 flex h-5 rounded-lg overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  {sevs.map((s) => (
                    <div
                      key={s.key}
                      className="h-full transition-all duration-300 relative group/seg"
                      style={{
                        width: `${(s.count / maxTotal) * 100}%`,
                        backgroundColor: s.color,
                        boxShadow: `0 0 8px ${s.color}30`,
                      }}
                    >
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover/seg:opacity-100 pointer-events-none transition-opacity z-30">
                        <div
                          className={`${DASHBOARD_HOVER_TOOLTIP_CLASS} px-2 py-1 text-[9px] whitespace-nowrap`}
                        >
                          {s.count} {s.key}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <span
                  className="text-[11px] font-display font-black tabular-nums w-6 text-right"
                  style={{ color: sevs[0]?.color || "#fff" }}
                >
                  {d.total}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Severity legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-slate-900/[0.10] dark:border-white/[0.06]">
        {[
          { label: "Critical", color: SEVERITY_COLORS.critical },
          { label: "High", color: SEVERITY_COLORS.high },
          { label: "Medium", color: SEVERITY_COLORS.medium },
          { label: "Low", color: SEVERITY_COLORS.low },
          { label: "Info", color: SEVERITY_COLORS.info },
        ].map((s) => (
          <span
            key={s.label}
            className="flex items-center gap-1.5 text-[9px] text-foreground/50 font-medium"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: s.color, boxShadow: `0 0 6px ${s.color}40` }}
            />
            {s.label}
          </span>
        ))}
      </div>

      {/* Drill-down findings list */}
      {activeSection && drillFindings.length > 0 && (
        <div
          className="mt-4 rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] overflow-hidden"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div
            className="px-3 py-2 border-b border-slate-900/[0.10] dark:border-white/[0.06] flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <span className="text-[10px] font-bold text-foreground">{activeSection}</span>
            <button
              onClick={() => setActiveSection(null)}
              className="text-[10px] text-foreground/40 hover:text-foreground transition-colors font-medium"
            >
              Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {drillFindings.map((f, i) => {
              const sevColor = SEVERITY_COLORS[f.severity as Severity];
              return (
                <div
                  key={`${f.id}-${i}`}
                  className="px-3.5 py-2.5 transition-all duration-150"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "";
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wide"
                      style={{
                        backgroundColor: sevColor + "20",
                        color: sevColor,
                        boxShadow: `0 0 6px ${sevColor}15`,
                      }}
                    >
                      {f.severity}
                    </span>
                    <span className="text-[10px] font-semibold text-foreground/85 flex-1 truncate">
                      {f.title}
                    </span>
                    {Object.keys(analysisResults).length > 1 && (
                      <span
                        className="text-[8px] px-1.5 py-0.5 rounded-md font-medium shrink-0"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "rgba(255,255,255,0.4)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {f.firewall}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-foreground/40 line-clamp-2 leading-relaxed">
                    {f.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
