import { useState } from "react";
import { RuleConsolidation } from "./RuleConsolidation";
import { RuleOverlapVis } from "./RuleOverlapVis";
import type { ParsedFile } from "@/types/parsed-file";

interface Props {
  files: ParsedFile[];
}

export function RuleAnalysisWidget({ files }: Props) {
  const [view, setView] = useState<"consolidation" | "overlap">("consolidation");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setView("consolidation")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "consolidation"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Consolidation Suggestions
        </button>
        <button
          onClick={() => setView("overlap")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "overlap"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
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
