"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { loadPreviousSnapshot } from "@/lib/finding-snapshots";

type Grade = "A" | "B" | "C" | "D" | "F";

function scoreToGrade(score: number): Grade {
  return score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
}

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

export function ScoreDeltaBanner({ analysisResults }: Props) {
  const [previous, setPrevious] = useState<{ score: number } | null>(null);

  const entries = Object.entries(analysisResults);
  const firstEntry = entries[0];
  const label = firstEntry?.[0];
  const result = firstEntry?.[1];
  const hostname = result?.hostname || label || "";
  const currentScoreResult = result ? computeRiskScore(result) : null;
  const currentScore = currentScoreResult?.overall ?? 0;
  const currentGrade = currentScoreResult?.grade ?? ("F" as Grade);

  useEffect(() => {
    if (!hostname) return;
    let cancelled = false;
    loadPreviousSnapshot(hostname).then((snap) => {
      if (!cancelled && snap) setPrevious({ score: snap.score });
    });
    return () => {
      cancelled = true;
    };
  }, [hostname]);

  if (!firstEntry) return null;

  if (previous === null) return null;

  const delta = currentScore - previous.score;
  if (delta === 0) return null;

  const previousGrade = scoreToGrade(previous.score);
  const gradeChange =
    previousGrade !== currentGrade ? ` (Grade ${previousGrade} → Grade ${currentGrade})` : "";

  if (delta > 0) {
    return (
      <div className="w-full rounded-xl border p-4 flex items-center gap-3 bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 border-[#008F69]/35 dark:border-[#00F2B3]/30">
        <TrendingUp className="h-5 w-5 text-[#00F2B3] shrink-0" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#00F2B3]">
            Score improved by +{delta} points since last assessment{gradeChange}
          </span>
          <span className="text-xs font-mono text-[#00F2B3]/80">
            {previous.score} → {currentScore}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border p-4 flex items-center gap-3 bg-[#EA0022]/10 border-[#EA0022]/30">
      <TrendingDown className="h-5 w-5 text-[#EA0022] shrink-0" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[#EA0022]">
          Score dropped by {Math.abs(delta)} points since last assessment{gradeChange}
        </span>
        <span className="text-xs font-mono text-[#EA0022]/80">
          {previous.score} → {currentScore}
        </span>
      </div>
    </div>
  );
}
