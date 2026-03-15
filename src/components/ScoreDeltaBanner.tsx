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
  if (!firstEntry) return null;

  const [label, result] = firstEntry;
  const hostname = result.hostname || label;
  const currentScoreResult = computeRiskScore(result);
  const currentScore = currentScoreResult.overall;
  const currentGrade = currentScoreResult.grade;

  useEffect(() => {
    let cancelled = false;
    loadPreviousSnapshot(hostname).then((snap) => {
      if (!cancelled && snap) setPrevious({ score: snap.score });
    });
    return () => { cancelled = true; };
  }, [hostname]);

  if (previous === null) return null;

  const delta = currentScore - previous.score;
  if (delta === 0) return null;

  const previousGrade = scoreToGrade(previous.score);
  const gradeChange =
    previousGrade !== currentGrade ? ` (Grade ${previousGrade} → Grade ${currentGrade})` : "";

  if (delta > 0) {
    return (
      <div className="w-full rounded-xl border p-4 flex items-center gap-3 bg-[#00995a]/10 border-[#00995a]/30">
        <TrendingUp className="h-5 w-5 text-[#00995a] shrink-0" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#00995a]">
            Score improved by +{delta} points since last assessment{gradeChange}
          </span>
          <span className="text-xs font-mono text-[#00995a]/80">
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
