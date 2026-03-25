import { useMemo, useState } from "react";
import {
  Shield,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore, type CategoryScore, type RiskScoreResult } from "@/lib/risk-score";

type PostureLabel = "Good" | "Needs Review" | "High Risk" | "Insufficient Data";

interface ScorecardCategory {
  label: string;
  posture: PostureLabel;
  score: number;
  details: string;
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  hex: string;
}

function toPosture(pct: number, details: string): PostureLabel {
  if (
    details.toLowerCase().includes("no enabled") ||
    details.toLowerCase().includes("no management")
  )
    if (pct === 100) return "Good";
  if (pct >= 80) return "Good";
  if (pct >= 50) return "Needs Review";
  return "High Risk";
}

function postureStyle(p: PostureLabel): {
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  hex: string;
} {
  switch (p) {
    case "Good":
      return {
        icon: CheckCircle2,
        color: "text-[#00774a] dark:text-[#00F2B3]",
        bgColor: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10",
        hex: "#00F2B3",
      };
    case "Needs Review":
      return {
        icon: AlertTriangle,
        color: "text-[#b8a200] dark:text-[#F8E300]",
        bgColor: "bg-[#F8E300]/10",
        hex: "#F8E300",
      };
    case "High Risk":
      return { icon: XCircle, color: "text-[#EA0022]", bgColor: "bg-[#EA0022]/10", hex: "#EA0022" };
    case "Insufficient Data":
      return {
        icon: MinusCircle,
        color: "text-muted-foreground",
        bgColor: "bg-muted/20",
        hex: "#888888",
      };
  }
}

function categoryToScorecard(cat: CategoryScore): ScorecardCategory {
  const posture = toPosture(cat.pct, cat.details);
  const style = postureStyle(posture);
  return { label: cat.label, posture, score: cat.pct, details: cat.details, ...style };
}

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

export function SecurityPostureScorecard({ analysisResults }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { categories, overall, grade, postureSummary } = useMemo(() => {
    const labels = Object.keys(analysisResults);
    if (labels.length === 0)
      return {
        categories: [],
        overall: 0,
        grade: "F" as const,
        postureSummary: { good: 0, review: 0, risk: 0 },
      };

    let merged: RiskScoreResult;
    if (labels.length === 1) {
      merged = computeRiskScore(analysisResults[labels[0]]);
    } else {
      const allCats: CategoryScore[][] = labels.map(
        (l) => computeRiskScore(analysisResults[l]).categories,
      );
      const avgCats: CategoryScore[] = allCats[0].map((cat, idx) => {
        const avgPct = Math.round(allCats.reduce((s, c) => s + c[idx].pct, 0) / allCats.length);
        const details =
          labels.length > 1
            ? allCats.map((c, fi) => `${labels[fi]}: ${c[idx].pct}%`).join(" · ")
            : cat.details;
        return { ...cat, pct: avgPct, score: avgPct, details };
      });
      const avgOverall = Math.round(avgCats.reduce((s, c) => s + c.pct, 0) / avgCats.length);
      const g: RiskScoreResult["grade"] =
        avgOverall >= 90
          ? "A"
          : avgOverall >= 75
            ? "B"
            : avgOverall >= 60
              ? "C"
              : avgOverall >= 40
                ? "D"
                : "F";
      merged = { overall: avgOverall, grade: g, categories: avgCats };
    }

    const cats = merged.categories.map(categoryToScorecard);
    const postureSummary = {
      good: cats.filter((c) => c.posture === "Good").length,
      review: cats.filter((c) => c.posture === "Needs Review").length,
      risk: cats.filter((c) => c.posture === "High Risk").length,
    };
    return { categories: cats, overall: merged.overall, grade: merged.grade, postureSummary };
  }, [analysisResults]);

  if (categories.length === 0) return null;

  const overallPosture = toPosture(overall, "");
  const overallStyle = postureStyle(overallPosture);
  const OverallIcon = overallStyle.icon;

  const gradeHex =
    grade === "A" || grade === "B"
      ? "#00F2B3"
      : grade === "C"
        ? "#F8E300"
        : grade === "D"
          ? "#F29400"
          : "#EA0022";

  const visibleCats = expanded ? categories : categories.slice(0, 4);

  return (
    <Card className="border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] shadow-[0_18px_50px_rgba(32,6,247,0.08)] overflow-hidden">
      <CardHeader className="pb-3 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 min-w-[220px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
              Executive posture
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/20 flex items-center justify-center border border-brand-accent/15">
                <Shield className="h-4 w-4 text-brand-accent" />
              </div>
              <CardTitle className="text-lg font-display font-black tracking-tight">
                Security Posture Scorecard
              </CardTitle>
            </div>
            <p className="text-[11px] text-muted-foreground max-w-2xl leading-relaxed">
              Deterministic assessment based on extracted firewall evidence to support MSP reviews,
              customer conversations, and SE-led validation.
            </p>
          </div>
          <div
            className="relative overflow-hidden flex items-center gap-4 rounded-2xl border border-slate-900/[0.12] dark:border-white/[0.08] px-5 py-4 shadow-elevated transition-all duration-200 hover:scale-[1.02] hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
            style={{
              background: `linear-gradient(135deg, ${overallStyle.hex}14, ${overallStyle.hex}06)`,
            }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute -top-5 -right-5 h-16 w-16 rounded-full blur-[28px] opacity-25"
                style={{ backgroundColor: overallStyle.hex }}
              />
            </div>
            <div
              className="absolute inset-x-0 top-0 h-px pointer-events-none"
              style={{
                background: `linear-gradient(90deg, transparent, ${overallStyle.hex}28, transparent)`,
              }}
            />
            <div
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
              style={{
                backgroundColor: `${overallStyle.hex}14`,
                borderColor: `${overallStyle.hex}25`,
              }}
            >
              <OverallIcon className="h-3.5 w-3.5" style={{ color: overallStyle.hex }} />
              <span className="text-xs font-bold" style={{ color: overallStyle.hex }}>
                {overallPosture}
              </span>
            </div>
            <div className="relative text-right">
              <div
                className="text-4xl font-black leading-none tabular-nums"
                style={{ color: gradeHex }}
              >
                {overall}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground/80 tracking-wide mt-0.5">
                Grade {grade}
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Score intent
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              Summarise overall control health in one executive view
            </p>
          </div>
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Best for
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              Board-ready reviews, service reporting, and technical triage
            </p>
          </div>
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Trust note
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              Evidence-led scoring, not a black-box AI rating
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 mb-1">
          {postureSummary.good > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#00774a] dark:text-[#00F2B3] font-medium">
              {postureSummary.good} Good
            </span>
          )}
          {postureSummary.review > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300] font-medium">
              {postureSummary.review} Needs Review
            </span>
          )}
          {postureSummary.risk > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EA0022]/10 text-[#EA0022] font-medium">
              {postureSummary.risk} High Risk
            </span>
          )}
        </div>

        {/* Category rows */}
        {visibleCats.map((cat) => {
          const Icon = cat.icon;
          const hex = cat.hex;
          return (
            <div
              key={cat.label}
              className="relative overflow-hidden flex items-center gap-3.5 rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-3.5 shadow-card transition-all duration-200 hover:scale-[1.01] hover:shadow-elevated hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
              style={{ background: `linear-gradient(135deg, ${hex}10, ${hex}05)` }}
            >
              {/* Corner glow */}
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="absolute -top-4 -left-4 h-14 w-14 rounded-full blur-[24px] opacity-20"
                  style={{ backgroundColor: hex }}
                />
              </div>
              {/* Top accent line */}
              <div
                className="absolute inset-x-0 top-0 h-px pointer-events-none"
                style={{ background: `linear-gradient(90deg, transparent, ${hex}30, transparent)` }}
              />
              {/* Left severity edge */}
              <div
                className="absolute left-0 inset-y-2 w-[3px] rounded-full"
                style={{ backgroundColor: hex, opacity: 0.5 }}
              />

              <div
                className="relative h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border border-slate-900/[0.12] dark:border-white/[0.08]"
                style={{ background: `${hex}18` }}
              >
                <Icon className="h-4 w-4" style={{ color: hex }} />
              </div>
              <div className="relative flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground tracking-tight">
                    {cat.label}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                    style={{
                      color: hex,
                      backgroundColor: `${hex}14`,
                      borderColor: `${hex}25`,
                    }}
                  >
                    {cat.posture}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
                  {cat.details}
                </p>
              </div>
              {/* Score bar */}
              <div className="relative w-20 shrink-0">
                <div className="h-2 rounded-full bg-white/80 dark:bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${cat.score}%`,
                      background: `linear-gradient(90deg, ${hex}90, ${hex})`,
                      boxShadow: `0 0 8px ${hex}40`,
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-bold mt-1 block text-right tabular-nums"
                  style={{ color: hex }}
                >
                  {cat.score}%
                </span>
              </div>
            </div>
          );
        })}

        {categories.length > 4 && (
          <button
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 py-1.5"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Show less" : `Show all ${categories.length} categories`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
