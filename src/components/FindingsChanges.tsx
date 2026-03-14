import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import {
  loadPreviousSnapshot,
  loadSnapshotBeforePrevious,
  diffFindings,
} from "@/lib/finding-snapshots";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

interface AggregatedDiff {
  newFindings: string[];
  fixedFindings: string[];
  regressed: string[];
  hasChanges: boolean;
  hasPrevious: boolean;
}

function aggregateDiffs(
  analysisResults: Record<string, AnalysisResult>
): AggregatedDiff {
  const newFindings: string[] = [];
  const fixedFindings: string[] = [];
  const regressed: string[] = [];
  let hasPrevious = false;

  for (const [label, result] of Object.entries(analysisResults)) {
    const hostname = result.hostname || label;
    const previous = loadPreviousSnapshot(hostname);
    if (previous) hasPrevious = true;
    const beforePrevious = loadSnapshotBeforePrevious(hostname);
    const diff = diffFindings(previous, result.findings, beforePrevious);

    newFindings.push(...diff.newFindings);
    fixedFindings.push(...diff.fixedFindings);
    regressed.push(...diff.regressed);
  }

  const hasChanges =
    newFindings.length > 0 || fixedFindings.length > 0 || regressed.length > 0;

  return { newFindings, fixedFindings, regressed, hasChanges, hasPrevious };
}

function ExpandableList({
  title,
  items,
  colorClass,
}: {
  title: string;
  items: string[];
  colorClass: string;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium ${colorClass} hover:opacity-90 transition-opacity`}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        {title} ({items.length})
      </button>
      {open && (
        <ul className="border-t border-border bg-muted/30 px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
          {items.map((t, i) => (
            <li key={`${t}-${i}`} className="text-xs text-foreground">
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FindingsChanges({ analysisResults }: Props) {
  const diff = useMemo(
    () => aggregateDiffs(analysisResults),
    [analysisResults]
  );

  if (!diff.hasPrevious || !diff.hasChanges) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        Changes since last assessment
      </h3>
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#EA0022]/10 text-[#EA0022]">
          {diff.newFindings.length} new
        </span>
        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]">
          {diff.fixedFindings.length} fixed
        </span>
        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#F29400]/10 text-[#F29400]">
          {diff.regressed.length} regressed
        </span>
      </div>
      <div className="space-y-2">
        <ExpandableList
          title="New findings"
          items={diff.newFindings}
          colorClass="bg-[#EA0022]/10 text-[#EA0022]"
        />
        <ExpandableList
          title="Fixed findings"
          items={diff.fixedFindings}
          colorClass="bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]"
        />
        <ExpandableList
          title="Regressed (previously fixed, now back)"
          items={diff.regressed}
          colorClass="bg-[#F29400]/10 text-[#F29400]"
        />
      </div>
    </div>
  );
}
