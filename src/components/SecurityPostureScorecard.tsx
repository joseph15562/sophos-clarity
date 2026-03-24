import { useMemo, useState } from "react";
import { Shield, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
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
}

function toPosture(pct: number, details: string): PostureLabel {
  if (details.toLowerCase().includes("no enabled") || details.toLowerCase().includes("no management"))
    if (pct === 100) return "Good";
  if (pct >= 80) return "Good";
  if (pct >= 50) return "Needs Review";
  return "High Risk";
}

function postureStyle(p: PostureLabel): { icon: typeof CheckCircle2; color: string; bgColor: string } {
  switch (p) {
    case "Good":
      return { icon: CheckCircle2, color: "text-[#00774a] dark:text-[#00F2B3]", bgColor: "bg-[#00F2B3]/10" };
    case "Needs Review":
      return { icon: AlertTriangle, color: "text-[#b8a200] dark:text-[#F8E300]", bgColor: "bg-[#F8E300]/10" };
    case "High Risk":
      return { icon: XCircle, color: "text-[#EA0022]", bgColor: "bg-[#EA0022]/10" };
    case "Insufficient Data":
      return { icon: MinusCircle, color: "text-muted-foreground", bgColor: "bg-muted/20" };
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
    if (labels.length === 0) return { categories: [], overall: 0, grade: "F" as const, postureSummary: { good: 0, review: 0, risk: 0 } };

    let merged: RiskScoreResult;
    if (labels.length === 1) {
      merged = computeRiskScore(analysisResults[labels[0]]);
    } else {
      const allCats: CategoryScore[][] = labels.map((l) => computeRiskScore(analysisResults[l]).categories);
      const avgCats: CategoryScore[] = allCats[0].map((cat, idx) => {
        const avgPct = Math.round(allCats.reduce((s, c) => s + c[idx].pct, 0) / allCats.length);
        const details = labels.length > 1
          ? allCats.map((c, fi) => `${labels[fi]}: ${c[idx].pct}%`).join(" · ")
          : cat.details;
        return { ...cat, pct: avgPct, score: avgPct, details };
      });
      const avgOverall = Math.round(avgCats.reduce((s, c) => s + c.pct, 0) / avgCats.length);
      const g: RiskScoreResult["grade"] =
        avgOverall >= 90 ? "A" : avgOverall >= 75 ? "B" : avgOverall >= 60 ? "C" : avgOverall >= 40 ? "D" : "F";
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

  const gradeColor =
    grade === "A" || grade === "B" ? "text-[#00774a] dark:text-[#00F2B3]"
    : grade === "C" ? "text-[#b8a200] dark:text-[#F8E300]"
    : grade === "D" ? "text-[#c47800] dark:text-[#F29400]"
    : "text-[#EA0022]";

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
              <CardTitle className="text-lg font-display font-black tracking-tight">Security Posture Scorecard</CardTitle>
            </div>
            <p className="text-[11px] text-muted-foreground max-w-2xl leading-relaxed">
              Deterministic assessment based on extracted firewall evidence to support MSP reviews, customer conversations, and SE-led validation.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-transparent ${overallStyle.bgColor}`}>
              <OverallIcon className={`h-3.5 w-3.5 ${overallStyle.color}`} />
              <span className={`text-xs font-bold ${overallStyle.color}`}>{overallPosture}</span>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-black leading-none ${gradeColor}`}>{overall}</div>
              <div className="text-[10px] font-medium text-muted-foreground">Grade {grade}</div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Score intent</p>
            <p className="text-sm font-semibold text-foreground mt-1">Summarise overall control health in one executive view</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Best for</p>
            <p className="text-sm font-semibold text-foreground mt-1">Board-ready reviews, service reporting, and technical triage</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Trust note</p>
            <p className="text-sm font-semibold text-foreground mt-1">Evidence-led scoring, not a black-box AI rating</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 mb-1">
          {postureSummary.good > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00F2B3]/10 text-[#00774a] dark:text-[#00F2B3] font-medium">
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
          return (
            <div key={cat.label} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 px-3.5 py-3 shadow-card">
              <div className={`h-8 w-8 rounded-xl ${cat.bgColor} flex items-center justify-center shrink-0 border border-transparent`}>
                <Icon className={`h-3.5 w-3.5 ${cat.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{cat.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-transparent ${cat.bgColor} ${cat.color}`}>
                    {cat.posture}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{cat.details}</p>
              </div>
              {/* Score bar */}
              <div className="w-16 shrink-0">
                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${cat.score}%`,
                      backgroundColor: cat.posture === "Good" ? "#00F2B3" : cat.posture === "Needs Review" ? "#F8E300" : "#EA0022",
                    }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground mt-0.5 block text-right">{cat.score}%</span>
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
