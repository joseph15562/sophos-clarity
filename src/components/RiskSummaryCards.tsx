import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  AlertTriangle,
  Eye,
  Layers,
  Server,
  FileSearch,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  previousScore?: number | null;
}

type ColorScheme = "green" | "amber" | "red" | "neutral";

const COLOR_CLASSES: Record<ColorScheme, { text: string; border: string; bg: string }> = {
  green: {
    text: "text-[#00995a] dark:text-[#00F2B3]",
    border: "border-[#00995a]/20",
    bg: "bg-[#00995a]/[0.04]",
  },
  amber: {
    text: "text-[#F29400]",
    border: "border-[#F29400]/20",
    bg: "bg-[#F29400]/[0.04]",
  },
  red: {
    text: "text-[#EA0022]",
    border: "border-[#EA0022]/20",
    bg: "bg-[#EA0022]/[0.04]",
  },
  neutral: {
    text: "text-foreground",
    border: "border-border",
    bg: "bg-card",
  },
};

function scoreColor(score: number): ColorScheme {
  if (score >= 75) return "green";
  if (score >= 50) return "amber";
  return "red";
}

export function RiskSummaryCards({ analysisResults, previousScore }: Props) {
  const stats = useMemo(() => {
    const entries = Object.values(analysisResults);
    if (entries.length === 0) {
      return {
        overallScore: 0,
        grade: "F" as const,
        criticalFindings: 0,
        highFindings: 0,
        coverage: 0,
        totalRules: 0,
        populatedSections: 0,
        totalSections: 0,
      };
    }

    // Aggregate findings across all firewalls
    const allFindings = entries.flatMap((e) => e.findings);
    const criticalFindings = allFindings.filter((f) => f.severity === "critical").length;
    const highFindings = allFindings.filter((f) => f.severity === "high").length;

    // Aggregate inspection posture for coverage
    let sumWebFilter = 0;
    let sumIps = 0;
    let sumAppControl = 0;
    let sumWebFilterableRules = 0;
    let totalRules = 0;
    let populatedSections = 0;
    let totalSections = 0;

    for (const ar of entries) {
      const ip = ar.inspectionPosture;
      const s = ar.stats;
      sumWebFilter += ip.withWebFilter;
      sumIps += ip.withIps;
      sumAppControl += ip.withAppControl;
      sumWebFilterableRules += ip.webFilterableRules;
      totalRules += s.totalRules;
      populatedSections += s.populatedSections;
      totalSections += s.totalSections;
    }

    const denom = sumWebFilterableRules * 3;
    const coverage = denom > 0
      ? Math.round(((sumWebFilter + sumIps + sumAppControl) / denom) * 100)
      : 0;

    // Overall score: average across firewalls (like PeerBenchmark)
    const scores = entries.map((e) => computeRiskScore(e));
    const overallScore = Math.round(
      scores.reduce((sum, s) => sum + s.overall, 0) / scores.length
    );
    const grade =
      overallScore >= 90 ? "A"
      : overallScore >= 75 ? "B"
      : overallScore >= 60 ? "C"
      : overallScore >= 40 ? "D"
      : "F";

    return {
      overallScore,
      grade,
      criticalFindings,
      highFindings,
      coverage,
      totalRules,
      populatedSections,
      totalSections,
    };
  }, [analysisResults]);

  const scoreScheme = scoreColor(stats.overallScore);
  const criticalScheme = stats.criticalFindings > 0 ? "red" : "green";
  const highScheme = stats.highFindings > 0 ? "amber" : "green";
  const coverageScheme = scoreColor(stats.coverage);

  const trendIcon =
    previousScore != null ? (
      stats.overallScore > previousScore ? (
        <TrendingUp className="h-3.5 w-3.5 text-[#00995a] dark:text-[#00F2B3]" />
      ) : stats.overallScore < previousScore ? (
        <TrendingDown className="h-3.5 w-3.5 text-[#EA0022]" />
      ) : (
        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
      )
    ) : null;

  const cards = [
    {
      label: "Overall Score",
      value: `${stats.overallScore}`,
      badge: stats.grade,
      scheme: scoreScheme,
      icon: Shield,
      trend: trendIcon,
    },
    {
      label: "Critical Findings",
      value: String(stats.criticalFindings),
      scheme: criticalScheme,
      icon: AlertTriangle,
    },
    {
      label: "High Findings",
      value: String(stats.highFindings),
      scheme: highScheme,
      icon: AlertTriangle,
    },
    {
      label: "Coverage",
      value: `${stats.coverage}%`,
      scheme: coverageScheme,
      icon: Eye,
    },
    {
      label: "Rules Analysed",
      value: String(stats.totalRules),
      scheme: "neutral" as ColorScheme,
      icon: Layers,
    },
    {
      label: "Sections Parsed",
      value: `${stats.populatedSections}/${stats.totalSections}`,
      scheme: "neutral" as ColorScheme,
      icon: FileSearch,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const c = COLOR_CLASSES[card.scheme];
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`rounded-xl border bg-card p-3 ${c.border} ${c.bg}`}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <Icon className={`h-3.5 w-3.5 shrink-0 ${c.text}`} />
              {card.trend}
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {card.label}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-xl font-extrabold tabular-nums ${c.text}`}>
                {card.value}
              </span>
              {card.badge != null && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.text} ${c.bg} border ${c.border}`}
                >
                  {card.badge}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
