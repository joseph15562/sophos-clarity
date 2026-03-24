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
    <div className="space-y-4">
      <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.96),rgba(12,18,34,0.96))] p-4 shadow-sm space-y-3">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent">Compliance workflow</p>
          <p className="text-sm font-semibold text-foreground">Switch between framework gap analysis and control-to-finding mapping</p>
        </div>
        <div className="flex gap-2 p-1.5 bg-card/70 rounded-2xl border border-border/70 w-fit">
          <button
            onClick={() => setView("gaps")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              view === "gaps"
                ? "bg-[#2006F7] text-white dark:bg-[#00EDFF] dark:text-slate-950 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Gap Analysis
          </button>
          <button
            onClick={() => setView("controls")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
              view === "controls"
                ? "bg-[#2006F7] text-white dark:bg-[#00EDFF] dark:text-slate-950 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Control-to-Finding Map
          </button>
        </div>
      </div>
      {view === "gaps" ? (
        <ComplianceGapAnalysis analysisResults={analysisResults} selectedFrameworks={selectedFrameworks} />
      ) : (
        <ControlFindingMap analysisResults={analysisResults} selectedFrameworks={selectedFrameworks} />
      )}
    </div>
  );
}
