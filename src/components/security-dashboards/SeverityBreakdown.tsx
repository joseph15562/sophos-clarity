import { useMemo, useState } from "react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import { SEV_COLORS } from "./constants";

const SEV_ORDER: string[] = ["critical", "high", "medium", "low", "info"];

export function SeverityBreakdown({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const [activeSev, setActiveSev] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  const { data, allFindings } = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const findings: (Finding & { firewall: string })[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      for (const f of ar.findings) {
        counts[f.severity] = (counts[f.severity] || 0) + 1;
        findings.push({ ...f, firewall: label });
      }
    }
    const ordered = SEV_ORDER
      .map((sev) => ({ key: sev, name: sev.charAt(0).toUpperCase() + sev.slice(1), value: counts[sev] || 0, color: SEV_COLORS[sev] }))
      .filter((d) => d.value > 0);
    return { data: ordered, allFindings: findings };
  }, [analysisResults]);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const filteredFindings = activeSev
    ? allFindings.filter((f) => f.severity === activeSev)
    : null;

  const handleSevClick = (sev: string) => {
    setActiveSev(activeSev === sev ? null : sev);
    setExpandedFinding(null);
  };

  const multipleFirewalls = Object.keys(analysisResults).length > 1;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Finding Severity</h3>
        <span className="text-[10px] text-muted-foreground">{total} total findings</span>
      </div>

      {/* Stacked severity bar — clickable + hoverable */}
      <div className="relative h-12">
        {/* Bar segments */}
        <div className="absolute bottom-0 left-0 right-0 flex h-5 rounded-full" style={{ clipPath: "inset(0 round 9999px)" }}>
          {data.map((d) => {
            const isDimmed = activeSev !== null && activeSev !== d.key;
            return (
              <div
                key={d.key}
                className="h-full transition-opacity duration-200"
                style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color, opacity: isDimmed ? 0.25 : 1 }}
              />
            );
          })}
        </div>
        {/* Interactive overlay — no overflow clip so tooltips escape */}
        <div className="absolute bottom-0 left-0 right-0 flex h-5">
          {data.map((d, idx) => {
            const isActive = activeSev === d.key;
            const isDimmed = activeSev !== null && !isActive;
            const pct = Math.round((d.value / total) * 100);
            const isFirst = idx === 0;
            const isLast = idx === data.length - 1;
            return (
              <button
                key={d.key}
                onClick={() => handleSevClick(d.key)}
                className="relative h-full group/seg cursor-pointer"
                style={{ width: `${(d.value / total) * 100}%`, opacity: isDimmed ? 0.25 : 1 }}
              >
                {isActive && <div className="absolute inset-0 ring-2 ring-white/50 rounded-sm z-10" />}
                {/* Hover grow */}
                <div
                  className={`absolute left-0 right-0 bottom-0 opacity-0 group-hover/seg:opacity-100 transition-all duration-200 ${isFirst ? "rounded-l-full" : ""} ${isLast ? "rounded-r-full" : ""}`}
                  style={{ backgroundColor: d.color, height: "28px", filter: "brightness(1.15)", borderRadius: isFirst && isLast ? "9999px" : undefined }}
                />
                {/* Tooltip */}
                <div className="opacity-0 group-hover/seg:opacity-100 absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none transition-opacity duration-150">
                  <div className="rounded-lg border border-border bg-popover shadow-lg px-3 py-2 whitespace-nowrap">
                    <p className="text-[11px] font-bold" style={{ color: d.color }}>{d.value} {d.name}</p>
                    <p className="text-[9px] text-muted-foreground">{pct}% of all findings</p>
                  </div>
                  <div className="w-2 h-2 rotate-45 border-b border-r border-border bg-popover mx-auto -mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Severity count cards — clickable with hover */}
      <div className={`grid gap-2 ${data.length <= 3 ? "grid-cols-3" : data.length === 4 ? "grid-cols-4" : "grid-cols-5"}`}>
        {data.map((d) => {
          const isActive = activeSev === d.key;
          const isDimmed = activeSev !== null && !isActive;
          const pct = Math.round((d.value / total) * 100);
          return (
            <button
              key={d.key}
              onClick={() => handleSevClick(d.key)}
              className={`relative text-center rounded-lg border py-2.5 px-1 transition-all group/card ${
                isActive
                  ? "ring-1 bg-foreground/5 scale-105"
                  : isDimmed
                    ? "border-border bg-muted/10 opacity-40"
                    : "border-border bg-muted/20 hover:bg-muted/30 hover:scale-105 hover:shadow-md"
              }`}
              style={isActive ? { borderColor: d.color + "60", ["--tw-ring-color" as string]: d.color + "30" } : {}}
            >
              <span className="text-xl font-extrabold tabular-nums block" style={{ color: d.color }}>{d.value}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{d.name}</span>
              <div className="opacity-0 group-hover/card:opacity-100 absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none transition-opacity duration-150">
                <div className="rounded-md border border-border bg-popover shadow-lg px-2.5 py-1.5 whitespace-nowrap text-left">
                  <p className="text-[10px] font-bold" style={{ color: d.color }}>{d.value} {d.name.toLowerCase()} finding{d.value !== 1 ? "s" : ""}</p>
                  <p className="text-[9px] text-muted-foreground">{pct}% of total · Click to filter</p>
                </div>
                <div className="w-2 h-2 rotate-45 border-b border-r border-border bg-popover mx-auto -mt-1" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Drill-down findings list */}
      {filteredFindings && filteredFindings.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            {filteredFindings.length} {activeSev} finding{filteredFindings.length !== 1 ? "s" : ""}
          </p>
          <div className="max-h-52 overflow-y-auto space-y-1">
            {filteredFindings.map((f, i) => {
              const uid = `sev-${f.id}-${f.firewall}-${i}`;
              const isOpen = expandedFinding === uid;
              return (
                <div key={uid} className="rounded-lg border border-border bg-muted/10 overflow-hidden">
                  <button
                    onClick={() => setExpandedFinding(isOpen ? null : uid)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/20 transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: SEV_COLORS[f.severity] }} />
                    <span className="text-[11px] font-medium text-foreground flex-1 truncate">{f.title}</span>
                    {multipleFirewalls && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{f.firewall}</span>
                    )}
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{f.section}</span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-2.5 pt-2 border-t border-border/50 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{f.detail}</p>
                      {f.remediation && (
                        <p className="text-[10px] leading-relaxed">
                          <span className="font-semibold text-[#F29400]">Recommendation:</span>{" "}
                          <span className="text-foreground">{f.remediation}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
