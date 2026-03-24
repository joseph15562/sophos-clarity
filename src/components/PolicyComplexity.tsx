"use client";

import { useMemo } from "react";
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

export function PolicyComplexity({ analysisResults, files }: Props) {
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
      (f) =>
        /ANY|any service/i.test(f.title) ||
        /using "ANY" service/i.test(f.title)
    );
    const anyCount = Math.min(anyFindings.length * 10, 20);
    if (anyCount > 0) {
      raw += anyCount;
      const n = anyFindings.length;
      recs.push(`Replace ANY service with specific services (${n} rule${n > 1 ? "s" : ""})`);
    }

    // Count findings matching "overlapping": +10
    const overlapFindings = findings.filter((f) =>
      /overlapping/i.test(f.title) || /overlapping/i.test(f.detail)
    );
    if (overlapFindings.length > 0) {
      raw += 10;
      const n = overlapFindings[0].title.match(/\d+/)?.[0] ?? overlapFindings.length;
      recs.push(`Consolidate ${n} overlapping rules to reduce complexity`);
    }

    // Count findings matching "broad source": +10
    const broadFindings = findings.filter((f) =>
      /broad source/i.test(f.title) || /broad source/i.test(f.detail)
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
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">Policy Complexity</h3>

      <div className="flex flex-col items-center gap-4">
        <svg
          width={size}
          height={size * 0.6}
          viewBox={`0 0 ${size} ${size * 0.6}`}
          className="overflow-visible"
        >
          <path
            d={trackPath}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={filledPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-lg font-bold"
          >
            {score}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[10px] font-medium"
          >
            {label}
          </text>
        </svg>

        {recommendations.length > 0 && (
          <ul className="w-full space-y-1.5 text-[10px] text-muted-foreground">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
