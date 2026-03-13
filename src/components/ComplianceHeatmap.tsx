import { useState, useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { mapToAllFrameworks, CONTROL_CATEGORIES, type FrameworkMapping, type ControlStatus } from "@/lib/compliance-map";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  selectedFrameworks: string[];
}

const STATUS_STYLES: Record<ControlStatus, { cell: string; label: string; dot: string; icon: string; iconColor: string }> = {
  pass: {
    cell: "bg-[#00995a]/15 dark:bg-[#00F2B3]/15 hover:bg-[#00995a]/25 dark:hover:bg-[#00F2B3]/25",
    label: "Pass",
    dot: "bg-[#00995a] dark:bg-[#00F2B3]",
    icon: "\u2713",
    iconColor: "text-[#00995a] dark:text-[#00F2B3]",
  },
  partial: {
    cell: "bg-[#F29400]/15 hover:bg-[#F29400]/25",
    label: "Partial",
    dot: "bg-[#F29400]",
    icon: "~",
    iconColor: "text-[#F29400]",
  },
  fail: {
    cell: "bg-[#EA0022]/15 hover:bg-[#EA0022]/25",
    label: "Fail",
    dot: "bg-[#EA0022]",
    icon: "\u2717",
    iconColor: "text-[#EA0022]",
  },
  na: {
    cell: "bg-muted/40 hover:bg-muted/60",
    label: "N/A",
    dot: "bg-muted-foreground/30",
    icon: "\u2014",
    iconColor: "text-muted-foreground/40",
  },
};

export function ComplianceHeatmap({ analysisResults, selectedFrameworks }: Props) {
  const [selectedFw, setSelectedFw] = useState<string | null>(null);

  const firstResult = Object.values(analysisResults)[0];
  const mappings = useMemo<FrameworkMapping[]>(() => {
    if (!firstResult) return [];
    const fws = selectedFrameworks.length > 0 ? selectedFrameworks : ["NCSC Guidelines", "Cyber Essentials / CE+"];
    return mapToAllFrameworks(fws, firstResult);
  }, [firstResult, selectedFrameworks]);

  if (mappings.length === 0) return null;

  const allControls = Array.from(
    new Set(mappings.flatMap((m) => m.controls.map((c) => c.controlName)))
  );

  const detailMapping = selectedFw ? mappings.find((m) => m.framework === selectedFw) : null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <img src="/icons/sophos-governance.svg" alt="" className="h-5 w-5 sophos-icon" />
        <h3 className="text-sm font-semibold text-foreground">Compliance Heatmap</h3>
        <span className="text-[10px] text-muted-foreground">{mappings.length} framework{mappings.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px]">
        {(Object.entries(STATUS_STYLES) as [ControlStatus, typeof STATUS_STYLES.pass][]).map(([status, s]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-bold ${s.cell} ${s.iconColor}`}>{s.icon}</span>
            <span className="text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="text-left p-1.5 text-muted-foreground font-semibold uppercase tracking-wider sticky left-0 bg-card z-10 min-w-[100px]">
                Control
              </th>
              {mappings.map((m) => (
                <th
                  key={m.framework}
                  className="p-1.5 text-center text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors min-w-[80px]"
                  onClick={() => setSelectedFw(selectedFw === m.framework ? null : m.framework)}
                >
                  <span className={selectedFw === m.framework ? "text-[#2006F7] dark:text-[#00EDFF] underline underline-offset-2" : ""}>
                    {m.framework.length > 20 ? m.framework.slice(0, 18) + "…" : m.framework}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allControls.map((controlName) => (
              <tr key={controlName}>
                <td className="p-1.5 text-foreground font-medium sticky left-0 bg-card z-10 border-t border-border/50">
                  {controlName}
                </td>
                {mappings.map((m) => {
                  const ctrl = m.controls.find((c) => c.controlName === controlName);
                  const status: ControlStatus = ctrl?.status ?? "na";
                  const s = STATUS_STYLES[status];
                  const cellKey = `${m.framework}-${controlName}`;

                  return (
                    <td
                      key={cellKey}
                      className={`p-1.5 text-center border-t border-border/50 rounded-sm transition-colors relative group/cell ${s.cell}`}
                    >
                      <span className={`inline-flex items-center justify-center h-5 w-5 rounded text-[11px] font-bold ${s.iconColor}`}>
                        {s.icon}
                      </span>
                      {ctrl && (
                        <div className="hidden group-hover/cell:block absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 p-2.5 rounded-lg border border-border bg-popover shadow-lg text-left min-w-[200px] max-w-[280px] pointer-events-none">
                          <p className="font-semibold text-foreground text-[11px]">{ctrl.controlName}</p>
                          <p className="text-muted-foreground mt-0.5 text-[10px]">{ctrl.evidence || "No evidence gathered"}</p>
                          <p className="mt-1">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              status === "pass" ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]" :
                              status === "partial" ? "bg-[#F29400]/10 text-[#F29400]" :
                              status === "fail" ? "bg-[#EA0022]/10 text-[#EA0022]" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {s.icon} {s.label}
                            </span>
                          </p>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Framework summary bars */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-2 border-t border-border">
        {mappings.map((m) => {
          const total = m.summary.pass + m.summary.partial + m.summary.fail;
          const passPct = total > 0 ? Math.round((m.summary.pass / total) * 100) : 0;
          return (
            <button
              key={m.framework}
              onClick={() => setSelectedFw(selectedFw === m.framework ? null : m.framework)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                selectedFw === m.framework
                  ? "border-[#2006F7]/30 bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08]"
                  : "border-border hover:border-[#2006F7]/20"
              }`}
            >
              <p className="text-[10px] font-semibold text-foreground truncate">{m.framework}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden flex">
                  {m.summary.pass > 0 && (
                    <div className="h-full bg-[#00995a] dark:bg-[#00F2B3]" style={{ width: `${(m.summary.pass / total) * 100}%` }} />
                  )}
                  {m.summary.partial > 0 && (
                    <div className="h-full bg-[#F29400]" style={{ width: `${(m.summary.partial / total) * 100}%` }} />
                  )}
                  {m.summary.fail > 0 && (
                    <div className="h-full bg-[#EA0022]" style={{ width: `${(m.summary.fail / total) * 100}%` }} />
                  )}
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${
                  passPct >= 80 ? "text-[#00995a] dark:text-[#00F2B3]" :
                  passPct >= 50 ? "text-[#F29400]" : "text-[#EA0022]"
                }`}>{passPct}%</span>
              </div>
              <div className="flex gap-2 mt-1 text-[9px] text-muted-foreground">
                <span>{m.summary.pass} pass</span>
                <span>{m.summary.partial} partial</span>
                <span>{m.summary.fail} fail</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detailed view for selected framework */}
      {detailMapping && (
        <div className="pt-3 border-t border-border space-y-3">
          <p className="text-xs font-semibold text-foreground">{detailMapping.framework} — Control Detail</p>
          {CONTROL_CATEGORIES.map((cat) => {
            const catControls = detailMapping.controls.filter((c) => c.category === cat);
            if (catControls.length === 0) return null;
            return (
              <div key={cat} className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cat}</p>
                {catControls.map((c) => {
                  const s = STATUS_STYLES[c.status];
                  return (
                    <div key={c.controlId} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30">
                      <span className={`inline-flex items-center justify-center h-5 w-5 rounded text-[11px] font-bold shrink-0 ${s.iconColor} ${s.cell}`}>
                        {s.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-foreground">{c.controlName}</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{c.evidence}</p>
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 ${s.iconColor}`}>{s.label.toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
