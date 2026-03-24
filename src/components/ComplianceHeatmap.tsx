import { useState, useMemo, useRef, useCallback } from "react";
import { Download, Scale } from "lucide-react";
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
    <section ref={cardRef} className="rounded-[28px] border border-[#5A00FF]/15 bg-[radial-gradient(circle_at_top_left,rgba(90,0,255,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,237,255,0.08),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,246,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(90,0,255,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,237,255,0.08),transparent_24%),linear-gradient(135deg,rgba(12,15,30,0.98),rgba(18,14,34,0.98))] p-5 sm:p-6 space-y-5 relative shadow-[0_20px_55px_rgba(90,0,255,0.10)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00EDFF]" />
      <div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#5A00FF]/15 bg-[#5A00FF]/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5A00FF] dark:text-[#B47AFF]">
              Framework coverage view
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Scale className="h-5 w-5 text-brand-accent" />
              <h3 className="text-lg font-display font-black text-foreground tracking-tight">Compliance Heatmap</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#5A00FF]/10 text-[#5A00FF] dark:text-[#B47AFF] font-bold">{mappings.length} framework{mappings.length !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-sm font-medium text-foreground/80 dark:text-white/75 leading-relaxed">
              Visualize where controls are covered, partially met, or missing so audit conversations and remediation priorities are immediately clearer.
            </p>
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
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pass</p>
            <p className="text-sm font-semibold text-foreground mt-1">Controls appear aligned in the current firewall posture</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Partial</p>
            <p className="text-sm font-semibold text-foreground mt-1">Controls need stronger evidence or fuller implementation</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fail</p>
            <p className="text-sm font-semibold text-foreground mt-1">Controls show material compliance gaps or missing safeguards</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Indicative mapping based on firewall configuration controls. A full compliance audit requires additional evidence beyond firewall configuration.</p>
        {mappings.length > 0 && (
          <div className="mt-2 space-y-0.5">
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
      <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status legend</p>
            <p className="text-[11px] text-muted-foreground mt-1">Use this to read control alignment at a glance across every mapped framework.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-[10px]">
          {(Object.entries(STATUS_STYLES) as [ControlStatus, typeof STATUS_STYLES.pass][]).map(([status, s]) => (
            <div key={status} className="rounded-xl border border-border bg-background/70 px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
              <span className={`inline-flex items-center justify-center h-8 w-8 rounded-xl text-[11px] font-bold shrink-0 ${s.cell} ${s.iconColor}`}>{s.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{s.label}</p>
                <p className="text-muted-foreground leading-relaxed">
                  {status === "pass"
                    ? "Control appears aligned in the current firewall posture."
                    : status === "partial"
                      ? "Control is only partly evidenced or needs strengthening."
                      : status === "fail"
                        ? "Control gap is visible and likely needs remediation."
                        : "Control is not applicable or not assessable from this config."}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto -mx-2 px-2 rounded-2xl border border-border/70 bg-card/80 p-2 shadow-sm" onMouseLeave={() => setTooltip(null)}>
        <table className="w-full min-w-max border-separate border-spacing-0 text-[11px]">
          <thead>
            <tr>
              <th className="text-left p-2 text-foreground/80 font-semibold uppercase tracking-[0.16em] sticky left-0 bg-card z-10 min-w-[130px] rounded-tl-xl">
                Control
              </th>
              {mappings.map((m) => {
                const scorable = m.summary.pass + m.summary.partial + m.summary.fail;
                const pct = scorable > 0 ? Math.round((m.summary.pass / scorable) * 100) : 0;
                return (
                  <th
                    key={m.framework}
                    className="p-2 text-center text-foreground/75 font-semibold cursor-pointer hover:text-foreground transition-colors min-w-[100px]"
                    onClick={() => setSelectedFw(selectedFw === m.framework ? null : m.framework)}
                  >
                    <span className={selectedFw === m.framework ? "text-brand-accent underline underline-offset-2 font-bold" : ""}>
                      {m.framework.length > 20 ? m.framework.slice(0, 18) + "…" : m.framework}
                    </span>
                    {scorable > 0 && (
                      <span className={`block text-[10px] font-bold tabular-nums mt-0.5 ${
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
                <td className="p-2 text-foreground font-semibold sticky left-0 bg-card z-10 border-t border-border/50">
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
                      className={`p-2 text-center border-t border-border/50 rounded-md transition-colors select-none ${s.cell} ${hasFindings ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-[#2006F7]/60 shadow-[0_0_0_1px_rgba(32,6,247,0.18)]" : ""}`}
                      onClick={ctrl && hasFindings ? () => handleCellClick(m.framework, ctrl) : undefined}
                      onMouseEnter={ctrl ? (e) => showTooltip(e, { controlName: ctrl.controlName, evidence: ctrl.evidence, status }) : undefined}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <span className={`inline-flex items-center justify-center h-6 w-6 rounded text-[12px] font-black ${s.iconColor}`}>
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
          <div className="mb-2 p-2.5 rounded-lg border border-border bg-popover shadow-elevated text-left min-w-[200px] max-w-[280px]">
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
        <div className="rounded-lg border border-brand-accent/20 bg-[#2006F7]/[0.03] dark:bg-brand-accent/[0.06] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">
              {selectedCell.control.controlName} — {selectedCell.framework}
            </p>
            <button onClick={() => setSelectedCell(null)} className="text-muted-foreground hover:text-foreground text-xs" aria-label="Close details">✕</button>
          </div>
          <p className="text-[10px] text-muted-foreground">{selectedCell.findings.length} related finding{selectedCell.findings.length !== 1 ? "s" : ""}</p>
          {selectedCell.findings.map((f) => (
            <div key={f.id} className="rounded-md border border-border/70 bg-card px-3 py-2">
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
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-2 border-t border-border/70">
        {mappings.map((m) => {
          const total = m.summary.pass + m.summary.partial + m.summary.fail;
          const passPct = total > 0 ? Math.round((m.summary.pass / total) * 100) : 0;
          return (
            <button
              key={m.framework}
              onClick={() => setSelectedFw(selectedFw === m.framework ? null : m.framework)}
              className={`rounded-2xl border px-3 py-3 text-left transition-colors shadow-sm ${
                selectedFw === m.framework
                  ? "border-brand-accent/30 bg-[#2006F7]/[0.04] dark:bg-brand-accent/[0.08]"
                  : "border-border bg-card/70 hover:border-brand-accent/20"
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
