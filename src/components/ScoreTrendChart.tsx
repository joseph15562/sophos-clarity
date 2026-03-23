import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { TrendingUp, Download } from "lucide-react";
import { toPng } from "html-to-image";
import { loadScoreHistory, type ScoreHistoryEntry } from "@/lib/score-history";

const GRADE_COLORS: Record<string, string> = {
  A: "stroke-[#00F2B3] dark:stroke-[#00F2B3] fill-[#00F2B3] dark:fill-[#00F2B3]",
  B: "stroke-[#009CFB] fill-[#009CFB]",
  C: "stroke-[#F8E300] fill-[#F8E300]",
  D: "stroke-[#F29400] fill-[#F29400]",
  F: "stroke-[#EA0022] fill-[#EA0022]",
};

function gradeColor(grade: string): string {
  return GRADE_COLORS[grade] ?? GRADE_COLORS.C;
}

interface ScoreTrendChartProps {
  orgId?: string;
  hostname?: string;
  /** When provided, uses this data instead of loading from Supabase (e.g. for client portal) */
  data?: ScoreHistoryEntry[];
}

const CATEGORY_OVERALL = "__overall__";

export function ScoreTrendChart({ orgId, hostname, data: propData }: ScoreTrendChartProps) {
  const [data, setData] = useState<ScoreHistoryEntry[]>([]);
  const [loading, setLoading] = useState(!propData);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORY_OVERALL);
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propData) {
      setData(propData);
      setLoading(false);
      return;
    }
    if (!orgId) {
      setData([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadScoreHistory(orgId, hostname, 30).then((entries) => {
      if (!cancelled) {
        setData(entries);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [orgId, hostname, propData]);

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const d of data) {
      for (const c of d.category_scores ?? []) {
        seen.add(c.label);
      }
    }
    return Array.from(seen).sort();
  }, [data]);

  const getScore = useCallback((d: ScoreHistoryEntry): number => {
    if (selectedCategory === CATEGORY_OVERALL) return d.overall_score;
    const cat = (d.category_scores ?? []).find((c) => c.label === selectedCategory);
    return cat?.score ?? d.overall_score;
  }, [selectedCategory]);

  const getGrade = useCallback((d: ScoreHistoryEntry): string => {
    if (selectedCategory === CATEGORY_OVERALL) return d.overall_grade;
    const score = getScore(d);
    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    if (score >= 40) return "D";
    return "F";
  }, [selectedCategory, getScore]);

  const handleExportPng = useCallback(async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, { pixelRatio: 2, backgroundColor: "hsl(var(--card))" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `score-trend-${selectedCategory === CATEGORY_OVERALL ? "overall" : selectedCategory.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  }, [selectedCategory]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 animate-pulse">
        <div className="h-4 bg-muted/40 rounded w-1/3 mb-3" />
        <div className="h-32 bg-muted/40 rounded" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-center space-y-2">
        <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">
          No historical data yet. Scores will be tracked as assessments are run.
        </p>
      </div>
    );
  }

  const w = 400;
  const h = 140;
  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const scores = data.map((d) => getScore(d));
  const minScore = Math.min(0, ...scores);
  const maxScore = Math.max(100, ...scores);
  const range = maxScore - minScore || 1;

  const toX = (i: number) => pad.left + (i / (data.length - 1 || 1)) * chartW;
  const toY = (score: number) => pad.top + chartH - ((score - minScore) / range) * chartH;

  const pathD = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(getScore(d))}`)
    .join(" ");

  const initial = data[0];
  const current = data[data.length - 1];
  const initialScore = getScore(initial);
  const currentScore = getScore(current);
  const diff = currentScore - initialScore;

  return (
    <div ref={chartRef} className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          Score Trend
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
          >
            <option value={CATEGORY_OVERALL}>Overall</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExportPng}
            disabled={exporting}
            className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-[10px] text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            Export PNG
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-muted-foreground">
          Initial: <span className="font-semibold text-foreground">{initialScore}</span> ({getGrade(initial)})
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="text-muted-foreground">
          Current: <span className={`font-semibold ${diff >= 0 ? "text-[#00F2B3] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
            {currentScore}
          </span> ({getGrade(current)})
          {diff !== 0 && (
            <span className={diff > 0 ? "text-[#00F2B3] dark:text-[#00F2B3]" : "text-[#EA0022]"}>
              {" "}({diff > 0 ? "+" : ""}{diff})
            </span>
          )}
        </span>
      </div>

      <div className="w-full" style={{ minHeight: 140 }}>
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = toY(v);
          return (
            <g key={v}>
              <line x1={pad.left} y1={y} x2={pad.left + chartW} y2={y} stroke="currentColor" strokeOpacity={0.1} strokeDasharray="2 2" />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" className="text-[9px] fill-muted-foreground" fontSize={9}>
                {v}
              </text>
            </g>
          );
        })}

        {/* X-axis labels (first, middle, last) */}
        {data.length > 0 && (
          <>
            <text x={pad.left} y={h - 6} textAnchor="start" className="text-[9px] fill-muted-foreground" fontSize={9}>
              {new Date(data[0].assessed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </text>
            {data.length > 1 && (
              <text x={pad.left + chartW / 2} y={h - 6} textAnchor="middle" className="text-[9px] fill-muted-foreground" fontSize={9}>
                {new Date(data[Math.floor(data.length / 2)].assessed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </text>
            )}
            {data.length > 1 && (
              <text x={pad.left + chartW} y={h - 6} textAnchor="end" className="text-[9px] fill-muted-foreground" fontSize={9}>
                {new Date(data[data.length - 1].assessed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </text>
            )}
          </>
        )}

        {/* Line */}
        <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots with grade labels */}
        {data.map((d, i) => {
          const x = toX(i);
          const y = toY(getScore(d));
          const isHovered = hoveredIdx === i;
          const colorClass = gradeColor(getGrade(d));

          return (
            <g key={d.id}>
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 8 : 5}
                className={`${colorClass} transition-all cursor-pointer`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                className="text-[8px] font-bold fill-background pointer-events-none"
                fontSize={8}
              >
                {getGrade(d)}
              </text>
              {/* Tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={x - 42}
                    y={y - 36}
                    width={84}
                    height={28}
                    rx={4}
                    className="fill-card stroke-border"
                    strokeWidth={1}
                  />
                  <text x={x} y={y - 22} textAnchor="middle" className="text-[9px] fill-foreground" fontSize={9}>
                    {new Date(d.assessed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </text>
                  <text x={x} y={y - 12} textAnchor="middle" className="text-[10px] font-bold fill-foreground" fontSize={10}>
                    {getScore(d)} ({getGrade(d)})
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      </div>

      <div className="flex flex-wrap gap-3 text-[9px] text-muted-foreground">
        <span>● Score over time</span>
        <span>Letter = grade at each assessment</span>
      </div>
    </div>
  );
}
