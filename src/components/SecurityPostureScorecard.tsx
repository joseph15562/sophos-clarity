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
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#2006F7]/10 dark:bg-[#2006F7]/20 flex items-center justify-center">
              <Shield className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
            </div>
            <CardTitle className="text-base font-display font-bold">Security Posture Scorecard</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${overallStyle.bgColor}`}>
              <OverallIcon className={`h-3.5 w-3.5 ${overallStyle.color}`} />
              <span className={`text-xs font-bold ${overallStyle.color}`}>{overallPosture}</span>
            </div>
            <span className={`text-2xl font-extrabold ${gradeColor}`}>{overall}</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Deterministic assessment based on extracted configuration evidence. Not a formal audit.
        </p>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {/* Summary badges */}
        <div className="flex gap-2 mb-3">
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
            <div key={cat.label} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
              <div className={`h-7 w-7 rounded-md ${cat.bgColor} flex items-center justify-center shrink-0`}>
                <Icon className={`h-3.5 w-3.5 ${cat.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{cat.label}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cat.bgColor} ${cat.color}`}>
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
