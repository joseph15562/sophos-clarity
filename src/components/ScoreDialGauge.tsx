"use client";

import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";

interface ScoreDialGaugeProps {
  analysisResults: Record<string, AnalysisResult>;
}

const RED = "#EA0022";
const AMBER = "#F29400";
const GREEN = "#00995a";
const GREEN_DARK = "#00F2B3";

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startDeg));
  const y1 = cy + r * Math.sin(rad(startDeg));
  const x2 = cx + r * Math.cos(rad(endDeg));
  const y2 = cy + r * Math.sin(rad(endDeg));
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

function scoreToAngle(score: number): number {
  const start = 150;
  const sweep = 240;
  return start + (score / 100) * sweep;
}

function scoreToColor(score: number): string {
  if (score <= 40) return RED;
  if (score <= 75) return AMBER;
  return GREEN;
}

function GaugeSvg({
  score,
  size,
  showLabels,
  label,
}: {
  score: number;
  size: number;
  showLabels?: boolean;
  label?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeWidth = size * 0.06;
  const needleLength = r - strokeWidth * 2;

  const startAngle = 150;
  const endAngle = 390;
  const filledEndAngle = scoreToAngle(score);
  const needleAngle = filledEndAngle;

  const trackPath = arcPath(cx, cy, r, startAngle, endAngle);
  const filledPath = arcPath(cx, cy, r, startAngle, filledEndAngle);

  const fillColor = scoreToColor(score);
  const isGreen = score > 75;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="overflow-visible"
    >
      {/* Track */}
      <path
        d={trackPath}
        fill="none"
        stroke="rgb(229 231 235)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Filled arc */}
      <path
        d={filledPath}
        fill="none"
        stroke={fillColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className={isGreen ? "dark:!stroke-[#00F2B3]" : ""}
      />
      {/* Needle - line points right (0°), inner group rotates to needleAngle */}
      <g transform={`translate(${cx}, ${cy})`}>
        <g
          className="gauge-needle"
          style={{
            transformOrigin: "0 0",
            ["--needle-end" as string]: `${needleAngle}deg`,
            animation: "gaugeNeedleSweep 0.6s ease-out forwards",
          }}
        >
          <line
            x1={0}
            y1={0}
            x2={needleLength}
            y2={0}
            stroke="rgb(55 65 81)"
            strokeWidth={size * 0.012}
            strokeLinecap="round"
          />
        </g>
      </g>
      {/* Needle cap */}
      <circle cx={cx} cy={cy} r={size * 0.02} fill="rgb(55 65 81)" />
      {/* Centre content */}
      {showLabels && (
        <g>
          <text
            x={cx}
            y={cy - size * 0.02}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-[10px] font-bold"
            style={{ fontSize: size * 0.12 }}
          >
            {label ?? "—"}
          </text>
          <text
            x={cx}
            y={cy + size * 0.08}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[10px] font-medium"
            style={{ fontSize: size * 0.06 }}
          >
            {score}
          </text>
        </g>
      )}
    </svg>
  );
}

export function ScoreDialGauge({ analysisResults }: ScoreDialGaugeProps) {
  const scores = useMemo(() => {
    const entries = Object.entries(analysisResults);
    if (entries.length === 0) return { aggregate: null, perFirewall: [] };

    const perFirewall = entries.map(([key, result]) => {
      const { overall, grade } = computeRiskScore(result);
      const name = result.hostname ?? result.stats?.sectionNames?.[0] ?? key;
      return { key, name, score: overall, grade };
    });

    const aggregate =
      perFirewall.length === 1
        ? perFirewall[0]
        : {
            score: Math.round(
              perFirewall.reduce((s, p) => s + p.score, 0) / perFirewall.length
            ),
            grade: (() => {
              const avg =
                perFirewall.reduce((s, p) => s + p.score, 0) / perFirewall.length;
              return avg >= 90 ? "A" : avg >= 75 ? "B" : avg >= 60 ? "C" : avg >= 40 ? "D" : "F";
            })(),
          };

    return { aggregate, perFirewall };
  }, [analysisResults]);

  if (!scores.aggregate) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Security Score</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          No analysis results to display.
        </p>
      </div>
    );
  }

  const isSingle = scores.perFirewall.length === 1;
  const aggScore = "score" in scores.aggregate ? scores.aggregate.score : 0;
  const aggGrade = "grade" in scores.aggregate ? scores.aggregate.grade : "—";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Security Score</h3>

      <div className="flex flex-col items-center gap-6">
        {/* Main gauge */}
        <div className="relative flex items-center justify-center">
          <div
            className="gauge-needle-mount"
            style={{
              animation: "gaugeNeedleMount 0.6s ease-out forwards",
            }}
          >
            <GaugeSvg
              score={aggScore}
              size={220}
              showLabels
              label={aggGrade}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Your firewall scores {aggScore}/100 (Grade {aggGrade})
        </p>

        {/* Mini gauges for multiple firewalls */}
        {!isSingle && scores.perFirewall.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4 pt-2 border-t border-border w-full">
            {scores.perFirewall.map(({ key, name, score, grade }) => (
              <div
                key={key}
                className="flex flex-col items-center gap-1"
              >
                <GaugeSvg score={score} size={80} showLabels label={grade} />
                <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[80px]">
                  {name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes gaugeNeedleMount {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes gaugeNeedleSweep {
          from { transform: rotate(150deg); }
          to { transform: rotate(var(--needle-end, 150deg)); }
        }
      `}</style>
    </div>
  );
}
