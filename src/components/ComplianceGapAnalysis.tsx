import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { mapToAllFrameworks, type ControlMapping } from "@/lib/compliance-map";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  selectedFrameworks: string[];
}

type SortKey = "framework" | "controlId" | "controlName" | "status" | "findings" | "effort";

function effortLabel(count: number): string {
  if (count <= 2) return "Low";
  if (count <= 4) return "Medium";
  return "High";
}

const ROW_LIMIT = 20;

export function ComplianceGapAnalysis({ analysisResults, selectedFrameworks }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll] = useState(false);

  const firstResult = Object.values(analysisResults)[0];
  const gaps = useMemo(() => {
    if (!firstResult) return [];
    const fws = selectedFrameworks.length > 0 ? selectedFrameworks : ["NCSC Guidelines", "Cyber Essentials / CE+"];
    const mappings = mapToAllFrameworks(fws, firstResult);
    const items: Array<{
      framework: string;
      control: ControlMapping;
      findingCount: number;
      effort: string;
    }> = [];
    for (const m of mappings) {
      for (const c of m.controls) {
        if (c.status === "fail" || c.status === "partial") {
          items.push({
            framework: m.framework,
            control: c,
            findingCount: c.relatedFindings.length,
            effort: effortLabel(c.relatedFindings.length),
          });
        }
      }
    }
    return items;
  }, [firstResult, selectedFrameworks]);

  const sorted = useMemo(() => {
    const arr = [...gaps];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "status") {
        const order = { fail: 0, partial: 1 };
        cmp = (order[a.control.status as keyof typeof order] ?? 2) - (order[b.control.status as keyof typeof order] ?? 2);
      } else if (sortKey === "findings" || sortKey === "effort") {
        cmp = a.findingCount - b.findingCount;
      } else if (sortKey === "framework") {
        cmp = a.framework.localeCompare(b.framework);
      } else if (sortKey === "controlId") {
        cmp = a.control.controlId.localeCompare(b.control.controlId);
      } else if (sortKey === "controlName") {
        cmp = a.control.controlName.localeCompare(b.control.controlName);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [gaps, sortKey, sortDir]);

  const frameworks = useMemo(() => [...new Set(gaps.map((g) => g.framework))], [gaps]);
  const displayed = showAll ? sorted : sorted.slice(0, ROW_LIMIT);
  const hasMore = sorted.length > ROW_LIMIT;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else setSortKey(key);
  };

  if (gaps.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 shadow-card">
        <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-3">Compliance Gaps</h3>
        <p className="text-sm text-muted-foreground/60">All mapped controls are passing</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 shadow-card space-y-5">
      <div>
        <h3 className="text-base font-display font-bold tracking-tight text-foreground">Compliance Gaps</h3>
        <p className="text-[11px] text-muted-foreground/60 mt-1">
          {gaps.length} control{gaps.length !== 1 ? "s" : ""} need attention across {frameworks.length} framework
          {frameworks.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border/40 bg-muted/15 dark:bg-muted/10">
              <th
                className="text-left py-3 px-4 font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.1em] text-[10px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("framework")}
              >
                Framework {sortKey === "framework" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-3 px-4 font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.1em] text-[10px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("controlId")}
              >
                Control ID {sortKey === "controlId" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-3 px-4 font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.1em] text-[10px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("controlName")}
              >
                Control Name {sortKey === "controlName" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-3 px-4 font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.1em] text-[10px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("status")}
              >
                Status {sortKey === "status" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-3 px-4 font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.1em] text-[10px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("findings")}
              >
                Linked Findings {sortKey === "findings" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-3 px-4 font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.1em] text-[10px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("effort")}
              >
                Effort {sortKey === "effort" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(({ framework, control, findingCount, effort }) => (
              <tr key={`${framework}-${control.controlId}`} className="border-b border-border/30 last:border-b-0 hover:bg-muted/15 dark:hover:bg-muted/10 transition-colors">
                <td className="py-3 px-4 font-display font-medium text-foreground/80">{framework}</td>
                <td className="py-3 px-4 text-muted-foreground/70 font-mono text-[10px]">{control.controlId}</td>
                <td className="py-3 px-4 font-display font-medium text-foreground">{control.controlName}</td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide border ${
                      control.status === "fail"
                        ? "bg-[#EA0022]/10 text-[#EA0022] border-[#EA0022]/20"
                        : "bg-[#F29400]/10 text-[#F29400] border-[#F29400]/20"
                    }`}
                  >
                    {control.status}
                  </span>
                </td>
                <td className="py-3 px-4 tabular-nums font-display font-semibold text-foreground">{findingCount}</td>
                <td className="py-3 px-4 text-muted-foreground/60 font-medium">{effort}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-[11px] font-semibold text-brand-accent hover:underline underline-offset-2"
        >
          Show all {sorted.length} gaps
        </button>
      )}
    </div>
  );
}
