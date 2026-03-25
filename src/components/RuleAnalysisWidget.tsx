import { useState } from "react";
import { RuleConsolidation } from "./RuleConsolidation";
import { RuleOverlapVis } from "./RuleOverlapVis";
import type { ParsedFile } from "@/hooks/use-report-generation";

interface Props {
  files: ParsedFile[];
}

export function RuleAnalysisWidget({ files }: Props) {
  const [view, setView] = useState<"consolidation" | "overlap">("consolidation");

  return (
    <div className="space-y-4">
      <div
        className="flex gap-1 p-1 rounded-xl w-fit backdrop-blur-md border border-slate-900/[0.12] dark:border-white/[0.08]"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => setView("consolidation")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
            view === "consolidation"
              ? "text-foreground border border-[#00EDFF]/40"
              : "text-foreground/45 hover:text-foreground/80 border border-transparent"
          }`}
          style={
            view === "consolidation"
              ? {
                  background: "linear-gradient(145deg, rgba(0,237,255,0.14), rgba(32,6,247,0.08))",
                  boxShadow: "0 0 20px rgba(0,237,255,0.12), inset 0 1px 0 rgba(255,255,255,0.1)",
                }
              : undefined
          }
        >
          Consolidation Suggestions
        </button>
        <button
          onClick={() => setView("overlap")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
            view === "overlap"
              ? "text-foreground border border-[#00EDFF]/40"
              : "text-foreground/45 hover:text-foreground/80 border border-transparent"
          }`}
          style={
            view === "overlap"
              ? {
                  background: "linear-gradient(145deg, rgba(0,237,255,0.14), rgba(32,6,247,0.08))",
                  boxShadow: "0 0 20px rgba(0,237,255,0.12), inset 0 1px 0 rgba(255,255,255,0.1)",
                }
              : undefined
          }
        >
          Overlap Matrix
        </button>
      </div>
      {view === "consolidation" ? (
        <RuleConsolidation files={files} />
      ) : (
        <RuleOverlapVis files={files} />
      )}
    </div>
  );
}
