"use client";

import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { scoreToColor } from "@/lib/design-tokens";

interface ScoreDialGaugeProps {
  analysisResults: Record<string, AnalysisResult>;
}

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
  const strokeWidth = size * 0.065;
  const needleLength = r - strokeWidth * 1.5;

  const startAngle = 150;
  const endAngle = 390;
  const filledEndAngle = scoreToAngle(score);
  const needleAngle = filledEndAngle;

  const trackPath = arcPath(cx, cy, r, startAngle, endAngle);
  const filledPath = arcPath(cx, cy, r, startAngle, filledEndAngle);

  const fillColor = scoreToColor(score);
  const gaugeId = `gauge-${size}-${Math.round(score)}`;
  const trackColor = "hsl(213 27% 86%)";
  const trackColorDark = "hsl(215 40% 22%)";
  const needleColor = "hsl(215 52% 25%)";
  const needleColorDark = "hsl(210 20% 65%)";
  const textColor = "hsl(215 52% 14%)";
  const textColorDark = "hsl(0 0% 96%)";
  const subtextColor = "hsl(210 25% 50%)";
  const subtextColorDark = "hsl(210 20% 65%)";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={`${gaugeId}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={fillColor} stopOpacity={0.8} />
          <stop offset="100%" stopColor={fillColor} />
        </linearGradient>
        <filter id={`${gaugeId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={size * 0.02} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Track background */}
      <path
        d={trackPath}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="dark:hidden"
      />
      <path
        d={trackPath}
        fill="none"
        stroke={trackColorDark}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="hidden dark:block"
      />

      {/* Tick marks around the arc */}
      {Array.from({ length: 11 }, (_, i) => {
        const tickAngle = startAngle + (i / 10) * (endAngle - startAngle);
        const rad = (tickAngle * Math.PI) / 180;
        const isMajor = i % 5 === 0;
        const outerR = r + strokeWidth * 0.8;
        const innerR = r + strokeWidth * (isMajor ? 1.6 : 1.2);
        return (
          <line
            key={i}
            x1={cx + outerR * Math.cos(rad)}
            y1={cy + outerR * Math.sin(rad)}
            x2={cx + innerR * Math.cos(rad)}
            y2={cy + innerR * Math.sin(rad)}
            stroke={fillColor}
            strokeWidth={isMajor ? 1.5 : 0.8}
            opacity={isMajor ? 0.4 : 0.2}
            strokeLinecap="round"
          />
        );
      })}

      {/* Glow layer behind filled arc */}
      <path
        d={filledPath}
        fill="none"
        stroke={fillColor}
        strokeWidth={strokeWidth * 2.2}
        strokeLinecap="round"
        opacity={0.15}
        filter={`url(#${gaugeId}-glow)`}
      />

      {/* Filled arc */}
      <path
        d={filledPath}
        fill="none"
        stroke={`url(#${gaugeId}-grad)`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Needle */}
      <g transform={`translate(${cx}, ${cy})`}>
        <g
          className="gauge-needle"
          style={{
            transformOrigin: "0 0",
            ["--needle-end" as string]: `${needleAngle}deg`,
            animation: "gaugeNeedleSweep 0.6s ease-out forwards",
          }}
        >
          {/* Light mode needle */}
          <line x1={0} y1={0} x2={needleLength} y2={0}
            stroke={needleColor} strokeWidth={size * 0.02} strokeLinecap="round"
            className="dark:hidden" />
          {/* Dark mode needle */}
          <line x1={0} y1={0} x2={needleLength} y2={0}
            stroke={needleColorDark} strokeWidth={size * 0.02} strokeLinecap="round"
            className="hidden dark:block" />
        </g>
      </g>

      {/* Needle cap outer ring */}
      <circle cx={cx} cy={cy} r={size * 0.04}
        fill="none" stroke={fillColor} strokeWidth={size * 0.008} opacity={0.3} />
      {/* Needle cap */}
      <circle cx={cx} cy={cy} r={size * 0.028}
        fill={needleColor} className="dark:hidden" />
      <circle cx={cx} cy={cy} r={size * 0.028}
        fill={needleColorDark} className="hidden dark:block" />

      {/* Centre content */}
      {showLabels && (
        <g>
          {/* Grade letter — colored to match the arc */}
          <text
            x={cx}
            y={cy - size * 0.04}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={fillColor}
            style={{ fontSize: size * 0.18, fontWeight: 900, fontFamily: "'Zalando Sans Expanded', 'Zalando Sans', system-ui, sans-serif", letterSpacing: "-0.02em" }}
          >
            {label ?? "—"}
          </text>
          {/* Score number */}
          <text
            x={cx}
            y={cy + size * 0.1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={subtextColor}
            style={{ fontSize: size * 0.07, fontWeight: 700, fontFamily: "'Zalando Sans', system-ui, sans-serif" }}
            className="dark:hidden"
          >
            {score}
          </text>
          <text
            x={cx}
            y={cy + size * 0.1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={subtextColorDark}
            style={{ fontSize: size * 0.07, fontWeight: 700, fontFamily: "'Zalando Sans', system-ui, sans-serif" }}
            className="hidden dark:block"
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
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">Security Score</h3>
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
    <div className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] p-6 sm:p-8 shadow-[0_18px_50px_rgba(32,6,247,0.08)] space-y-5">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-accent">
          Security score
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-xl font-display font-black text-foreground tracking-tight">Executive Security Score</h3>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed mt-1">A clear, client-ready posture signal for MSP reviews and SE-led assessment walkthroughs.</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card shadow-card px-5 py-4 text-right">
            <p className="text-[9px] font-display font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">Current posture</p>
            <p className="text-4xl font-display font-black tracking-tight tabular-nums mt-1.5" style={{ color: scoreToColor(aggScore) }}>{aggScore}<span className="text-lg font-semibold text-muted-foreground">/100</span></p>
            <p className="text-[11px] font-display font-semibold mt-1" style={{ color: scoreToColor(aggScore) }}>Grade {aggGrade}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-6 sm:p-8">
      <div className="flex flex-col items-center gap-6">
        {/* Main gauge */}
        <div className="relative flex items-center justify-center" data-tour="score-dial">
          <div
            className="gauge-needle-mount"
            style={{
              animation: "gaugeNeedleMount 0.6s ease-out forwards",
            }}
          >
            <GaugeSvg
              score={aggScore}
              size={240}
              showLabels
              label={aggGrade}
            />
          </div>
        </div>

        <p className="text-[13px] font-display font-medium text-muted-foreground/70 text-center">
          Your firewall scores <span className="font-bold text-foreground">{aggScore}/100</span> <span className="text-foreground/60">(Grade {aggGrade})</span>
        </p>

        {/* Mini gauges for multiple firewalls */}
        {!isSingle && scores.perFirewall.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4 pt-5 border-t border-border/40 w-full">
            {scores.perFirewall.map(({ key, name, score, grade }) => (
              <div
                key={key}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/40 bg-muted/10 dark:bg-muted/5 px-4 py-3 shadow-sm"
              >
                <GaugeSvg score={score} size={80} showLabels label={grade} />
                <span className="text-[10px] font-display font-medium text-muted-foreground/70 truncate max-w-[80px]">
                  {name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
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
