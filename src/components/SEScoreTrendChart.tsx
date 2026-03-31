import { useCallback, useEffect, useMemo, useState, memo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { GRADE_COLORS, type Grade } from "@/lib/design-tokens";

interface TrendPoint {
  id: string;
  score: number;
  grade: string;
  date: string;
  customerName: string | null;
}

interface Props {
  serialNumbers: string[];
  currentScore?: number;
  currentGrade?: string;
  seProfileId: string;
  activeTeamId?: string | null;
}

function gradeColorClass(grade: string): string {
  switch (grade) {
    case "A":
      return "bg-[#00F2B3]/15 text-[#00F2B3] dark:bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3]";
    case "B":
      return "bg-brand-accent/15 text-[#2006F7] dark:bg-[#00EDFF]/10 dark:text-[#00EDFF]";
    case "C":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "D":
      return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
    case "F":
      return "bg-[#EA0022]/15 text-[#EA0022]";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function SEScoreTrendChartInner({
  serialNumbers,
  currentScore,
  currentGrade,
  seProfileId,
  activeTeamId,
}: Props) {
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const serialKey = useMemo(() => serialNumbers.filter(Boolean).sort().join(","), [serialNumbers]);

  const load = useCallback(async () => {
    if (!serialKey) {
      setPoints([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from("se_health_checks")
        .select("id, overall_score, overall_grade, checked_at, customer_name")
        .overlaps("serial_numbers", serialKey.split(","))
        .order("checked_at", { ascending: true })
        .limit(100);

      if (activeTeamId) {
        query = query.eq("team_id", activeTeamId);
      } else {
        query = query.eq("se_user_id", seProfileId);
      }

      const { data, error } = await query;
      if (error || !data) {
        setPoints([]);
        setLoading(false);
        return;
      }

      const matched: TrendPoint[] = [];
      for (const row of data) {
        if (row.overall_score != null && row.overall_grade) {
          matched.push({
            id: row.id,
            score: row.overall_score,
            grade: row.overall_grade,
            date: row.checked_at,
            customerName: row.customer_name,
          });
        }
      }
      setPoints(matched);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [serialKey, seProfileId, activeTeamId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return null;
  if (points.length < 2) return null;

  const w = 420;
  const h = 150;
  const pad = { top: 14, right: 14, bottom: 30, left: 38 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const toX = (i: number) => pad.left + (i / (points.length - 1 || 1)) * chartW;
  const toY = (score: number) => pad.top + chartH - (score / 100) * chartH;

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.score)}`).join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const delta = last.score - first.score;

  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaColor =
    delta > 0
      ? "text-[#007A5A] dark:text-[#00F2B3]"
      : delta < 0
        ? "text-[#EA0022]"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          Score History
        </p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>
            {points.length} check{points.length !== 1 ? "s" : ""}
          </span>
          <span className={`font-semibold ${deltaColor} flex items-center gap-0.5`}>
            <DeltaIcon className="h-3 w-3" />
            {delta > 0 ? "+" : ""}
            {delta} pts
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-muted-foreground">
          First: <span className="font-semibold text-foreground">{first.score}%</span>
          <Badge className={`${gradeColorClass(first.grade)} border-0 text-[9px] ml-1 px-1.5 py-0`}>
            {first.grade}
          </Badge>
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="text-muted-foreground">
          Latest: <span className={`font-semibold ${deltaColor}`}>{last.score}%</span>
          <Badge className={`${gradeColorClass(last.grade)} border-0 text-[9px] ml-1 px-1.5 py-0`}>
            {last.grade}
          </Badge>
        </span>
      </div>

      <div className="w-full" style={{ minHeight: h }}>
        <svg
          width="100%"
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          className="overflow-visible"
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                x1={pad.left}
                y1={toY(v)}
                x2={pad.left + chartW}
                y2={toY(v)}
                stroke="currentColor"
                strokeOpacity={0.08}
                strokeDasharray="2 2"
              />
              <text
                x={pad.left - 6}
                y={toY(v) + 4}
                textAnchor="end"
                className="text-[9px] fill-muted-foreground"
                fontSize={9}
              >
                {v}
              </text>
            </g>
          ))}

          {points.length > 0 && (
            <>
              <text
                x={pad.left}
                y={h - 6}
                textAnchor="start"
                className="text-[9px] fill-muted-foreground"
                fontSize={9}
              >
                {new Date(points[0].date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </text>
              {points.length > 2 && (
                <text
                  x={pad.left + chartW / 2}
                  y={h - 6}
                  textAnchor="middle"
                  className="text-[9px] fill-muted-foreground"
                  fontSize={9}
                >
                  {new Date(points[Math.floor(points.length / 2)].date).toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "short" },
                  )}
                </text>
              )}
              {points.length > 1 && (
                <text
                  x={pad.left + chartW}
                  y={h - 6}
                  textAnchor="end"
                  className="text-[9px] fill-muted-foreground"
                  fontSize={9}
                >
                  {new Date(points[points.length - 1].date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </text>
              )}
            </>
          )}

          <path
            d={pathD}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p, i) => {
            const x = toX(i);
            const y = toY(p.score);
            const isHovered = hoveredIdx === i;
            const color = GRADE_COLORS[p.grade as Grade] ?? GRADE_COLORS.C;

            return (
              <g key={p.id + "-" + i}>
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 7 : 4}
                  fill={color}
                  fillOpacity={0.85}
                  stroke={color}
                  strokeWidth={isHovered ? 2 : 1}
                  className="transition-all cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
                {isHovered && (
                  <g>
                    <rect
                      x={x - 50}
                      y={y - 40}
                      width={100}
                      height={32}
                      rx={6}
                      className="fill-card stroke-border"
                      strokeWidth={1}
                    />
                    <text
                      x={x}
                      y={y - 24}
                      textAnchor="middle"
                      className="text-[9px] fill-muted-foreground"
                      fontSize={9}
                    >
                      {new Date(p.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </text>
                    <text
                      x={x}
                      y={y - 13}
                      textAnchor="middle"
                      className="text-[10px] font-bold fill-foreground"
                      fontSize={10}
                    >
                      {p.score}% — Grade {p.grade}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="px-2 py-1.5 text-left">Date</th>
              <th className="px-2 py-1.5 text-left">Score</th>
              <th className="px-2 py-1.5 text-left">Grade</th>
              <th className="px-2 py-1.5 text-left">Delta</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => {
              const prev = i > 0 ? points[i - 1].score : null;
              const d = prev !== null ? p.score - prev : null;
              return (
                <tr key={p.id + "-row-" + i} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                    {new Date(p.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-2 py-1.5 font-mono">{p.score}%</td>
                  <td className="px-2 py-1.5">
                    <Badge
                      className={`${gradeColorClass(p.grade)} border-0 text-[9px] px-1.5 py-0`}
                    >
                      {p.grade}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 font-mono">
                    {d === null ? (
                      "—"
                    ) : (
                      <span
                        className={
                          d > 0
                            ? "text-[#007A5A] dark:text-[#00F2B3]"
                            : d < 0
                              ? "text-[#EA0022]"
                              : "text-muted-foreground"
                        }
                      >
                        {d > 0 ? "+" : ""}
                        {d}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const SEScoreTrendChart = memo(SEScoreTrendChartInner);
