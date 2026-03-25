import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { TrendingUp, Download } from "lucide-react";
import { toPng } from "html-to-image";
import { loadScoreHistory, type ScoreHistoryEntry } from "@/lib/score-history";
import { GRADE_COLORS, gradeForScore, type Grade } from "@/lib/design-tokens";

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
    return () => {
      cancelled = true;
    };
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

  const getScore = useCallback(
    (d: ScoreHistoryEntry): number => {
      if (selectedCategory === CATEGORY_OVERALL) return d.overall_score;
      const cat = (d.category_scores ?? []).find((c) => c.label === selectedCategory);
      return cat?.score ?? d.overall_score;
    },
    [selectedCategory],
  );

  const getGrade = useCallback(
    (d: ScoreHistoryEntry): string => {
      if (selectedCategory === CATEGORY_OVERALL) return d.overall_grade;
      return gradeForScore(getScore(d));
    },
    [selectedCategory, getScore],
  );

  const handleExportPng = useCallback(async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, {
        pixelRatio: 2,
        backgroundColor: "hsl(var(--card))",
      });
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
      <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] p-5 sm:p-6 animate-pulse">
        <div className="h-4 bg-muted/40 rounded w-1/3 mb-3" />
        <div className="h-36 bg-muted/40 rounded-xl" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] p-5 sm:p-6 text-center space-y-2">
        <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">
          No historical data yet. Scores will be tracked as assessments are run.
        </p>
      </div>
    );
  }

  const w = 400;
  const h = 180;
  const pad = { top: 16, right: 16, bottom: 28, left: 36 };
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
    <div
      ref={chartRef}
      className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-display font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#5A00FF] to-[#00EDFF] flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5 text-white" />
          </span>
          Score Trend
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-brand-accent/15 bg-background/60 dark:bg-background/30 px-2.5 py-1.5 text-[10px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent/30 transition-all"
          >
            <option value={CATEGORY_OVERALL}>Overall</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExportPng}
            disabled={exporting}
            className="flex items-center gap-1 rounded-xl border border-brand-accent/15 bg-brand-accent/[0.04] px-2.5 py-1.5 text-[10px] font-medium text-foreground hover:bg-brand-accent/[0.08] transition-all disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            Export PNG
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">
          Initial: <span className="font-bold text-foreground">{initialScore}</span>{" "}
          <span className="opacity-60">({getGrade(initial)})</span>
        </span>
        <span className="text-muted-foreground/40">→</span>
        <span className="text-muted-foreground">
          Current:{" "}
          <span className={`font-bold ${diff >= 0 ? "text-[#00F2B3]" : "text-[#EA0022]"}`}>
            {currentScore}
          </span>{" "}
          <span className="opacity-60">({getGrade(current)})</span>
        </span>
        {diff !== 0 && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diff > 0 ? "bg-[#00F2B3]/10 text-[#00F2B3]" : "bg-[#EA0022]/10 text-[#EA0022]"}`}
          >
            {diff > 0 ? "+" : ""}
            {diff}
          </span>
        )}
      </div>

      <div className="w-full" style={{ minHeight: h }}>
        <svg
          width="100%"
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="trend-line-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5A00FF" />
              <stop offset="50%" stopColor="#2006F7" />
              <stop offset="100%" stopColor="#00EDFF" />
            </linearGradient>
            <linearGradient id="trend-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2006F7" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2006F7" stopOpacity="0" />
            </linearGradient>
            <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Y-axis labels */}
          {[0, 25, 50, 75, 100].map((v) => {
            const y = toY(v);
            return (
              <g key={v}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + chartW}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.07}
                  strokeDasharray="3 3"
                />
                <text
                  x={pad.left - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground"
                  fontSize={9}
                >
                  {v}
                </text>
              </g>
            );
          })}

          {/* X-axis labels — spread evenly, max 6 */}
          {(() => {
            const count = Math.min(data.length, 6);
            const indices =
              count <= 1
                ? [0]
                : Array.from({ length: count }, (_, i) =>
                    Math.round((i * (data.length - 1)) / (count - 1)),
                  );
            return indices.map((idx) => (
              <text
                key={idx}
                x={toX(idx)}
                y={h - 4}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {new Date(data[idx].assessed_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </text>
            ));
          })()}

          {/* Area fill under line */}
          <path
            d={`${pathD} L ${toX(data.length - 1)} ${pad.top + chartH} L ${toX(0)} ${pad.top + chartH} Z`}
            fill="url(#trend-area-grad)"
          />

          {/* Line with glow */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#trend-line-grad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#line-glow)"
          />

          {/* Dots */}
          {data.map((d, i) => {
            const x = toX(i);
            const y = toY(getScore(d));
            const isHovered = hoveredIdx === i;
            const grade = getGrade(d);
            const hex = GRADE_COLORS[grade as Grade] ?? GRADE_COLORS.C;

            return (
              <g key={d.id}>
                {isHovered && <circle cx={x} cy={y} r={14} fill={hex} fillOpacity={0.15} />}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 7 : 4.5}
                  fill={hex}
                  stroke="#0a1628"
                  strokeWidth={1.5}
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
                {isHovered && (
                  <text
                    x={x}
                    y={y + 3.5}
                    textAnchor="middle"
                    className="font-bold fill-background pointer-events-none"
                    fontSize={8}
                  >
                    {grade}
                  </text>
                )}
                {/* Tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={x - 50}
                      y={y - 42}
                      width={100}
                      height={30}
                      rx={6}
                      fill="#0a1628"
                      stroke={hex}
                      strokeWidth={1}
                      fillOpacity={0.95}
                    />
                    <text
                      x={x}
                      y={y - 27}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      fontSize={9}
                    >
                      {new Date(d.assessed_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </text>
                    <text
                      x={x}
                      y={y - 16}
                      textAnchor="middle"
                      className="font-bold"
                      fontSize={11}
                      fill={hex}
                    >
                      {getScore(d)} ({grade})
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full bg-gradient-to-r from-[#5A00FF] to-[#00EDFF]" />
          Score over time
        </span>
        <span>Hover for grade detail</span>
      </div>
    </div>
  );
}
