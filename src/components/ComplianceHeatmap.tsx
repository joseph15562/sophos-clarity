import { useState, useMemo, useRef, useCallback } from "react";
import { Download } from "lucide-react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import { mapToAllFrameworks, CONTROL_CATEGORIES, type FrameworkMapping, type ControlMapping, type ControlStatus } from "@/lib/compliance-map";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  selectedFrameworks: string[];
}

const STATUS_STYLES: Record<ControlStatus, { cell: string; label: string; dot: string; icon: string; iconColor: string }> = {
  pass: {
    cell: "bg-[#00F2B3]/15 dark:bg-[#00F2B3]/15 hover:bg-[#00F2B3]/25 dark:hover:bg-[#00F2B3]/25",
    label: "Pass",
    dot: "bg-[#00F2B3] dark:bg-[#00F2B3]",
    icon: "\u2713",
    iconColor: "text-[#00F2B3] dark:text-[#00F2B3]",
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

const STATUS_LABELS: Record<ControlStatus, string> = {
  pass: "Pass",
  partial: "Partial",
  fail: "Fail",
  na: "N/A",
};

export function ComplianceHeatmap({ analysisResults, selectedFrameworks }: Props) {
  const [selectedFw, setSelectedFw] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ controlName: string; evidence: string; status: ControlStatus; x: number; y: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ framework: string; control: ControlMapping; findings: Finding[] } | null>(null);
  const [showGapsOnly, setShowGapsOnly] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback((e: React.MouseEvent<HTMLTableCellElement>, ctrl: { controlName: string; evidence: string; status: ControlStatus }) => {
    const card = cardRef.current;
    if (!card) return;
    const cardRect = card.getBoundingClientRect();
    const cellRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      controlName: ctrl.controlName,
      evidence: ctrl.evidence,
      status: ctrl.status,
      x: cellRect.left + cellRect.width / 2 - cardRect.left,
      y: cellRect.top - cardRect.top,
    });
  }, []);

  const firstResult = Object.values(analysisResults)[0];
  const mappings = useMemo<FrameworkMapping[]>(() => {
    if (!firstResult) return [];
    const fws = selectedFrameworks.length > 0 ? selectedFrameworks : ["NCSC Guidelines", "Cyber Essentials / CE+"];
    return mapToAllFrameworks(fws, firstResult);
  }, [firstResult, selectedFrameworks]);

  const findingsById = useMemo(() => {
    const map = new Map<string, Finding>();
    for (const r of Object.values(analysisResults)) {
      for (const f of r.findings) map.set(f.id, f);
    }
    return map;
  }, [analysisResults]);

  const handleCellClick = useCallback((framework: string, ctrl: ControlMapping) => {
    if (ctrl.relatedFindings.length === 0) {
      setSelectedCell(null);
      return;
    }
    const findings = ctrl.relatedFindings
      .map((id) => findingsById.get(id))
      .filter((f): f is Finding => !!f);
    if (selectedCell?.framework === framework && selectedCell?.control.controlId === ctrl.controlId) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ framework, control: ctrl, findings });
    }
  }, [findingsById, selectedCell]);

  const allControlsRaw = Array.from(
    new Set(mappings.flatMap((m) => m.controls.map((c) => c.controlName)))
  );

  const allControls = useMemo(() => {
    if (!showGapsOnly) return allControlsRaw;
    return allControlsRaw.filter((controlName) => {
      return mappings.some((m) => {
        const ctrl = m.controls.find((c) => c.controlName === controlName);
        const status = ctrl?.status ?? "na";
        return status === "partial" || status === "fail";
      });
    });
  }, [allControlsRaw, showGapsOnly, mappings]);

  const handleExportCsv = useCallback(() => {
    const header = ["Control Name", "Category", ...mappings.map((m) => m.framework)];
    const rows: string[][] = [header];
    for (const controlName of allControlsRaw) {
      const firstCtrl = mappings.flatMap((m) => m.controls).find((c) => c.controlName === controlName);
      const category = firstCtrl?.category ?? "";
      const statuses = mappings.map((m) => {
        const ctrl = m.controls.find((c) => c.controlName === controlName);
        const status: ControlStatus = ctrl?.status ?? "na";
        return STATUS_LABELS[status];
      });
      rows.push([controlName, category, ...statuses]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-heatmap-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [mappings, allControlsRaw]);

  if (mappings.length === 0) return null;

  const detailMapping = selectedFw ? mappings.find((m) => m.framework === selectedFw) : null;

  return (
    <section ref={cardRef} className="rounded-xl border border-border bg-card p-5 space-y-4 relative">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <img src="/icons/sophos-governance.svg" alt="" className="h-5 w-5 sophos-icon" />
            <h3 className="text-sm font-semibold text-foreground">Compliance Heatmap</h3>
            <span className="text-[10px] text-muted-foreground">{mappings.length} framework{mappings.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGapsOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors ${
                showGapsOnly
                  ? "border-[#F29400]/50 bg-[#F29400]/15 text-[#F29400]"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              Show gaps only
            </button>
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-md border border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <Download className="h-3 w-3" /> Export CSV
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 pl-7">Indicative mapping based on firewall configuration controls. A full compliance audit requires additional evidence beyond firewall configuration.</p>
        {mappings.length > 0 && (
          <div className="mt-2 pl-7 space-y-0.5">
            {mappings.map((m) => {
              const scorable = m.summary.pass + m.summary.partial + m.summary.fail;
              const total = scorable + m.summary.na;
              return (
                <p key={m.framework} className="text-[9px] text-muted-foreground">
                  <span className="font-medium text-foreground">{m.framework}</span>: Covers {scorable} of {total} mapped controls. A full {m.framework} audit requires evidence beyond firewall configuration.
                </p>
              );
            })}
          </div>
        )}
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
      <div className="overflow-x-auto -mx-2 px-2" onMouseLeave={() => setTooltip(null)}>
        <table className="w-full min-w-max border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="text-left p-1.5 text-muted-foreground font-semibold uppercase tracking-wider sticky left-0 bg-card z-10 min-w-[100px]">
                Control
              </th>
              {mappings.map((m) => {
                const scorable = m.summary.pass + m.summary.partial + m.summary.fail;
                const pct = scorable > 0 ? Math.round((m.summary.pass / scorable) * 100) : 0;
                return (
                  <th
                    key={m.framework}
                    className="p-1.5 text-center text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors min-w-[80px]"
                    onClick={() => setSelectedFw(selectedFw === m.framework ? null : m.framework)}
                  >
                    <span className={selectedFw === m.framework ? "text-[#2006F7] dark:text-[#00EDFF] underline underline-offset-2" : ""}>
                      {m.framework.length > 20 ? m.framework.slice(0, 18) + "…" : m.framework}
                    </span>
                    {scorable > 0 && (
                      <span className={`block text-[9px] font-bold tabular-nums mt-0.5 ${
                        pct >= 80 ? "text-[#00F2B3] dark:text-[#00F2B3]" :
                        pct >= 50 ? "text-[#F29400]" : "text-[#EA0022]"
                      }`}>{pct}%</span>
                    )}
                  </th>
                );
              })}
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

                  const hasFindings = ctrl && ctrl.relatedFindings.length > 0;
                  const isSelected = selectedCell?.framework === m.framework && selectedCell?.control.controlId === ctrl?.controlId;
                  return (
                    <td
                      key={cellKey}
                      className={`p-1.5 text-center border-t border-border/50 rounded-sm transition-colors select-none ${s.cell} ${hasFindings ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-[#2006F7]/50" : ""}`}
                      onClick={ctrl && hasFindings ? () => handleCellClick(m.framework, ctrl) : undefined}
                      onMouseEnter={ctrl ? (e) => showTooltip(e, { controlName: ctrl.controlName, evidence: ctrl.evidence, status }) : undefined}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <span className={`inline-flex items-center justify-center h-5 w-5 rounded text-[11px] font-bold ${s.iconColor}`}>
                        {s.icon}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating tooltip — positioned relative to card, above the overflow container */}
      {tooltip && (
        <div
          className="absolute z-30 pointer-events-none transition-opacity duration-100"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          <div className="mb-2 p-2.5 rounded-lg border border-border bg-popover shadow-lg text-left min-w-[200px] max-w-[280px]">
            <p className="font-semibold text-foreground text-[11px]">{tooltip.controlName}</p>
            <p className="text-muted-foreground mt-0.5 text-[10px]">{tooltip.evidence || "No evidence gathered"}</p>
            <p className="mt-1">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                tooltip.status === "pass" ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]" :
                tooltip.status === "partial" ? "bg-[#F29400]/10 text-[#F29400]" :
                tooltip.status === "fail" ? "bg-[#EA0022]/10 text-[#EA0022]" :
                "bg-muted text-muted-foreground"
              }`}>
                {STATUS_STYLES[tooltip.status].icon} {STATUS_STYLES[tooltip.status].label}
              </span>
            </p>
          </div>
          <div className="w-2 h-2 rotate-45 border-b border-r border-border bg-popover mx-auto -mt-3" />
        </div>
      )}

      {/* Selected cell findings panel */}
      {selectedCell && selectedCell.findings.length > 0 && (
        <div className="rounded-lg border border-[#2006F7]/20 bg-[#2006F7]/[0.03] dark:bg-[#2006F7]/[0.06] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">
              {selectedCell.control.controlName} — {selectedCell.framework}
            </p>
            <button onClick={() => setSelectedCell(null)} className="text-muted-foreground hover:text-foreground text-xs" aria-label="Close details">✕</button>
          </div>
          <p className="text-[10px] text-muted-foreground">{selectedCell.findings.length} related finding{selectedCell.findings.length !== 1 ? "s" : ""}</p>
          {selectedCell.findings.map((f) => (
            <div key={f.id} className="rounded-md border border-border bg-card px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  f.severity === "critical" ? "bg-[#EA0022]/10 text-[#EA0022]" :
                  f.severity === "high" ? "bg-[#F29400]/10 text-[#F29400]" :
                  f.severity === "medium" ? "bg-amber-500/10 text-amber-600" :
                  "bg-muted text-muted-foreground"
                }`}>{f.severity}</span>
                <span className="text-xs font-medium text-foreground">{f.title}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{f.detail}</p>
            </div>
          ))}
        </div>
      )}

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
                    <div className="h-full bg-[#00F2B3] dark:bg-[#00F2B3]" style={{ width: `${(m.summary.pass / total) * 100}%` }} />
                  )}
                  {m.summary.partial > 0 && (
                    <div className="h-full bg-[#F29400]" style={{ width: `${(m.summary.partial / total) * 100}%` }} />
                  )}
                  {m.summary.fail > 0 && (
                    <div className="h-full bg-[#EA0022]" style={{ width: `${(m.summary.fail / total) * 100}%` }} />
                  )}
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${
                  passPct >= 80 ? "text-[#00F2B3] dark:text-[#00F2B3]" :
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
