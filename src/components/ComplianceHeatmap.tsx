import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Download, Scale } from "lucide-react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import {
  mapToAllFrameworks,
  CONTROL_CATEGORIES,
  type FrameworkMapping,
  type ControlMapping,
  type ControlStatus,
} from "@/lib/compliance-map";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  selectedFrameworks: string[];
}

const STATUS_HEX: Record<ControlStatus, string> = {
  pass: "#00F2B3",
  partial: "#F29400",
  fail: "#EA0022",
  na: "#6B7280",
};

const STATUS_STYLES: Record<
  ControlStatus,
  { cell: string; label: string; dot: string; icon: string; iconColor: string; hex: string }
> = {
  pass: {
    cell: "bg-[#00F2B3]/15 dark:bg-[#00F2B3]/15 hover:bg-[#00F2B3]/25 dark:hover:bg-[#00F2B3]/25",
    label: "Pass",
    dot: "bg-[#00A878] dark:bg-[#00F2B3]",
    icon: "\u2713",
    iconColor: "text-[#007A5A] dark:text-[#00F2B3]",
    hex: "#00F2B3",
  },
  partial: {
    cell: "bg-[#F29400]/15 hover:bg-[#F29400]/25",
    label: "Partial",
    dot: "bg-[#F29400]",
    icon: "~",
    iconColor: "text-[#F29400]",
    hex: "#F29400",
  },
  fail: {
    cell: "bg-[#EA0022]/15 hover:bg-[#EA0022]/25",
    label: "Fail",
    dot: "bg-[#EA0022]",
    icon: "\u2717",
    iconColor: "text-[#EA0022]",
    hex: "#EA0022",
  },
  na: {
    cell: "bg-muted/40 hover:bg-muted/60",
    label: "N/A",
    dot: "bg-muted-foreground/30",
    icon: "\u2014",
    iconColor: "text-muted-foreground/40",
    hex: "#6B7280",
  },
};

const STATUS_LABELS: Record<ControlStatus, string> = {
  pass: "Pass",
  partial: "Partial",
  fail: "Fail",
  na: "N/A",
};

const TOOLTIP_DEBOUNCE_MS = 48;

export function ComplianceHeatmap({ analysisResults, selectedFrameworks }: Props) {
  const [selectedFw, setSelectedFw] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    controlName: string;
    evidence: string;
    status: ControlStatus;
    x: number;
    y: number;
  } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    framework: string;
    control: ControlMapping;
    findings: Finding[];
  } | null>(null);
  const [showGapsOnly, setShowGapsOnly] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTooltipTimer = useCallback(() => {
    if (tooltipTimerRef.current !== null) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTooltipTimer(), [clearTooltipTimer]);

  const showTooltipDebounced = useCallback(
    (
      e: React.MouseEvent<HTMLTableCellElement>,
      ctrl: { controlName: string; evidence: string; status: ControlStatus },
    ) => {
      clearTooltipTimer();
      tooltipTimerRef.current = setTimeout(() => {
        tooltipTimerRef.current = null;
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
      }, TOOLTIP_DEBOUNCE_MS);
    },
    [clearTooltipTimer],
  );

  const hideTooltip = useCallback(() => {
    clearTooltipTimer();
    setTooltip(null);
  }, [clearTooltipTimer]);

  const firstResult = Object.values(analysisResults)[0];
  const mappings = useMemo<FrameworkMapping[]>(() => {
    if (!firstResult) return [];
    const fws =
      selectedFrameworks.length > 0
        ? selectedFrameworks
        : ["NCSC Guidelines", "Cyber Essentials / CE+"];
    return mapToAllFrameworks(fws, firstResult);
  }, [firstResult, selectedFrameworks]);

  const findingsById = useMemo(() => {
    const map = new Map<string, Finding>();
    for (const r of Object.values(analysisResults)) {
      for (const f of r.findings) map.set(f.id, f);
    }
    return map;
  }, [analysisResults]);

  const handleCellClick = useCallback(
    (framework: string, ctrl: ControlMapping) => {
      if (ctrl.relatedFindings.length === 0) {
        setSelectedCell(null);
        return;
      }
      const findings = ctrl.relatedFindings
        .map((id) => findingsById.get(id))
        .filter((f): f is Finding => !!f);
      if (
        selectedCell?.framework === framework &&
        selectedCell?.control.controlId === ctrl.controlId
      ) {
        setSelectedCell(null);
      } else {
        setSelectedCell({ framework, control: ctrl, findings });
      }
    },
    [findingsById, selectedCell],
  );

  const allControlsRaw = Array.from(
    new Set(mappings.flatMap((m) => m.controls.map((c) => c.controlName))),
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
      const firstCtrl = mappings
        .flatMap((m) => m.controls)
        .find((c) => c.controlName === controlName);
      const category = firstCtrl?.category ?? "";
      const statuses = mappings.map((m) => {
        const ctrl = m.controls.find((c) => c.controlName === controlName);
        const status: ControlStatus = ctrl?.status ?? "na";
        return STATUS_LABELS[status];
      });
      rows.push([controlName, category, ...statuses]);
    }
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
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
    <section
      ref={cardRef}
      className="rounded-[28px] border border-[#5A00FF]/15 bg-[radial-gradient(circle_at_top_left,rgba(90,0,255,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,237,255,0.08),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,246,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(90,0,255,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,237,255,0.08),transparent_24%),linear-gradient(135deg,rgba(12,15,30,0.98),rgba(18,14,34,0.98))] p-5 sm:p-6 space-y-5 relative shadow-[0_20px_55px_rgba(90,0,255,0.10)] overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00EDFF]" />
      <div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#5A00FF]/15 bg-[#5A00FF]/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5A00FF] dark:text-[#B47AFF]">
              Framework coverage view
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Scale className="h-5 w-5 text-brand-accent" />
              <h3 className="text-lg font-display font-black text-foreground tracking-tight">
                Compliance Heatmap
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#5A00FF]/10 text-[#5A00FF] dark:text-[#B47AFF] font-bold">
                {mappings.length} framework{mappings.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground/80 dark:text-white/75 leading-relaxed">
              Visualize where controls are covered, partially met, or missing so audit conversations
              and remediation priorities are immediately clearer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGapsOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-xl border transition-all duration-200 ${
                showGapsOnly
                  ? "border-[#F29400]/30 text-[#F29400] shadow-[0_0_10px_rgba(242,148,0,0.15)]"
                  : "border-slate-900/[0.12] dark:border-white/[0.08] text-muted-foreground hover:text-foreground hover:border-slate-900/[0.18] dark:hover:border-white/[0.15]"
              }`}
              style={{
                background: showGapsOnly
                  ? "linear-gradient(135deg, rgba(242,148,0,0.12), rgba(242,148,0,0.04))"
                  : "linear-gradient(135deg, rgba(90,0,255,0.06), rgba(90,0,255,0.02))",
              }}
            >
              Show gaps only
            </button>
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-xl border border-slate-900/[0.12] dark:border-white/[0.08] text-muted-foreground hover:text-foreground hover:border-slate-900/[0.18] dark:hover:border-white/[0.15] transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, rgba(90,0,255,0.06), rgba(90,0,255,0.02))",
              }}
            >
              <Download className="h-3 w-3 text-brand-accent" /> Export CSV
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Pass
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              Controls appear aligned in the current firewall posture
            </p>
          </div>
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Partial
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              Controls need stronger evidence or fuller implementation
            </p>
          </div>
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Fail
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              Controls show material compliance gaps or missing safeguards
            </p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Indicative mapping based on firewall configuration controls. A full compliance audit
          requires additional evidence beyond firewall configuration.
        </p>
        {mappings.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {mappings.map((m) => {
              const scorable = m.summary.pass + m.summary.partial + m.summary.fail;
              const total = scorable + m.summary.na;
              return (
                <p key={m.framework} className="text-[9px] text-muted-foreground">
                  <span className="font-medium text-foreground">{m.framework}</span>: Covers{" "}
                  {scorable} of {total} mapped controls. A full {m.framework} audit requires
                  evidence beyond firewall configuration.
                </p>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-4 space-y-3"
        style={{ background: "linear-gradient(145deg, rgba(90,0,255,0.06), rgba(90,0,255,0.02))" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-6 -left-6 h-14 w-14 rounded-full blur-[24px] opacity-15 bg-[#5A00FF]" />
        </div>
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(90,0,255,0.22), transparent)",
          }}
        />
        <div className="relative flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-accent">
              Status legend
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              Use this to read control alignment at a glance across every mapped framework.
            </p>
          </div>
        </div>
        <div className="relative grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 text-[10px]">
          {(Object.entries(STATUS_STYLES) as [ControlStatus, typeof STATUS_STYLES.pass][]).map(
            ([status, s]) => (
              <div
                key={status}
                className="group relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-3.5 py-3 flex items-center gap-3 transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
                style={{ background: `linear-gradient(145deg, ${s.hex}10, ${s.hex}04)` }}
              >
                <div className="absolute inset-0 pointer-events-none">
                  <div
                    className="absolute -top-3 -right-3 h-8 w-8 rounded-full blur-[14px] opacity-15 transition-opacity duration-200 group-hover:opacity-30"
                    style={{ backgroundColor: s.hex }}
                  />
                </div>
                <span
                  className="relative inline-flex items-center justify-center h-9 w-9 rounded-xl text-[13px] font-black shrink-0 border border-slate-900/[0.12] dark:border-white/[0.08]"
                  style={{ backgroundColor: `${s.hex}18`, color: s.hex }}
                >
                  {s.icon}
                </span>
                <div className="relative min-w-0">
                  <p className="font-bold text-foreground">{s.label}</p>
                  <p className="text-muted-foreground/80 leading-relaxed">
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
            ),
          )}
        </div>
      </div>

      {/* Heatmap grid */}
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] shadow-card"
        style={{ background: "linear-gradient(145deg, rgba(90,0,255,0.04), rgba(0,237,255,0.02))" }}
        onMouseLeave={hideTooltip}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(90,0,255,0.18), transparent)",
          }}
        />
        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-max border-separate border-spacing-0 text-[11px]">
            <thead>
              <tr>
                <th
                  className="text-left p-2.5 text-[10px] text-foreground/80 font-black uppercase tracking-[0.18em] sticky left-0 z-10 min-w-[130px] rounded-tl-xl"
                  style={{ background: "rgba(12,18,34,0.9)" }}
                >
                  Control
                </th>
                {mappings.map((m) => {
                  const scorable = m.summary.pass + m.summary.partial + m.summary.fail;
                  const pct = scorable > 0 ? Math.round((m.summary.pass / scorable) * 100) : 0;
                  const pctHex = pct >= 80 ? "#00F2B3" : pct >= 50 ? "#F29400" : "#EA0022";
                  return (
                    <th
                      key={m.framework}
                      className="p-2.5 text-center text-foreground/75 font-bold cursor-pointer hover:text-foreground transition-colors min-w-[100px]"
                      onClick={() => setSelectedFw(selectedFw === m.framework ? null : m.framework)}
                    >
                      <span
                        className={
                          selectedFw === m.framework
                            ? "text-brand-accent underline underline-offset-2 font-black"
                            : ""
                        }
                      >
                        {m.framework.length > 20 ? m.framework.slice(0, 18) + "…" : m.framework}
                      </span>
                      {scorable > 0 && (
                        <span
                          className="block text-[10px] font-black tabular-nums mt-0.5"
                          style={{ color: pctHex }}
                        >
                          {pct}%
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allControls.map((controlName) => (
                <tr
                  key={controlName}
                  className="hover:bg-slate-950/[0.03] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td
                    className="p-2.5 text-foreground font-bold sticky left-0 z-10 border-t border-slate-900/[0.08] dark:border-white/[0.04]"
                    style={{ background: "rgba(12,18,34,0.9)" }}
                  >
                    {controlName}
                  </td>
                  {mappings.map((m) => {
                    const ctrl = m.controls.find((c) => c.controlName === controlName);
                    const status: ControlStatus = ctrl?.status ?? "na";
                    const s = STATUS_STYLES[status];
                    const cellKey = `${m.framework}-${controlName}`;

                    const hasFindings = ctrl && ctrl.relatedFindings.length > 0;
                    const isSelected =
                      selectedCell?.framework === m.framework &&
                      selectedCell?.control.controlId === ctrl?.controlId;
                    return (
                      <td
                        key={cellKey}
                        className={`p-2 text-center border-t border-slate-900/[0.08] dark:border-white/[0.04] rounded-lg transition-all duration-150 select-none ${s.cell} ${hasFindings ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-brand-accent/60 shadow-[0_0_12px_rgba(32,6,247,0.2)]" : ""}`}
                        onClick={
                          ctrl && hasFindings ? () => handleCellClick(m.framework, ctrl) : undefined
                        }
                        onMouseEnter={
                          ctrl
                            ? (e) =>
                                showTooltipDebounced(e, {
                                  controlName: ctrl.controlName,
                                  evidence: ctrl.evidence,
                                  status,
                                })
                            : undefined
                        }
                        onMouseLeave={hideTooltip}
                      >
                        <span
                          className="inline-flex items-center justify-center h-6 w-6 rounded-md text-[13px] font-black"
                          style={{ color: STATUS_HEX[status] }}
                        >
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
      </div>

      {/* Floating tooltip */}
      {tooltip &&
        (() => {
          const ttHex = STATUS_HEX[tooltip.status];
          return (
            <div
              className="absolute z-30 pointer-events-none transition-opacity duration-100"
              style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
            >
              <div
                className="relative overflow-hidden mb-2 p-3 rounded-xl border border-slate-900/[0.12] dark:border-white/[0.08] backdrop-blur-xl shadow-elevated text-left min-w-[200px] max-w-[280px]"
                style={{
                  background: "linear-gradient(145deg, rgba(12,18,34,0.96), rgba(8,13,26,0.98))",
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-px pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${ttHex}30, transparent)`,
                  }}
                />
                <p className="font-bold text-foreground text-[11px]">{tooltip.controlName}</p>
                <p className="text-muted-foreground/80 mt-0.5 text-[10px]">
                  {tooltip.evidence || "No evidence gathered"}
                </p>
                <p className="mt-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black border"
                    style={{
                      color: ttHex,
                      backgroundColor: `${ttHex}14`,
                      borderColor: `${ttHex}22`,
                    }}
                  >
                    {STATUS_STYLES[tooltip.status].icon} {STATUS_STYLES[tooltip.status].label}
                  </span>
                </p>
              </div>
              <div
                className="w-2 h-2 rotate-45 border-b border-r border-slate-900/[0.12] dark:border-white/[0.08] mx-auto -mt-3"
                style={{ background: "rgba(12,18,34,0.96)" }}
              />
            </div>
          );
        })()}

      {/* Selected cell findings panel */}
      {selectedCell && selectedCell.findings.length > 0 && (
        <div
          className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-4 space-y-2.5"
          style={{
            background: "linear-gradient(145deg, rgba(32,6,247,0.06), rgba(32,6,247,0.02))",
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(32,6,247,0.22), transparent)",
            }}
          />
          <div className="relative flex items-center justify-between">
            <p className="text-xs font-bold text-foreground">
              {selectedCell.control.controlName} — {selectedCell.framework}
            </p>
            <button
              onClick={() => setSelectedCell(null)}
              className="text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded-md hover:bg-slate-950/[0.06] dark:hover:bg-white/[0.06] transition-colors"
              aria-label="Close details"
            >
              ✕
            </button>
          </div>
          <p className="relative text-[10px] text-muted-foreground/80">
            {selectedCell.findings.length} related finding
            {selectedCell.findings.length !== 1 ? "s" : ""}
          </p>
          {selectedCell.findings.map((f) => {
            const fHex =
              f.severity === "critical"
                ? "#EA0022"
                : f.severity === "high"
                  ? "#F29400"
                  : f.severity === "medium"
                    ? "#F8C300"
                    : "#009CFB";
            return (
              <div
                key={f.id}
                className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-3.5 py-2.5"
                style={{ background: `linear-gradient(135deg, ${fHex}08, ${fHex}02)` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border"
                    style={{ color: fHex, backgroundColor: `${fHex}14`, borderColor: `${fHex}22` }}
                  >
                    {f.severity}
                  </span>
                  <span className="text-xs font-bold text-foreground">{f.title}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/80 mt-1.5 leading-relaxed">
                  {f.detail}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Framework summary bars */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-3 border-t border-slate-900/[0.10] dark:border-white/[0.06]">
        {mappings.map((m) => {
          const total = m.summary.pass + m.summary.partial + m.summary.fail;
          const passPct = total > 0 ? Math.round((m.summary.pass / total) * 100) : 0;
          const pctHex = passPct >= 80 ? "#00F2B3" : passPct >= 50 ? "#F29400" : "#EA0022";
          const isActive = selectedFw === m.framework;
          return (
            <button
              key={m.framework}
              onClick={() => setSelectedFw(isActive ? null : m.framework)}
              className={`group relative overflow-hidden rounded-xl border px-3.5 py-3 text-left transition-all duration-200 hover:shadow-elevated ${
                isActive
                  ? "border-brand-accent/25 shadow-[0_0_12px_rgba(32,6,247,0.15)]"
                  : "border-slate-900/[0.10] dark:border-white/[0.06] hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
              }`}
              style={{
                background: isActive
                  ? "linear-gradient(145deg, rgba(32,6,247,0.10), rgba(32,6,247,0.04))"
                  : "linear-gradient(145deg, rgba(90,0,255,0.05), rgba(90,0,255,0.015))",
              }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="absolute -top-3 -right-3 h-8 w-8 rounded-full blur-[14px] opacity-10 transition-opacity duration-200 group-hover:opacity-25"
                  style={{ backgroundColor: pctHex }}
                />
              </div>
              <p className="relative text-[10px] font-bold text-foreground truncate">
                {m.framework}
              </p>
              <div className="relative flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-2 rounded-full bg-white/80 dark:bg-white/[0.06] overflow-hidden flex">
                  {m.summary.pass > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(m.summary.pass / total) * 100}%`,
                        background: "linear-gradient(90deg, #00F2B3, #00D4A0)",
                        boxShadow: "0 0 6px rgba(0,242,179,0.3)",
                      }}
                    />
                  )}
                  {m.summary.partial > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(m.summary.partial / total) * 100}%`,
                        background: "linear-gradient(90deg, #F29400, #E08600)",
                        boxShadow: "0 0 6px rgba(242,148,0,0.3)",
                      }}
                    />
                  )}
                  {m.summary.fail > 0 && (
                    <div
                      className="h-full"
                      style={{
                        width: `${(m.summary.fail / total) * 100}%`,
                        background: "linear-gradient(90deg, #EA0022, #D0001E)",
                        boxShadow: "0 0 6px rgba(234,0,34,0.3)",
                      }}
                    />
                  )}
                </div>
                <span className="text-[10px] font-black tabular-nums" style={{ color: pctHex }}>
                  {passPct}%
                </span>
              </div>
              <div className="relative flex gap-3 mt-1.5 text-[9px] text-muted-foreground/80 font-medium">
                <span>
                  <span style={{ color: "#00F2B3" }}>{m.summary.pass}</span> pass
                </span>
                <span>
                  <span style={{ color: "#F29400" }}>{m.summary.partial}</span> partial
                </span>
                <span>
                  <span style={{ color: "#EA0022" }}>{m.summary.fail}</span> fail
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detailed view for selected framework */}
      {detailMapping && (
        <div className="pt-3 border-t border-slate-900/[0.10] dark:border-white/[0.06] space-y-3">
          <p className="text-xs font-black text-foreground tracking-tight">
            {detailMapping.framework} — Control Detail
          </p>
          {CONTROL_CATEGORIES.map((cat) => {
            const catControls = detailMapping.controls.filter((c) => c.category === cat);
            if (catControls.length === 0) return null;
            return (
              <div key={cat} className="space-y-1.5">
                <p className="text-[10px] font-black text-brand-accent uppercase tracking-[0.18em]">
                  {cat}
                </p>
                {catControls.map((c) => {
                  const s = STATUS_STYLES[c.status];
                  return (
                    <div
                      key={c.controlId}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-900/[0.08] dark:border-white/[0.04] transition-all duration-150 hover:border-slate-900/[0.12] dark:hover:border-white/[0.08]"
                      style={{ background: `linear-gradient(135deg, ${s.hex}06, transparent)` }}
                    >
                      <span
                        className="inline-flex items-center justify-center h-6 w-6 rounded-lg text-[11px] font-black shrink-0 border border-slate-900/[0.12] dark:border-white/[0.08]"
                        style={{ backgroundColor: `${s.hex}18`, color: s.hex }}
                      >
                        {s.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-foreground">{c.controlName}</span>
                        <p className="text-[10px] text-muted-foreground/80 mt-0.5">{c.evidence}</p>
                      </div>
                      <span
                        className="text-[9px] font-black shrink-0 px-2 py-0.5 rounded-md border"
                        style={{
                          color: s.hex,
                          backgroundColor: `${s.hex}10`,
                          borderColor: `${s.hex}20`,
                        }}
                      >
                        {s.label.toUpperCase()}
                      </span>
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
