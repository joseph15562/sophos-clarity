import { useState, useMemo } from "react";
import { ArrowRight, ChevronUp } from "lucide-react";
import { computeRiskScore } from "@/lib/risk-score";
import type { AnalysisResult, Finding, Severity } from "@/lib/analyse-config";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "text-green-600 dark:text-green-400";
    case "B":
      return "text-green-600/90 dark:text-green-400/90";
    case "C":
      return "text-yellow-600 dark:text-yellow-400";
    case "D":
      return "text-orange-600 dark:text-orange-400";
    case "F":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-foreground";
  }
}

export function WhatIfComparison({ analysisResults }: Props) {
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const { allFindings, firstResult } = useMemo(() => {
    const entries = Object.entries(analysisResults);
    if (entries.length === 0) return { allFindings: [], firstResult: null };
    const first = entries[0][1];
    const firstLabel = entries[0][0];
    const findings: Array<Finding & { fwLabel: string }> = first.findings.map((f) => ({
      ...f,
      fwLabel: firstLabel,
    }));
    findings.sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        a.title.localeCompare(b.title),
    );
    return { allFindings: findings, firstResult: first };
  }, [analysisResults]);

  const { currentScore, projectedScore } = useMemo(() => {
    if (!firstResult) return { currentScore: null, projectedScore: null };
    const current = computeRiskScore(firstResult);
    if (resolvedIds.size === 0) {
      return { currentScore: current, projectedScore: current };
    }
    const remainingFindings = firstResult.findings.filter((f) => !resolvedIds.has(f.id));
    const projected: AnalysisResult = {
      ...firstResult,
      findings: remainingFindings,
    };
    const projectedSc = computeRiskScore(projected);
    return { currentScore: current, projectedScore: projectedSc };
  }, [firstResult, resolvedIds]);

  const toggleResolved = (id: string) => {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!firstResult || allFindings.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          What-If Analysis
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">No findings to analyse</p>
      </div>
    );
  }

  const improved = currentScore && projectedScore && projectedScore.overall > currentScore.overall;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card" data-tour="what-if">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
        What-If Analysis
      </h3>
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="flex flex-col items-center rounded-lg border border-border bg-muted/30 px-6 py-4">
          <span className="text-xs font-medium text-muted-foreground">Current</span>
          <span className={`text-2xl font-bold ${gradeColor(currentScore!.grade)}`}>
            {currentScore!.overall}
          </span>
          <span className={`text-sm font-semibold ${gradeColor(currentScore!.grade)}`}>
            {currentScore!.grade}
          </span>
        </div>
        <div className="flex flex-col items-center text-muted-foreground">
          <ArrowRight className="h-6 w-6" />
          {improved && (
            <span className="mt-1 flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400">
              <ChevronUp className="h-3 w-3" />+{projectedScore!.overall - currentScore!.overall}
            </span>
          )}
        </div>
        <div className="flex flex-col items-center rounded-lg border border-border bg-muted/30 px-6 py-4">
          <span className="text-xs font-medium text-muted-foreground">Projected</span>
          <span
            className={`text-2xl font-bold ${
              improved ? "text-green-600 dark:text-green-400" : gradeColor(projectedScore!.grade)
            }`}
          >
            {projectedScore!.overall}
          </span>
          <span
            className={`text-sm font-semibold ${
              improved ? "text-green-600 dark:text-green-400" : gradeColor(projectedScore!.grade)
            }`}
          >
            {projectedScore!.grade}
          </span>
        </div>
      </div>
      {projectedScore && currentScore && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {currentScore.categories.map((cat, i) => {
            const proj = projectedScore.categories[i];
            const delta = proj ? proj.score - cat.score : 0;
            return (
              <div
                key={cat.label}
                className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm"
              >
                <span>{cat.label}</span>
                <span className={delta > 0 ? "text-green-600 dark:text-green-400" : ""}>
                  {cat.score} → {proj?.score ?? cat.score}
                  {delta > 0 && ` (+${delta})`}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Check findings to resolve and see projected improvement
        </p>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {allFindings.map((f) => (
            <label
              key={`${f.fwLabel}-${f.id}`}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <input
                type="checkbox"
                checked={resolvedIds.has(f.id)}
                onChange={() => toggleResolved(f.id)}
                className="mt-1"
              />
              <span className="flex-1 truncate text-sm">
                <span className="capitalize text-muted-foreground">{f.severity}</span>: {f.title}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
