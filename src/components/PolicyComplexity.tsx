"use client";

import { useId, useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";

type ExtractedSection = {
  tables: Array<{ headers: string[]; rows: Record<string, string>[] }>;
  text: string;
  details: unknown[];
};

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  files: Array<{
    extractedData: Record<string, ExtractedSection>;
  }>;
}

const GREEN = "#00F2B3";
const AMBER = "#F29400";
const RED = "#EA0022";

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startDeg));
  const y1 = cy + r * Math.sin(rad(startDeg));
  const x2 = cx + r * Math.cos(rad(endDeg));
  const y2 = cy + r * Math.sin(rad(endDeg));
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

export function PolicyComplexity({ analysisResults, files: _files }: Props) {
  const glowFilterId = useId().replace(/:/g, "");

  const { score, label, recommendations } = useMemo(() => {
    const results = Object.values(analysisResults);
    if (results.length === 0) {
      return { score: 0, label: "Low" as const, recommendations: [] as string[] };
    }

    const ar = results[0];
    const stats = ar?.stats ?? { totalRules: 0 };
    const ip = ar?.inspectionPosture ?? { totalWanRules: 0, totalDisabledRules: 0 };
    const findings = ar?.findings ?? [];

    let raw = 0;
    const recs: string[] = [];

    // totalRules > 50: +20, > 100: +30
    if (stats.totalRules > 100) {
      raw += 30;
      recs.push(`Reduce rule count (${stats.totalRules} rules — consider consolidation)`);
    } else if (stats.totalRules > 50) {
      raw += 20;
      recs.push(`Consider consolidating rules (${stats.totalRules} total)`);
    }

    // totalDisabledRules / totalWanRules > 0.2: +15
    const wanTotal = ip.totalWanRules || 1;
    const disabledRatio = ip.totalDisabledRules / wanTotal;
    if (disabledRatio > 0.2) {
      raw += 15;
      recs.push(`Remove ${ip.totalDisabledRules} disabled rules`);
    }

    // Count findings matching "ANY" service: +10 per finding (max 20)
    const anyFindings = findings.filter(
      (f) => /ANY|any service/i.test(f.title) || /using "ANY" service/i.test(f.title),
    );
    const anyCount = Math.min(anyFindings.length * 10, 20);
    if (anyCount > 0) {
      raw += anyCount;
      const n = anyFindings.length;
      recs.push(`Replace ANY service with specific services (${n} rule${n > 1 ? "s" : ""})`);
    }

    // Count findings matching "overlapping": +10
    const overlapFindings = findings.filter(
      (f) => /overlapping/i.test(f.title) || /overlapping/i.test(f.detail),
    );
    if (overlapFindings.length > 0) {
      raw += 10;
      const n = overlapFindings[0].title.match(/\d+/)?.[0] ?? overlapFindings.length;
      recs.push(`Consolidate ${n} overlapping rules to reduce complexity`);
    }

    // Count findings matching "broad source": +10
    const broadFindings = findings.filter(
      (f) => /broad source/i.test(f.title) || /broad source/i.test(f.detail),
    );
    if (broadFindings.length > 0) {
      raw += 10;
      recs.push("Replace broad source/destination with specific objects");
    }

    // Normalize to 0-100, higher = more complex
    const score = Math.min(100, Math.round(raw * 1.2));
    const label =
      score < 40 ? ("Low" as const) : score <= 70 ? ("Moderate" as const) : ("High" as const);

    return {
      score,
      label,
      recommendations: recs.slice(0, 3),
    };
  }, [analysisResults]);

  const color = score < 40 ? GREEN : score <= 70 ? AMBER : RED;
  const size = 140;
  const cx = size / 2;
  const cy = size * 0.55;
  const r = size * 0.38;
  const strokeWidth = size * 0.06;
  const startAngle = 180;
  const endAngle = 360;
  const filledEndAngle = 180 + (score / 100) * 180;
  const trackPath = arcPath(cx, cy, r, startAngle, endAngle);
  const filledPath = arcPath(cx, cy, r, startAngle, filledEndAngle);

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.12] dark:border-white/[0.08] p-5 sm:p-6 shadow-card backdrop-blur-sm transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(0,242,179,0.06), rgba(242,148,0,0.03), rgba(255,255,255,0.02))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,242,179,0.3), rgba(242,148,0,0.15), transparent)",
        }}
      />
      <h3 className="relative text-lg font-display font-black tracking-tight text-foreground mb-5">
        Policy Complexity
      </h3>

      <div className="flex flex-col items-center gap-5">
        <div
          className="rounded-2xl px-4 py-3 backdrop-blur-sm w-full max-w-[200px]"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 40px rgba(0,0,0,0.2)",
          }}
        >
          <svg
            width={size}
            height={size * 0.6}
            viewBox={`0 0 ${size} ${size * 0.6}`}
            className="overflow-visible mx-auto block"
          >
            <defs>
              <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              d={trackPath}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <path
              d={filledPath}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              filter={`url(#${glowFilterId})`}
            />
            <text
              x={cx}
              y={cy - 10}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground text-2xl font-display font-black"
            >
              {score}
            </text>
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground/50 text-xs font-display font-bold"
            >
              {label}
            </text>
          </svg>
        </div>

        {recommendations.length > 0 && (
          <ul className="w-full space-y-2">
            {recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground/70 border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm transition-colors hover:bg-slate-950/[0.04] dark:hover:bg-white/[0.03]"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(242,148,0,0.08), rgba(255,255,255,0.02))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: AMBER,
                    boxShadow: `0 0 10px ${AMBER}99`,
                  }}
                />
                <span className="leading-snug">{rec}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
