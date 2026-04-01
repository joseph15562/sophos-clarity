import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useResolvedIsDark } from "@/hooks/use-resolved-appearance";
import { TrendingUp, Download } from "lucide-react";
import { toPng } from "html-to-image";
import { loadScoreHistory, type ScoreHistoryEntry } from "@/lib/score-history";
import { GRADE_COLORS, gradeForScore, type Grade } from "@/lib/design-tokens";

interface ScoreTrendChartProps {
  orgId?: string;
  hostname?: string;
  /** When provided, uses this data instead of loading from Supabase (e.g. for client portal) */
  data?: ScoreHistoryEntry[];
  /** Fired when a data point is clicked; parent can reflect this in a gauge */
  onSelectScore?: (score: number, grade: string, date: string) => void;
}

const CATEGORY_OVERALL = "__overall__";

function ScoreTrendChartInner({
  orgId,
  hostname,
  data: propData,
  onSelectScore,
}: ScoreTrendChartProps) {
  const [data, setData] = useState<ScoreHistoryEntry[]>([]);
  const [loading, setLoading] = useState(!propData);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORY_OVERALL);
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const isDark = useResolvedIsDark();
  const gridLineStroke = isDark ? "rgba(255,255,255,0.16)" : "rgba(51, 65, 85, 0.30)";
  const axisLabelFill = isDark ? "rgba(226, 232, 240, 0.88)" : "rgba(30, 41, 59, 0.82)";
  const dotOutlineStroke = isDark ? "rgba(241, 245, 249, 0.9)" : "rgba(15, 23, 42, 0.85)";

  const chartSurfaceStyle = useMemo(
    () =>
      isDark
        ? {
            background: "linear-gradient(145deg, rgba(90,0,255,0.07), rgba(0,237,255,0.025))",
            boxShadow: "0 12px 40px rgba(32,6,247,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
          }
        : {
            background: "linear-gradient(145deg, rgba(255,255,255,0.99), rgba(247,249,255,0.96))",
            boxShadow: "0 8px 28px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.98)",
          },
    [isDark],
  );

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
      <div
        className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 sm:p-6 animate-pulse"
        style={chartSurfaceStyle}
      >
        <div className="h-4 bg-white/80 dark:bg-white/[0.06] rounded w-1/3 mb-3" />
        <div className="h-36 bg-white/80 dark:bg-white/[0.06] rounded-xl" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 sm:p-6 text-center space-y-2"
        style={chartSurfaceStyle}
      >
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

  const selEntry = selectedIdx !== null && data[selectedIdx] ? data[selectedIdx] : null;
  const selScore = selEntry ? getScore(selEntry) : null;
  const selGrade = selEntry ? getGrade(selEntry) : null;
  const selHex = selGrade ? (GRADE_COLORS[selGrade as Grade] ?? GRADE_COLORS.C) : "#2006F7";
  const selDate = selEntry
    ? new Date(selEntry.assessed_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const handleDotClick = (i: number) => {
    const next = selectedIdx === i ? null : i;
    setSelectedIdx(next);
    if (onSelectScore) {
      if (next !== null) {
        const d = data[next];
        onSelectScore(
          getScore(d),
          getGrade(d),
          new Date(d.assessed_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        );
      } else {
        onSelectScore(-1, "", "");
      }
    }
  };

  return (
    <div
      ref={chartRef}
      className={`group relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm p-5 sm:p-6 space-y-4 transition-all duration-200 hover:border-slate-900/[0.14] dark:hover:border-white/[0.10] ${
        isDark
          ? "hover:shadow-[0_8px_40px_rgba(32,6,247,0.12)]"
          : "hover:shadow-[0_12px_32px_rgba(15,23,42,0.07)]"
      }`}
      style={chartSurfaceStyle}
    >
      {/* Corner glow */}
      <div
        className={`absolute -top-10 -right-10 h-28 w-28 rounded-full blur-[50px] pointer-events-none transition-opacity duration-300 ${
          isDark
            ? "opacity-20 group-hover:opacity-[0.35]"
            : "opacity-[0.08] group-hover:opacity-[0.14]"
        }`}
        style={{ background: "radial-gradient(circle, #5A00FF 0%, transparent 70%)" }}
      />
      {/* Top shimmer */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: isDark
            ? "linear-gradient(90deg, transparent, rgba(90,0,255,0.35), rgba(0,237,255,0.2), transparent)"
            : "linear-gradient(90deg, transparent, rgba(90,0,255,0.18), rgba(0,237,255,0.1), transparent)",
        }}
      />

      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-display font-black text-foreground uppercase tracking-wider flex items-center gap-2">
          <span
            className="h-7 w-7 rounded-xl flex items-center justify-center border border-slate-900/[0.12] dark:border-white/[0.08]"
            style={{
              background: "linear-gradient(135deg, rgba(90,0,255,0.18), rgba(0,237,255,0.10))",
            }}
          >
            <TrendingUp
              className="h-3.5 w-3.5 text-[#00EDFF]"
              style={{ filter: "drop-shadow(0 0 4px rgba(0,237,255,0.5))" }}
            />
          </span>
          Score Trend
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedIdx(null);
            }}
            className="rounded-xl border border-slate-900/[0.12] dark:border-white/[0.08] px-2.5 py-1.5 text-[10px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all"
            style={{
              background: "linear-gradient(145deg, rgba(90,0,255,0.06), rgba(0,237,255,0.02))",
            }}
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
            className="group/btn relative overflow-hidden flex items-center gap-1 rounded-xl border border-slate-900/[0.12] dark:border-white/[0.08] px-2.5 py-1.5 text-[10px] font-bold text-foreground hover:border-slate-900/[0.18] dark:hover:border-white/[0.14] transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(145deg, rgba(90,0,255,0.06), rgba(0,237,255,0.02))",
            }}
          >
            <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full blur-[8px] opacity-0 transition-opacity duration-200 group-hover/btn:opacity-30 pointer-events-none bg-[#00EDFF]" />
            <Download className="h-3 w-3 text-[#00EDFF]" />
            Export PNG
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="relative flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">
          Initial: <span className="font-black text-foreground">{initialScore}</span>{" "}
          <span className="opacity-60">({getGrade(initial)})</span>
        </span>
        <span className="text-muted-foreground/40">→</span>
        <span className="text-muted-foreground">
          Current:{" "}
          <span className={`font-black ${diff >= 0 ? "text-[#00F2B3]" : "text-[#EA0022]"}`}>
            {currentScore}
          </span>{" "}
          <span className="opacity-60">({getGrade(current)})</span>
        </span>
        {diff !== 0 && (
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-full border"
            style={{
              color: diff > 0 ? "#00F2B3" : "#EA0022",
              background: diff > 0 ? "rgba(0,242,179,0.08)" : "rgba(234,0,34,0.08)",
              borderColor: diff > 0 ? "rgba(0,242,179,0.15)" : "rgba(234,0,34,0.15)",
            }}
          >
            {diff > 0 ? "+" : ""}
            {diff}
          </span>
        )}
      </div>

      {/* Selected point highlight card */}
      {selEntry && selScore !== null && (
        <div
          className="relative overflow-hidden rounded-xl border px-4 py-3 flex items-center gap-4 transition-all duration-200"
          style={{
            borderColor: `${selHex}25`,
            background: `linear-gradient(145deg, ${selHex}12, ${selHex}04)`,
          }}
        >
          <div
            className="absolute -top-4 -right-4 h-12 w-12 rounded-full blur-[20px] opacity-30 pointer-events-none"
            style={{ backgroundColor: selHex }}
          />
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{ background: `linear-gradient(90deg, transparent, ${selHex}50, transparent)` }}
          />
          <div className="text-center">
            <p className="text-2xl font-black" style={{ color: selHex }}>
              {selScore}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {selGrade}
            </p>
          </div>
          <div className="h-8 w-px bg-slate-900/12 dark:bg-white/[0.12]" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-foreground">Selected snapshot</p>
            <p className="text-[10px] text-muted-foreground">{selDate}</p>
          </div>
          <button
            onClick={() => setSelectedIdx(null)}
            className="text-[9px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-slate-900/[0.10] dark:border-white/[0.06] hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] transition-all bg-slate-900/[0.04] dark:bg-white/[0.03]"
          >
            Clear
          </button>
        </div>
      )}

      {/* Chart */}
      <div className="relative w-full" style={{ minHeight: h }}>
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
                  stroke={gridLineStroke}
                  strokeWidth={isDark ? 1 : 1.05}
                  strokeDasharray="3 3"
                />
                <text x={pad.left - 6} y={y + 4} textAnchor="end" fill={axisLabelFill} fontSize={9}>
                  {v}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
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
                fill={axisLabelFill}
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

          {/* Selected point vertical guide line */}
          {selectedIdx !== null && (
            <line
              x1={toX(selectedIdx)}
              y1={pad.top}
              x2={toX(selectedIdx)}
              y2={pad.top + chartH}
              stroke={selHex}
              strokeOpacity={0.2}
              strokeDasharray="4 3"
            />
          )}

          {/* Dots */}
          {data.map((d, i) => {
            const x = toX(i);
            const y = toY(getScore(d));
            const isHovered = hoveredIdx === i;
            const isSelected = selectedIdx === i;
            const isActive = isHovered || isSelected;
            const grade = getGrade(d);
            const hex = GRADE_COLORS[grade as Grade] ?? GRADE_COLORS.C;

            return (
              <g key={d.id}>
                {/* Outer glow ring for selected */}
                {isSelected && (
                  <>
                    <circle cx={x} cy={y} r={18} fill={hex} fillOpacity={0.08} />
                    <circle
                      cx={x}
                      cy={y}
                      r={12}
                      fill="none"
                      stroke={hex}
                      strokeWidth={1}
                      strokeOpacity={0.25}
                      strokeDasharray="3 2"
                    />
                  </>
                )}
                {isActive && <circle cx={x} cy={y} r={14} fill={hex} fillOpacity={0.15} />}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 8 : isHovered ? 7 : 4.5}
                  fill={hex}
                  stroke={isSelected ? hex : dotOutlineStroke}
                  strokeWidth={isSelected ? 2 : 1.5}
                  className="transition-all duration-150 cursor-pointer"
                  style={isSelected ? { filter: `drop-shadow(0 0 6px ${hex}80)` } : undefined}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => handleDotClick(i)}
                />
                {isActive && (
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
                {/* Tooltip on hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={x - 54}
                      y={y - 46}
                      width={108}
                      height={34}
                      rx={8}
                      fill="#0a1628"
                      stroke={hex}
                      strokeWidth={1}
                      fillOpacity={0.95}
                    />
                    <text
                      x={x}
                      y={y - 30}
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
                      y={y - 18}
                      textAnchor="middle"
                      className="font-bold"
                      fontSize={11}
                      fill={hex}
                    >
                      {getScore(d)} ({grade}) — click to select
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="relative flex flex-wrap items-center gap-4 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full bg-gradient-to-r from-[#5A00FF] to-[#00EDFF]" />
          Score over time
        </span>
        <span>Click a point to select • Hover for detail</span>
      </div>
    </div>
  );
}

export const ScoreTrendChart = memo(ScoreTrendChartInner);
