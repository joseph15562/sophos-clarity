import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import {
  loadPreviousSnapshot,
  loadSnapshotBeforePrevious,
  diffFindings,
} from "@/lib/finding-snapshots";
import { SEVERITY_COLORS } from "@/lib/design-tokens";

const SEV_ORDER = ["critical", "high", "medium", "low", "info"] as const;
const SEV_COLORS: Record<string, string> = SEVERITY_COLORS;

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

async function aggregateDiffs(
  analysisResults: Record<string, AnalysisResult>,
): Promise<AggregatedDiff> {
  const newFindings: string[] = [];
  const fixedFindings: string[] = [];
  const regressed: string[] = [];
  let hasPrevious = false;

  for (const [label, result] of Object.entries(analysisResults)) {
    const hostname = result.hostname || label;
    const previous = await loadPreviousSnapshot(hostname);
    if (previous) hasPrevious = true;
    const beforePrevious = await loadSnapshotBeforePrevious(hostname);
    const diff = diffFindings(previous, result.findings, beforePrevious);

    newFindings.push(...diff.newFindings);
    fixedFindings.push(...diff.fixedFindings);
    regressed.push(...diff.regressed);
  }

  const hasChanges = newFindings.length > 0 || fixedFindings.length > 0 || regressed.length > 0;

  return { newFindings, fixedFindings, regressed, hasChanges, hasPrevious };
}

function ExpandableList({
  title,
  items,
  colorClass,
  titleToSeverity,
}: {
  title: string;
  items: string[];
  colorClass: string;
  titleToSeverity?: Map<string, string>;
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
          {items.map((t, i) => {
            const sev = titleToSeverity?.get(t);
            return (
              <li key={`${t}-${i}`} className="flex items-center gap-2 text-xs text-foreground">
                {sev && (
                  <span
                    className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                    style={{
                      backgroundColor: `${SEV_COLORS[sev] ?? "#999"}30`,
                      color: SEV_COLORS[sev] ?? "#666",
                    }}
                  >
                    {sev}
                  </span>
                )}
                <span className="flex-1 min-w-0">{t}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function buildTitleToSeverity(
  analysisResults: Record<string, AnalysisResult>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const ar of Object.values(analysisResults)) {
    for (const f of ar.findings) {
      const existing = map.get(f.title);
      const idxNew = SEV_ORDER.indexOf(f.severity as (typeof SEV_ORDER)[number]);
      const idxExisting = existing
        ? SEV_ORDER.indexOf(existing as (typeof SEV_ORDER)[number])
        : 999;
      if (!existing || (idxNew >= 0 && idxNew < idxExisting)) {
        map.set(f.title, f.severity);
      }
    }
  }
  return map;
}

export function FindingsChanges({ analysisResults }: Props) {
  const [diff, setDiff] = useState<AggregatedDiff | null>(null);

  const titleToSeverity = useMemo(() => buildTitleToSeverity(analysisResults), [analysisResults]);

  useEffect(() => {
    let cancelled = false;
    aggregateDiffs(analysisResults).then((d) => {
      if (!cancelled) setDiff(d);
    });
    return () => {
      cancelled = true;
    };
  }, [analysisResults]);

  const handleExportCsv = useCallback(() => {
    if (!diff) return;
    const rows: string[][] = [["Change Type", "Finding Title", "Severity"]];
    for (const t of diff.newFindings) {
      rows.push(["New", t, titleToSeverity.get(t) ?? ""]);
    }
    for (const t of diff.fixedFindings) {
      rows.push(["Fixed", t, titleToSeverity.get(t) ?? ""]);
    }
    for (const t of diff.regressed) {
      rows.push(["Regressed", t, titleToSeverity.get(t) ?? ""]);
    }
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `findings-changes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [diff, titleToSeverity]);

  if (!diff || !diff.hasPrevious || !diff.hasChanges) return null;

  return (
    <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          Changes since last assessment
        </h3>
        <button
          type="button"
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-[10px] text-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3 w-3" />
          Export Changes (CSV)
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#EA0022]/10 text-[#EA0022]">
          {diff.newFindings.length} new
        </span>
        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]">
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
          titleToSeverity={titleToSeverity}
        />
        <ExpandableList
          title="Fixed findings"
          items={diff.fixedFindings}
          colorClass="bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]"
          titleToSeverity={titleToSeverity}
        />
        <ExpandableList
          title="Regressed (previously fixed, now back)"
          items={diff.regressed}
          colorClass="bg-[#F29400]/10 text-[#F29400]"
          titleToSeverity={titleToSeverity}
        />
      </div>
    </div>
  );
}
