import { useState } from "react";
import { ComplianceGapAnalysis } from "./ComplianceGapAnalysis";
import { ControlFindingMap } from "./ControlFindingMap";
import type { AnalysisResult } from "@/lib/analyse-config";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  selectedFrameworks: string[];
}

export function ComplianceGapWidget({ analysisResults, selectedFrameworks }: Props) {
  const [view, setView] = useState<"gaps" | "controls">("gaps");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setView("gaps")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "gaps"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Gap Analysis
        </button>
        <button
          onClick={() => setView("controls")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "controls"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Control-to-Finding Map
        </button>
      </div>
      {view === "gaps" ? (
        <ComplianceGapAnalysis analysisResults={analysisResults} selectedFrameworks={selectedFrameworks} />
      ) : (
        <ControlFindingMap analysisResults={analysisResults} selectedFrameworks={selectedFrameworks} />
      )}
    </div>
  );
}
