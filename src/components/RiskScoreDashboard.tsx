import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore, type RiskScoreResult } from "@/lib/risk-score";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

const GRADE_COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  A: { ring: "ring-[#00995a]/30 dark:ring-[#00F2B3]/30", text: "text-[#00995a] dark:text-[#00F2B3]", bg: "bg-[#00995a]/10 dark:bg-[#00F2B3]/10" },
  B: { ring: "ring-[#00995a]/20 dark:ring-[#00F2B3]/20", text: "text-[#00774a] dark:text-[#00F2B3]", bg: "bg-[#00995a]/5 dark:bg-[#00F2B3]/5" },
  C: { ring: "ring-[#F8E300]/30", text: "text-[#b8a200] dark:text-[#F8E300]", bg: "bg-[#F8E300]/10" },
  D: { ring: "ring-[#F29400]/30", text: "text-[#c47800] dark:text-[#F29400]", bg: "bg-[#F29400]/10" },
  F: { ring: "ring-[#EA0022]/30", text: "text-[#EA0022]", bg: "bg-[#EA0022]/10" },
};

function GaugeRing({ score, grade }: { score: number; grade: string }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS.C;

  const strokeColor =
    grade === "A" || grade === "B" ? "#00995a" : grade === "C" ? "#F8E300" : grade === "D" ? "#F29400" : "#EA0022";

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="text-center z-10">
        <span className={`text-3xl font-extrabold ${colors.text}`}>{score}</span>
        <span className={`block text-xs font-bold ${colors.text} mt-0.5`}>Grade {grade}</span>
      </div>
    </div>
  );
}

function SvgRadar({ categories }: { categories: RiskScoreResult["categories"] }) {
  const cx = 120, cy = 120, r = 90;
  const n = categories.length;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    return {
      x: cx + r * (value / 100) * Math.cos(angle),
      y: cy + r * (value / 100) * Math.sin(angle),
    };
  };

  const gridLevels = [1, 0.75, 0.5, 0.25];
  const dataPoints = categories.map((c, i) => getPoint(i, c.pct));
  const polyPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width="240" height="240" viewBox="0 0 240 240" className="max-w-full">
      {gridLevels.map((s) => (
        <polygon
          key={s}
          points={categories.map((_, i) => {
            const p = getPoint(i, s * 100);
            return `${p.x},${p.y}`;
          }).join(" ")}
          fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted/30"
        />
      ))}
      {categories.map((_, i) => {
        const p = getPoint(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="currentColor" strokeWidth="0.3" className="text-muted/20" />;
      })}
      <polygon points={polyPoints} fill="#2006F7" fillOpacity="0.15" stroke="#2006F7" strokeWidth="2" strokeLinejoin="round" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#2006F7" />
      ))}
      {categories.map((c, i) => {
        const labelR = r + 18;
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const lx = cx + labelR * Math.cos(angle);
        const ly = cy + labelR * Math.sin(angle);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="500" fill="currentColor" className="text-muted-foreground">
            {c.label}
          </text>
        );
      })}
    </svg>
  );
}

export function RiskScoreDashboard({ analysisResults }: Props) {
  const perFirewall = useMemo(() => {
    const entries: { label: string; result: RiskScoreResult }[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      entries.push({ label, result: computeRiskScore(ar) });
    }
    return entries;
  }, [analysisResults]);

  const aggregated = useMemo<RiskScoreResult>(() => {
    if (perFirewall.length === 1) return perFirewall[0].result;
    const categoryLabels = perFirewall[0]?.result.categories.map((c) => c.label) ?? [];
    const categories = categoryLabels.map((label) => {
      const scores = perFirewall.map((fw) => fw.result.categories.find((c) => c.label === label)?.pct ?? 0);
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      return { label, score: avg, maxScore: 100, pct: avg, details: `Average across ${perFirewall.length} firewalls` };
    });
    const overall = Math.round(categories.reduce((s, c) => s + c.pct, 0) / categories.length);
    const grade: RiskScoreResult["grade"] =
      overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";
    return { overall, grade, categories };
  }, [perFirewall]);

  const categories = aggregated.categories;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <img src="/icons/sophos-security.svg" alt="" className="h-5 w-5 sophos-icon" />
        <h3 className="text-sm font-semibold text-foreground">Security Risk Score</h3>
        <span className="text-[10px] text-muted-foreground">
          {perFirewall.length > 1 ? `aggregated across ${perFirewall.length} firewalls` : "single firewall"}
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 items-center">
        {/* Gauge + category scores */}
        <div className="flex flex-col items-center gap-4">
          <GaugeRing score={aggregated.overall} grade={aggregated.grade} />
          <div className="w-full grid grid-cols-2 gap-2">
            {categories.map((c) => {
              const color =
                c.pct >= 80 ? "#00995a" :
                c.pct >= 50 ? "#F8E300" :
                "#EA0022";
              return (
                <div key={c.label} className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-center">
                  <span className="text-lg font-extrabold tabular-nums block" style={{ color }}>{c.pct}%</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{c.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SVG Radar chart */}
        <div className="flex items-center justify-center">
          <SvgRadar categories={categories} />
        </div>
      </div>

      {/* Per-firewall scores (estate view) */}
      {perFirewall.length > 1 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Per-Firewall Scores</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {perFirewall
              .sort((a, b) => a.result.overall - b.result.overall)
              .map(({ label, result: r }) => {
                const gc = GRADE_COLORS[r.grade] ?? GRADE_COLORS.C;
                return (
                  <div key={label} className={`rounded-lg border border-border ${gc.bg} px-3 py-2 flex items-center justify-between`}>
                    <span className="text-xs font-medium text-foreground truncate mr-2">{label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-lg font-extrabold ${gc.text}`}>{r.overall}</span>
                      <span className={`text-[10px] font-bold ${gc.text} px-1.5 py-0.5 rounded ring-1 ${gc.ring}`}>{r.grade}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </section>
  );
}
