import { useState, useMemo } from "react";
import {
  Plus,
  Minus,
  RefreshCw,
  Check,
  ChevronDown,
  ChevronRight,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExtractedSections } from "@/lib/extract-sections";
import {
  diffConfigs,
  type ConfigDiffResult,
  type SectionDiff,
  type RowDiff,
  type ChangeType,
} from "@/lib/diff-config";
import { computeRiskScore } from "@/lib/risk-score";
import type { AnalysisResult, Finding, Severity } from "@/lib/analyse-config";

interface ConfigDiffProps {
  beforeLabel: string;
  afterLabel: string;
  beforeSections: ExtractedSections;
  afterSections: ExtractedSections;
  onClose: () => void;
  /** Optional analysis results for risk scores and findings delta */
  beforeAnalysis?: AnalysisResult;
  afterAnalysis?: AnalysisResult;
}

const SEV_BADGE: Record<Severity, string> = {
  critical: "bg-[#EA0022]/10 text-[#EA0022]",
  high: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]",
  medium: "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]",
  low: "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]",
  info: "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB]",
};

const STATUS_STYLES: Record<ChangeType, { bg: string; text: string; icon: React.ReactNode }> = {
  added: {
    bg: "bg-[#00F2B3]/[0.06] dark:bg-[#00F2B3]/[0.08]",
    text: "text-[#00F2B3] dark:text-[#00F2B3]",
    icon: <Plus className="h-3.5 w-3.5" />,
  },
  removed: {
    bg: "bg-[#EA0022]/[0.06] dark:bg-[#EA0022]/[0.08]",
    text: "text-[#EA0022]",
    icon: <Minus className="h-3.5 w-3.5" />,
  },
  modified: {
    bg: "bg-[#F29400]/[0.06] dark:bg-[#F29400]/[0.08]",
    text: "text-[#c47800] dark:text-[#F29400]",
    icon: <RefreshCw className="h-3.5 w-3.5" />,
  },
  unchanged: {
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    icon: <Check className="h-3.5 w-3.5" />,
  },
};

type FilterMode = "all" | "changes";

export function ConfigDiff({
  beforeLabel,
  afterLabel,
  beforeSections,
  afterSections,
  onClose,
  beforeAnalysis,
  afterAnalysis,
}: ConfigDiffProps) {
  const diff = useMemo(
    () => diffConfigs(beforeSections, afterSections),
    [beforeSections, afterSections],
  );
  const [filter, setFilter] = useState<FilterMode>("changes");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    return new Set(diff.sections.filter((s) => s.status !== "unchanged").map((s) => s.name));
  });

  const visibleSections =
    filter === "changes" ? diff.sections.filter((s) => s.status !== "unchanged") : diff.sections;

  const toggleSection = (name: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const beforeScore = beforeAnalysis ? computeRiskScore(beforeAnalysis) : null;
  const afterScore = afterAnalysis ? computeRiskScore(afterAnalysis) : null;

  const { newFindings, fixedFindings } = useMemo(() => {
    if (!beforeAnalysis || !afterAnalysis)
      return { newFindings: [] as Finding[], fixedFindings: [] as Finding[] };
    const beforeIds = new Set(beforeAnalysis.findings.map((f) => f.id));
    const afterIds = new Set(afterAnalysis.findings.map((f) => f.id));
    return {
      newFindings: afterAnalysis.findings.filter((f) => !beforeIds.has(f.id)),
      fixedFindings: beforeAnalysis.findings.filter((f) => !afterIds.has(f.id)),
    };
  }, [beforeAnalysis, afterAnalysis]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center">
            <ArrowLeftRight className="h-5 w-5 text-brand-accent" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-foreground">Configuration Diff</h2>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{beforeLabel}</span>
              <span className="mx-2">→</span>
              <span className="font-semibold text-foreground">{afterLabel}</span>
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          ← Back
        </Button>
      </div>

      {/* Side-by-side risk scores */}
      {beforeScore && afterScore && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Before
            </p>
            <p
              className={`text-3xl font-extrabold ${beforeScore.overall >= 70 ? "text-[#00F2B3] dark:text-[#00F2B3]" : beforeScore.overall >= 40 ? "text-[#F29400]" : "text-[#EA0022]"}`}
            >
              {beforeScore.overall}
            </p>
            <p className="text-xs font-bold text-muted-foreground mt-0.5">{beforeScore.grade}</p>
            <p className="text-[10px] text-muted-foreground">
              {beforeAnalysis!.findings.length} findings
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              After
            </p>
            <p
              className={`text-3xl font-extrabold ${afterScore.overall >= 70 ? "text-[#00F2B3] dark:text-[#00F2B3]" : afterScore.overall >= 40 ? "text-[#F29400]" : "text-[#EA0022]"}`}
            >
              {afterScore.overall}
            </p>
            <p className="text-xs font-bold text-muted-foreground mt-0.5">{afterScore.grade}</p>
            <p className="text-[10px] text-muted-foreground">
              {afterAnalysis!.findings.length} findings
            </p>
          </div>
          {afterScore.overall !== beforeScore.overall && (
            <div className="col-span-2 flex items-center justify-center gap-2 text-xs">
              {afterScore.overall > beforeScore.overall ? (
                <>
                  <ArrowUp className="h-4 w-4 text-[#00F2B3] dark:text-[#00F2B3]" />
                  <span className="font-semibold text-[#00F2B3] dark:text-[#00F2B3]">
                    +{afterScore.overall - beforeScore.overall} points improvement
                  </span>
                </>
              ) : (
                <>
                  <ArrowDown className="h-4 w-4 text-[#EA0022]" />
                  <span className="font-semibold text-[#EA0022]">
                    {afterScore.overall - beforeScore.overall} points regression
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Findings delta */}
      {(newFindings.length > 0 || fixedFindings.length > 0) && (
        <FindingsDeltaSection newFindings={newFindings} fixedFindings={fixedFindings} />
      )}

      {/* Summary strip */}
      <DiffSummary diff={diff} />

      {/* Filter toggle */}
      <div className="flex gap-2">
        <Button
          variant={filter === "changes" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("changes")}
          className="text-xs"
        >
          Changes Only (
          {diff.summary.sectionsAdded +
            diff.summary.sectionsRemoved +
            diff.summary.sectionsModified}
          )
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          className="text-xs"
        >
          All Sections ({diff.sections.length})
        </Button>
      </div>

      {/* Section list */}
      {visibleSections.length === 0 ? (
        <div className="rounded-xl border border-[#00F2B3]/30 dark:border-[#00F2B3]/30 bg-[#00F2B3]/5 dark:bg-[#00F2B3]/5 p-6 text-center">
          <Check className="h-8 w-8 text-[#00F2B3] dark:text-[#00F2B3] mx-auto mb-2" />
          <p className="text-sm font-semibold text-[#00F2B3] dark:text-[#00F2B3]">
            Configurations are identical
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            No differences detected between the two configurations.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleSections.map((section) => (
            <SectionDiffCard
              key={section.name}
              section={section}
              expanded={expandedSections.has(section.name)}
              onToggle={() => toggleSection(section.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FindingsDeltaSection({
  newFindings,
  fixedFindings,
}: {
  newFindings: Finding[];
  fixedFindings: Finding[];
}) {
  const [expandedNew, setExpandedNew] = useState(false);
  const [expandedFixed, setExpandedFixed] = useState(false);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
        Findings Delta
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* New findings */}
        <div className="rounded-xl border border-[#EA0022]/30 dark:border-[#EA0022]/40 bg-[#EA0022]/5 overflow-hidden">
          <button
            onClick={() => setExpandedNew(!expandedNew)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-sm font-medium text-foreground">New findings</span>
            <span className="text-xs font-semibold text-[#EA0022]">{newFindings.length}</span>
            {expandedNew ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {expandedNew && newFindings.length > 0 && (
            <ul className="px-4 pb-4 space-y-1.5 max-h-48 overflow-y-auto">
              {newFindings.map((f, i) => (
                <li key={`new-${i}`} className="flex items-start gap-2 text-xs">
                  <span
                    className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${SEV_BADGE[f.severity]}`}
                  >
                    {f.severity}
                  </span>
                  <span className="text-foreground">{f.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Fixed findings */}
        <div className="rounded-xl border border-[#00F2B3]/30 dark:border-[#00F2B3]/40 bg-[#00F2B3]/5 dark:bg-[#00F2B3]/5 overflow-hidden">
          <button
            onClick={() => setExpandedFixed(!expandedFixed)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-sm font-medium text-foreground">Fixed findings</span>
            <span className="text-xs font-semibold text-[#00F2B3] dark:text-[#00F2B3]">
              {fixedFindings.length}
            </span>
            {expandedFixed ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {expandedFixed && fixedFindings.length > 0 && (
            <ul className="px-4 pb-4 space-y-1.5 max-h-48 overflow-y-auto">
              {fixedFindings.map((f, i) => (
                <li key={`fixed-${i}`} className="flex items-start gap-2 text-xs">
                  <span
                    className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${SEV_BADGE[f.severity]}`}
                  >
                    {f.severity}
                  </span>
                  <span className="text-foreground">{f.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffSummary({ diff }: { diff: ConfigDiffResult }) {
  const { summary } = diff;
  const chips: Array<{ label: string; count: number; color: string }> = [
    {
      label: "Sections Modified",
      count: summary.sectionsModified,
      color: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]",
    },
    {
      label: "Sections Added",
      count: summary.sectionsAdded,
      color: "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]",
    },
    {
      label: "Sections Removed",
      count: summary.sectionsRemoved,
      color: "bg-[#EA0022]/10 text-[#EA0022]",
    },
    {
      label: "Rows Added",
      count: summary.totalRowsAdded,
      color: "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]",
    },
    {
      label: "Rows Removed",
      count: summary.totalRowsRemoved,
      color: "bg-[#EA0022]/10 text-[#EA0022]",
    },
    {
      label: "Rows Modified",
      count: summary.totalRowsModified,
      color: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-[11px]">
      {chips
        .filter((c) => c.count > 0)
        .map((c) => (
          <span key={c.label} className={`px-2 py-0.5 rounded font-medium ${c.color}`}>
            {c.count} {c.label}
          </span>
        ))}
      {summary.sectionsUnchanged > 0 && (
        <span className="text-muted-foreground ml-auto">{summary.sectionsUnchanged} unchanged</span>
      )}
    </div>
  );
}

function SectionDiffCard({
  section,
  expanded,
  onToggle,
}: {
  section: SectionDiff;
  expanded: boolean;
  onToggle: () => void;
}) {
  const style = STATUS_STYLES[section.status];
  const totalChanges = section.tableDiffs.reduce(
    (s, td) => s + td.summary.added + td.summary.removed + td.summary.modified,
    0,
  );

  return (
    <div className={`rounded-xl border border-border overflow-hidden ${style.bg}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className={`${style.text} shrink-0`}>{style.icon}</span>
        <span className="font-semibold text-sm text-foreground flex-1">{section.name}</span>
        <span className={`text-xs font-medium ${style.text} capitalize`}>{section.status}</span>
        {totalChanges > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {totalChanges} change{totalChanges !== 1 ? "s" : ""}
          </span>
        )}
      </button>
      {expanded && section.tableDiffs.length > 0 && (
        <div className="px-4 pb-4 space-y-3">
          {section.tableDiffs.map((td, idx) => (
            <TableDiffView key={idx} tableDiff={td} />
          ))}
        </div>
      )}
    </div>
  );
}

function TableDiffView({ tableDiff }: { tableDiff: import("@/lib/diff-config").TableDiff }) {
  const changedRows = tableDiff.rows.filter((r) => r.status !== "unchanged");
  const [showAll, setShowAll] = useState(false);
  const displayRows = showAll ? tableDiff.rows : changedRows;

  if (tableDiff.headers.length === 0 && tableDiff.rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      {changedRows.length < tableDiff.rows.length && (
        <div className="px-3 py-1.5 bg-muted/40 border-b border-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {changedRows.length} change{changedRows.length !== 1 ? "s" : ""} of{" "}
            {tableDiff.rows.length} row{tableDiff.rows.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[10px] text-[#2006F7] dark:text-[#009CFB] font-medium hover:underline"
          >
            {showAll ? "Show changes only" : "Show all rows"}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          {tableDiff.headers.length > 0 && (
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground w-6"></th>
                {tableDiff.headers.map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {displayRows.map((row, idx) => (
              <DiffRow key={`${row.key}-${idx}`} row={row} headers={tableDiff.headers} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiffRow({ row, headers }: { row: RowDiff; headers: string[] }) {
  const style = STATUS_STYLES[row.status];
  const data = row.after ?? row.before ?? {};
  const prevData = row.before;

  return (
    <tr
      className={`border-b border-border/50 last:border-0 ${row.status !== "unchanged" ? style.bg : ""}`}
    >
      <td className={`px-2 py-1.5 ${style.text}`}>{style.icon}</td>
      {headers.map((h) => {
        const isChanged = row.changedFields?.includes(h);
        return (
          <td
            key={h}
            className={`px-2 py-1.5 whitespace-nowrap ${isChanged ? "font-semibold" : ""}`}
          >
            {isChanged && prevData ? (
              <span>
                <span className="line-through text-[#EA0022]/60 dark:text-[#EA0022]/80 mr-1">
                  {prevData[h] ?? ""}
                </span>
                <span className="text-[#00F2B3] dark:text-[#00F2B3]">{data[h] ?? ""}</span>
              </span>
            ) : (
              <span className={row.status === "removed" ? "text-[#EA0022]/70" : ""}>
                {data[h] ?? ""}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
