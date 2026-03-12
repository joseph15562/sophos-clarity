import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";

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
  "quick-win": { label: "Quick Wins", color: "text-[#00995a] dark:text-[#00F2B3]", bg: "bg-[#00995a]/10 dark:bg-[#00F2B3]/10", description: "High impact, low effort — do these first" },
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

  const plotted = useMemo(() => {
    const items: PlottedFinding[] = [];
    for (const [label, result] of Object.entries(analysisResults)) {
      for (const f of result.findings) {
        if (f.severity === "info") continue;
        const impact = SEVERITY_IMPACT[f.severity] ?? 2;
        const effort = estimateEffort(f);
        items.push({ finding: f, firewallLabel: label, impact, effort, quadrant: getQuadrant(impact, effort) });
      }
    }
    return items;
  }, [analysisResults]);

  const quadrantCounts = useMemo(() => {
    const counts: Record<Quadrant, number> = { "quick-win": 0, strategic: 0, "low-priority": 0, thankless: 0 };
    for (const p of plotted) counts[p.quadrant]++;
    return counts;
  }, [plotted]);

  if (plotted.length === 0) {
    return (
      <div className="p-5 text-center text-xs text-muted-foreground">
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
    critical: "#EA0022", high: "#F29400", medium: "#F8E300", low: "#009CFB",
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Target className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
        <h3 className="text-sm font-display font-bold text-foreground">Finding Priority Matrix</h3>
        <span className="text-[10px] text-muted-foreground">{plotted.length} findings plotted</span>
      </div>

      {/* Quadrant summary chips */}
      <div className="flex flex-wrap gap-2">
        {(["quick-win", "strategic", "low-priority", "thankless"] as Quadrant[]).map((q) => (
          <span key={q} className={`text-[10px] font-medium px-2 py-1 rounded-md ${QUADRANT_CONFIG[q].bg} ${QUADRANT_CONFIG[q].color}`}>
            {quadrantCounts[q]} {QUADRANT_CONFIG[q].label}
          </span>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="relative w-full max-w-lg mx-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ aspectRatio: "1/1", maxHeight: 400 }}>
          {/* Quadrant backgrounds */}
          <rect x={PAD} y={PAD} width={(W - 2 * PAD) / 2} height={(H - 2 * PAD) / 2} fill="currentColor" className="text-[#F29400]/[0.04]" />
          <rect x={PAD + (W - 2 * PAD) / 2} y={PAD} width={(W - 2 * PAD) / 2} height={(H - 2 * PAD) / 2} fill="currentColor" className="text-muted/30" />
          <rect x={PAD} y={PAD + (H - 2 * PAD) / 2} width={(W - 2 * PAD) / 2} height={(H - 2 * PAD) / 2} fill="currentColor" className="text-[#00995a]/[0.06]" />
          <rect x={PAD + (W - 2 * PAD) / 2} y={PAD + (H - 2 * PAD) / 2} width={(W - 2 * PAD) / 2} height={(H - 2 * PAD) / 2} fill="currentColor" className="text-[#009CFB]/[0.04]" />

          {/* Axis lines */}
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" className="text-border" strokeWidth="0.3" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="currentColor" className="text-border" strokeWidth="0.3" />
          {/* Center lines */}
          <line x1={PAD} y1={PAD + (H - 2 * PAD) / 2} x2={W - PAD} y2={PAD + (H - 2 * PAD) / 2} stroke="currentColor" className="text-border" strokeWidth="0.2" strokeDasharray="2 2" />
          <line x1={PAD + (W - 2 * PAD) / 2} y1={PAD} x2={PAD + (W - 2 * PAD) / 2} y2={H - PAD} stroke="currentColor" className="text-border" strokeWidth="0.2" strokeDasharray="2 2" />

          {/* Quadrant labels */}
          <text x={PAD + 2} y={H - PAD - 2} fontSize="2.5" fill="currentColor" className="text-[#00995a]/60 dark:text-[#00F2B3]/60" fontWeight="600">QUICK WINS</text>
          <text x={PAD + (W - 2 * PAD) / 2 + 2} y={PAD + 4} fontSize="2.5" fill="currentColor" className="text-muted-foreground/40" fontWeight="600">RECONSIDER</text>
          <text x={PAD + 2} y={PAD + 4} fontSize="2.5" fill="currentColor" className="text-[#F29400]/60" fontWeight="600">STRATEGIC</text>
          <text x={PAD + (W - 2 * PAD) / 2 + 2} y={H - PAD - 2} fontSize="2.5" fill="currentColor" className="text-[#009CFB]/60" fontWeight="600">LOW PRIORITY</text>

          {/* Axis labels */}
          <text x={W / 2} y={H - 2} fontSize="3" textAnchor="middle" fill="currentColor" className="text-muted-foreground">Effort →</text>
          <text x={3} y={H / 2} fontSize="3" textAnchor="middle" fill="currentColor" className="text-muted-foreground" transform={`rotate(-90, 3, ${H / 2})`}>Impact →</text>

          {/* Data points */}
          {plotted.map((p, i) => {
            const jitterX = (((i * 7) % 11) - 5) * 0.8;
            const jitterY = (((i * 13) % 11) - 5) * 0.6;
            const cx = toX(p.effort) + jitterX;
            const cy = toY(p.impact) + jitterY;
            const isSelected = selected === p;
            return (
              <g key={i} className="cursor-pointer" onClick={() => setSelected(isSelected ? null : p)}>
                <circle cx={cx} cy={cy} r={isSelected ? 2.5 : 1.8} fill={SEV_DOT[p.finding.severity] ?? "#999"} opacity={isSelected ? 1 : 0.75} stroke={isSelected ? "#fff" : "none"} strokeWidth="0.5" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected finding detail */}
      {selected && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selected.finding.severity === "critical" ? "bg-[#EA0022]/10 text-[#EA0022]" : selected.finding.severity === "high" ? "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]" : selected.finding.severity === "medium" ? "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]" : "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB]"}`}>
              {selected.finding.severity}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${QUADRANT_CONFIG[selected.quadrant].bg} ${QUADRANT_CONFIG[selected.quadrant].color}`}>
              {QUADRANT_CONFIG[selected.quadrant].label}
            </span>
          </div>
          <p className="text-xs font-medium text-foreground">{selected.finding.title}</p>
          <p className="text-[10px] text-muted-foreground">{selected.finding.detail}</p>
          {selected.finding.remediation && (
            <p className="text-[10px] text-muted-foreground italic">Remediation: {selected.finding.remediation}</p>
          )}
          <div className="flex gap-4 text-[9px] text-muted-foreground pt-1">
            <span>Impact: {selected.impact}/5</span>
            <span>Effort: {selected.effort}/4</span>
            <span>Firewall: {selected.firewallLabel}</span>
          </div>
        </div>
      )}

      {/* Quadrant lists */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["quick-win", "strategic", "low-priority", "thankless"] as Quadrant[]).map((q) => {
          const items = plotted.filter((p) => p.quadrant === q);
          if (items.length === 0) return null;
          const cfg = QUADRANT_CONFIG[q];
          return (
            <div key={q} className={`rounded-lg border border-border p-3 ${cfg.bg}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color} mb-1`}>{cfg.label}</p>
              <p className="text-[9px] text-muted-foreground mb-2">{cfg.description}</p>
              <ul className="space-y-1">
                {items.slice(0, 8).map((p, i) => (
                  <li key={i} className="text-[10px] text-foreground flex items-start gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: SEV_DOT[p.finding.severity] ?? "#999" }} />
                    <span className="line-clamp-1">{p.finding.title}</span>
                  </li>
                ))}
                {items.length > 8 && (
                  <li className="text-[9px] text-muted-foreground">+{items.length - 8} more</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
