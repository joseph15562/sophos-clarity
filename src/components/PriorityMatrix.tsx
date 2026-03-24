import { useMemo, useState, useEffect } from "react";
import { Target } from "lucide-react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import { loadAcceptedFindings, isAccepted, type AcceptedFinding } from "@/lib/accepted-findings";
import { SEVERITY_COLORS } from "@/lib/design-tokens";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

type Quadrant = "quick-win" | "strategic" | "low-priority" | "thankless";

const SEVERITY_IMPACT: Record<string, number> = {
  critical: 5, high: 4, medium: 3, low: 2, info: 1,
};

const EFFORT_KEYWORDS: Record<string, number> = {
  enable: 1, toggle: 1, select: 1, check: 1,
  configure: 2, set: 2, change: 2, update: 2, add: 2,
  create: 3, deploy: 3, install: 3, implement: 3,
  redesign: 4, migrate: 4, restructure: 4, refactor: 4, replace: 4,
};

function estimateEffort(finding: Finding): number {
  const text = `${finding.title} ${finding.detail} ${finding.remediation ?? ""}`.toLowerCase();
  let maxEffort = 1;
  for (const [keyword, score] of Object.entries(EFFORT_KEYWORDS)) {
    if (text.includes(keyword) && score > maxEffort) maxEffort = score;
  }
  if (text.includes("rule") && text.includes("all")) maxEffort = Math.max(maxEffort, 3);
  if (text.includes("architecture") || text.includes("network segmentation")) maxEffort = 4;
  return maxEffort;
}

function getQuadrant(impact: number, effort: number): Quadrant {
  if (impact >= 3 && effort <= 2) return "quick-win";
  if (impact >= 3 && effort > 2) return "strategic";
  if (impact < 3 && effort <= 2) return "low-priority";
  return "thankless";
}

const QUADRANT_CONFIG: Record<Quadrant, { label: string; color: string; bg: string; description: string }> = {
  "quick-win": { label: "Quick Wins", color: "text-[#00F2B3] dark:text-[#00F2B3]", bg: "bg-[#00F2B3]/10 dark:bg-[#00F2B3]/10", description: "High impact, low effort — do these first" },
  strategic: { label: "Strategic Projects", color: "text-[#F29400]", bg: "bg-[#F29400]/10", description: "High impact, high effort — plan and schedule" },
  "low-priority": { label: "Low Priority", color: "text-[#009CFB]", bg: "bg-[#009CFB]/10", description: "Low impact, low effort — do when convenient" },
  thankless: { label: "Reconsider", color: "text-muted-foreground", bg: "bg-muted", description: "Low impact, high effort — evaluate if worth doing" },
};

interface PlottedFinding {
  finding: Finding;
  firewallLabel: string;
  impact: number;
  effort: number;
  quadrant: Quadrant;
}

export function PriorityMatrix({ analysisResults }: Props) {
  const [selected, setSelected] = useState<PlottedFinding | null>(null);
  const [activeQuadrant, setActiveQuadrant] = useState<Quadrant | null>(null);
  const [hoveredDot, setHoveredDot] = useState<{ p: PlottedFinding; x: number; y: number } | null>(null);
  const [acceptedList, setAcceptedList] = useState<AcceptedFinding[]>([]);

  useEffect(() => {
    loadAcceptedFindings().then(setAcceptedList);
    const refresh = () => loadAcceptedFindings().then(setAcceptedList);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "sophos-accepted-findings") refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("accepted-findings-changed", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("accepted-findings-changed", refresh);
    };
  }, []);

  const plotted = useMemo(() => {
    const items: PlottedFinding[] = [];
    for (const [label, result] of Object.entries(analysisResults)) {
      for (const f of result.findings) {
        if (f.severity === "info") continue;
        if (isAccepted(acceptedList, f.title)) continue;
        const impact = SEVERITY_IMPACT[f.severity] ?? 2;
        const effort = estimateEffort(f);
        items.push({ finding: f, firewallLabel: label, impact, effort, quadrant: getQuadrant(impact, effort) });
      }
    }
    return items;
  }, [analysisResults, acceptedList]);

  const quadrantCounts = useMemo(() => {
    const counts: Record<Quadrant, number> = { "quick-win": 0, strategic: 0, "low-priority": 0, thankless: 0 };
    for (const p of plotted) counts[p.quadrant]++;
    return counts;
  }, [plotted]);

  if (plotted.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-6 text-center text-sm text-muted-foreground/60 shadow-card">
        No actionable findings to prioritise.
      </div>
    );
  }

  const IMPACT_MAX = 5;
  const EFFORT_MAX = 4;
  const W = 100;
  const H = 100;
  const PAD = 12;

  const toX = (effort: number) => PAD + ((effort - 0.5) / EFFORT_MAX) * (W - 2 * PAD);
  const toY = (impact: number) => H - PAD - ((impact - 0.5) / IMPACT_MAX) * (H - 2 * PAD);

  const SEV_DOT: Record<string, string> = {
    critical: SEVERITY_COLORS.critical,
    high: SEVERITY_COLORS.high,
    medium: SEVERITY_COLORS.medium,
    low: "#009CFB",
  };

  const visiblePlotted = activeQuadrant ? plotted.filter((p) => p.quadrant === activeQuadrant) : plotted;

  const handleDotHover = (p: PlottedFinding, e: React.MouseEvent<SVGGElement>) => {
    const svg = e.currentTarget.closest("svg");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgPt = svg.createSVGPoint();
    svgPt.x = e.clientX;
    svgPt.y = e.clientY;
    setHoveredDot({
      p,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 space-y-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-brand-accent/10 dark:bg-[#00EDFF]/10">
            <Target className="h-5 w-5 text-brand-accent" />
          </div>
          <div className="flex items-baseline gap-2.5">
            <h3 className="text-base font-display font-bold tracking-tight text-foreground">Finding Priority Matrix</h3>
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground/60 font-medium">{plotted.length} findings plotted · Impact vs effort</span>
      </div>

      {/* Quadrant summary chips — clickable filter */}
      <div className="flex flex-wrap gap-2">
        {(["quick-win", "strategic", "low-priority", "thankless"] as Quadrant[]).map((q) => {
          const isActive = activeQuadrant === q;
          return (
            <button
              key={q}
              onClick={() => { setActiveQuadrant(isActive ? null : q); setSelected(null); }}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${QUADRANT_CONFIG[q].bg} ${QUADRANT_CONFIG[q].color} ${
                isActive ? "ring-1 ring-current shadow-sm scale-105 border-current/20" : activeQuadrant && !isActive ? "opacity-40 border-transparent" : "hover:scale-105 border-transparent"
              }`}
            >
              {quadrantCounts[q]} {QUADRANT_CONFIG[q].label}
            </button>
          );
        })}
        {activeQuadrant && (
          <button onClick={() => { setActiveQuadrant(null); setSelected(null); }} className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border/50 hover:border-border transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* SVG Chart */}
      <div className="relative w-full max-w-lg mx-auto">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Finding priority matrix chart" className="w-full" style={{ aspectRatio: "1/1", maxHeight: 400 }} onMouseLeave={() => setHoveredDot(null)}>
          {/* Quadrant backgrounds — highlight active */}
          <rect x={PAD} y={PAD} width={(W - 2 * PAD) / 2} height={(H - 2 * PAD) / 2} fill="currentColor" className="text-[#F29400]/[0.04]" opacity={!activeQuadrant || activeQuadrant === "strategic" ? 1 : 0.3} />
          <rect x={PAD + (W - 2 * PAD) / 2} y={PAD} width={(W - 2 * PAD) / 2} height={(H - 2 * PAD) / 2} fill="currentColor" className="text-muted/30" opacity={!activeQuadrant || activeQuadrant === "thankless" ? 1 : 0.3} />
          <rect x={PAD} y={PAD + (H - 2 * PAD) / 2} width={(W - 2 * PAD) / 2} height={(H - 2 * PAD) / 2} fill="currentColor" className="text-[#00F2B3]/[0.06]" opacity={!activeQuadrant || activeQuadrant === "quick-win" ? 1 : 0.3} />
          <rect x={PAD + (W - 2 * PAD) / 2} y={PAD + (H - 2 * PAD) / 2} width={(W - 2 * PAD) / 2} height={(H - 2 * PAD) / 2} fill="currentColor" className="text-[#009CFB]/[0.04]" opacity={!activeQuadrant || activeQuadrant === "low-priority" ? 1 : 0.3} />

          {/* Axis lines */}
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" className="text-border" strokeWidth="0.3" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="currentColor" className="text-border" strokeWidth="0.3" />
          <line x1={PAD} y1={PAD + (H - 2 * PAD) / 2} x2={W - PAD} y2={PAD + (H - 2 * PAD) / 2} stroke="currentColor" className="text-border" strokeWidth="0.2" strokeDasharray="2 2" />
          <line x1={PAD + (W - 2 * PAD) / 2} y1={PAD} x2={PAD + (W - 2 * PAD) / 2} y2={H - PAD} stroke="currentColor" className="text-border" strokeWidth="0.2" strokeDasharray="2 2" />

          {/* Quadrant labels */}
          <text x={PAD + 2} y={H - PAD - 2} fontSize="3" fill="currentColor" className="text-[#00F2B3]/70 dark:text-[#00F2B3]/70" fontWeight="700" letterSpacing="0.08em" style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}>QUICK WINS</text>
          <text x={PAD + (W - 2 * PAD) / 2 + 2} y={PAD + 5} fontSize="3" fill="currentColor" className="text-muted-foreground/40" fontWeight="700" letterSpacing="0.08em" style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}>RECONSIDER</text>
          <text x={PAD + 2} y={PAD + 5} fontSize="3" fill="currentColor" className="text-[#F29400]/70" fontWeight="700" letterSpacing="0.08em" style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}>STRATEGIC</text>
          <text x={PAD + (W - 2 * PAD) / 2 + 2} y={H - PAD - 2} fontSize="3" fill="currentColor" className="text-[#009CFB]/70" fontWeight="700" letterSpacing="0.08em" style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}>LOW PRIORITY</text>

          {/* Axis labels */}
          <text x={W / 2} y={H - 1.5} fontSize="3.5" textAnchor="middle" fill="currentColor" className="text-muted-foreground/60" fontWeight="600" style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}>Effort →</text>
          <text x={2.5} y={H / 2} fontSize="3.5" textAnchor="middle" fill="currentColor" className="text-muted-foreground/60" fontWeight="600" transform={`rotate(-90, 2.5, ${H / 2})`} style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}>Impact →</text>

          {/* Faded-out dots (filtered out by quadrant) */}
          {activeQuadrant && plotted.filter((p) => p.quadrant !== activeQuadrant).map((p, i) => {
            const jitterX = (((i * 7) % 11) - 5) * 0.8;
            const jitterY = (((i * 13) % 11) - 5) * 0.6;
            return (
              <circle key={`dim-${i}`} cx={toX(p.effort) + jitterX} cy={toY(p.impact) + jitterY} r={1.4} fill={SEV_DOT[p.finding.severity] ?? "#999"} opacity={0.12} />
            );
          })}

          {/* Active data points */}
          {visiblePlotted.map((p, _i) => {
            const origIdx = plotted.indexOf(p);
            const jitterX = (((origIdx * 7) % 11) - 5) * 0.8;
            const jitterY = (((origIdx * 13) % 11) - 5) * 0.6;
            const cx = toX(p.effort) + jitterX;
            const cy = toY(p.impact) + jitterY;
            const isSelected = selected === p;
            const dotColor = SEV_DOT[p.finding.severity] ?? "#999";
            return (
              <g
                key={origIdx}
                className="cursor-pointer"
                onClick={() => setSelected(isSelected ? null : p)}
                onMouseEnter={(e) => handleDotHover(p, e)}
                onMouseLeave={() => setHoveredDot(null)}
              >
                {isSelected && <circle cx={cx} cy={cy} r={5} fill={dotColor} opacity={0.12} />}
                <circle cx={cx} cy={cy} r={isSelected ? 3.5 : 2.8} fill={dotColor} opacity={0.2} />
                <circle
                  cx={cx} cy={cy}
                  r={isSelected ? 2.5 : 2}
                  fill={dotColor}
                  opacity={isSelected ? 1 : 0.85}
                  stroke={isSelected ? "#fff" : "none"}
                  strokeWidth="0.5"
                  className="transition-all duration-200"
                />
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip */}
        {hoveredDot && (
          <div
            className="absolute pointer-events-none z-30"
            style={{ left: hoveredDot.x, top: hoveredDot.y - 10, transform: "translate(-50%, -100%)" }}
          >
            <div className="bg-popover border border-border/60 rounded-xl shadow-elevated px-3.5 py-2.5 text-[11px] max-w-[220px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block h-2 w-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: SEV_DOT[hoveredDot.p.finding.severity] ?? "#999" }} />
                <span className="font-bold uppercase text-[9px] tracking-wide" style={{ color: SEV_DOT[hoveredDot.p.finding.severity] ?? "#999" }}>{hoveredDot.p.finding.severity}</span>
              </div>
              <p className="text-foreground font-display font-semibold line-clamp-2 leading-snug">{hoveredDot.p.finding.title}</p>
              <p className="text-muted-foreground/60 mt-1 text-[10px] font-medium">Impact {hoveredDot.p.impact}/5 · Effort {hoveredDot.p.effort}/4</p>
            </div>
          </div>
        )}
      </div>

      {/* Selected finding detail */}
      {selected && (
        <div className="rounded-xl border border-border/40 bg-muted/5 dark:bg-muted/5 p-5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border ${selected.finding.severity === "critical" ? "bg-[#EA0022]/10 text-[#EA0022] border-[#EA0022]/20" : selected.finding.severity === "high" ? "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400] border-[#F29400]/20" : selected.finding.severity === "medium" ? "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300] border-[#F8E300]/20" : "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB] border-[#009CFB]/20"}`}>
              {selected.finding.severity}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-current/10 ${QUADRANT_CONFIG[selected.quadrant].bg} ${QUADRANT_CONFIG[selected.quadrant].color}`}>
              {QUADRANT_CONFIG[selected.quadrant].label}
            </span>
            <span className="text-[10px] text-muted-foreground/60 font-medium ml-auto">
              Impact {selected.impact}/5 · Effort {selected.effort}/4 · {selected.firewallLabel}
            </span>
          </div>
          <p className="text-[13px] font-display font-semibold tracking-tight text-foreground">{selected.finding.title}</p>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{selected.finding.detail}</p>
          {selected.finding.remediation && (
            <div className="rounded-lg bg-[#00F2B3]/[0.04] dark:bg-[#00F2B3]/[0.06] border border-[#00F2B3]/15 px-4 py-3">
              <p className="text-[11px] text-foreground/90 leading-relaxed"><span className="font-bold text-[#00F2B3]">Remediation:</span> {selected.finding.remediation}</p>
            </div>
          )}
        </div>
      )}

      {/* Quadrant breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["quick-win", "strategic", "low-priority", "thankless"] as Quadrant[]).map((q) => {
          const items = plotted.filter((p) => p.quadrant === q);
          if (items.length === 0) return null;
          const cfg = QUADRANT_CONFIG[q];
          const isActive = activeQuadrant === q;
          const isFaded = activeQuadrant !== null && !isActive;
          return (
            <button
              key={q}
              onClick={() => { setActiveQuadrant(isActive ? null : q); setSelected(null); }}
              className={`text-left rounded-xl border p-4 sm:p-5 transition-all ${cfg.bg} ${isFaded ? "opacity-30 border-border/30" : "hover:shadow-card border-border/50"} ${isActive ? "ring-1 ring-current/20 shadow-card border-border/60" : ""}`}
            >
              <p className={`text-[11px] font-display font-bold uppercase tracking-[0.1em] ${cfg.color} mb-1`}>{cfg.label}</p>
              <p className="text-[10px] text-muted-foreground/60 mb-3">{cfg.description}</p>
              <ul className="space-y-1.5">
                {items.slice(0, 5).map((p, i) => (
                  <li key={i} className="text-[11px] text-foreground/90 flex items-start gap-2">
                    <span className="inline-block h-2 w-2 rounded-full mt-0.5 shrink-0 shadow-sm" style={{ backgroundColor: SEV_DOT[p.finding.severity] ?? "#999" }} />
                    <span className="line-clamp-1 font-medium">{p.finding.title}</span>
                  </li>
                ))}
                {items.length > 5 && (
                  <li className="text-[10px] text-muted-foreground/60 font-medium mt-1">+{items.length - 5} more</li>
                )}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
