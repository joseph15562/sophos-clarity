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
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Compliance Gaps</h3>
        <p className="text-sm text-muted-foreground">All mapped controls are passing</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-2">Compliance Gaps</h3>
      <p className="text-[10px] text-muted-foreground mb-4">
        {gaps.length} control{gaps.length !== 1 ? "s" : ""} need attention across {frameworks.length} framework
        {frameworks.length !== 1 ? "s" : ""}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-border">
              <th
                className="text-left py-2 px-2 font-medium cursor-pointer hover:text-foreground"
                onClick={() => handleSort("framework")}
              >
                Framework {sortKey === "framework" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-2 px-2 font-medium cursor-pointer hover:text-foreground"
                onClick={() => handleSort("controlId")}
              >
                Control ID {sortKey === "controlId" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-2 px-2 font-medium cursor-pointer hover:text-foreground"
                onClick={() => handleSort("controlName")}
              >
                Control Name {sortKey === "controlName" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-2 px-2 font-medium cursor-pointer hover:text-foreground"
                onClick={() => handleSort("status")}
              >
                Status {sortKey === "status" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-2 px-2 font-medium cursor-pointer hover:text-foreground"
                onClick={() => handleSort("findings")}
              >
                Linked Findings {sortKey === "findings" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-2 px-2 font-medium cursor-pointer hover:text-foreground"
                onClick={() => handleSort("effort")}
              >
                Effort {sortKey === "effort" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(({ framework, control, findingCount, effort }) => (
              <tr key={`${framework}-${control.controlId}`} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2 px-2 text-foreground">{framework}</td>
                <td className="py-2 px-2 text-muted-foreground font-mono">{control.controlId}</td>
                <td className="py-2 px-2 text-foreground">{control.controlName}</td>
                <td className="py-2 px-2">
                  <span
                    className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      control.status === "fail"
                        ? "bg-[#EA0022]/20 text-[#EA0022]"
                        : "bg-[#F29400]/20 text-[#F29400]"
                    }`}
                  >
                    {control.status}
                  </span>
                </td>
                <td className="py-2 px-2 tabular-nums">{findingCount}</td>
                <td className="py-2 px-2 text-muted-foreground">{effort}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 text-[10px] font-medium text-primary hover:underline"
        >
          Show all ({sorted.length})
        </button>
      )}
    </div>
  );
}
