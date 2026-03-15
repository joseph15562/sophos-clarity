import { useState } from "react";
import { CostOfRiskEstimator } from "./CostOfRiskEstimator";
import { SecurityRoiCalculator } from "./SecurityRoiCalculator";
import type { AnalysisResult } from "@/lib/analyse-config";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

export function RiskRoiWidget({ analysisResults }: Props) {
  const [view, setView] = useState<"cost" | "roi">("cost");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setView("cost")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "cost"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Cost of Risk
        </button>
        <button
          onClick={() => setView("roi")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "roi"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Security ROI
        </button>
      </div>
      {view === "cost" ? (
        <CostOfRiskEstimator analysisResults={analysisResults} />
      ) : (
        <SecurityRoiCalculator analysisResults={analysisResults} />
      )}
    </div>
  );
}
