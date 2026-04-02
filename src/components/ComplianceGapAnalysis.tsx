import { useMemo, useState } from "react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
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

  const mergedResult = useMemo<AnalysisResult | null>(() => {
    const all = Object.values(analysisResults);
    if (all.length === 0) return null;
    if (all.length === 1) return all[0];
    const seen = new Set<string>();
    const merged: Finding[] = [];
    for (const r of all) {
      for (const f of r.findings) {
        if (!seen.has(f.id)) {
          seen.add(f.id);
          merged.push(f);
        }
      }
    }
    return { ...all[0], findings: merged };
  }, [analysisResults]);

  const gaps = useMemo(() => {
    if (!mergedResult) return [];
    const fws =
      selectedFrameworks.length > 0
        ? selectedFrameworks
        : ["NCSC Guidelines", "Cyber Essentials / CE+"];
    const mappings = mapToAllFrameworks(fws, mergedResult);
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
        cmp =
          (order[a.control.status as keyof typeof order] ?? 2) -
          (order[b.control.status as keyof typeof order] ?? 2);
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
      <div
        className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-8 shadow-card backdrop-blur-sm"
        style={{
          background:
            "linear-gradient(145deg, rgba(0,242,179,0.06), rgba(32,6,247,0.03), transparent)",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(0,242,179,0.25), transparent)",
          }}
        />
        <h3 className="text-lg font-display font-black tracking-tight text-foreground mb-2">
          Compliance Gaps
        </h3>
        <p className="text-sm text-foreground/50">All mapped controls are passing</p>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-8 shadow-card backdrop-blur-sm space-y-6 transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(234,0,34,0.04), rgba(242,148,0,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(234,0,34,0.15), rgba(242,148,0,0.12), transparent)",
        }}
      />
      <div>
        <h3 className="text-lg font-display font-black tracking-tight text-foreground">
          Compliance Gaps
        </h3>
        <p className="text-sm text-foreground/45 mt-1.5 font-medium">
          {gaps.length} control{gaps.length !== 1 ? "s" : ""} need attention across{" "}
          {frameworks.length} framework
          {frameworks.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div
        className="overflow-x-auto rounded-xl overflow-hidden backdrop-blur-sm"
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr
              className="border-b border-slate-900/[0.10] dark:border-white/[0.06]"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <th
                className="text-left py-3.5 px-4 font-display font-bold text-foreground/45 uppercase tracking-[0.08em] text-[10px] sm:text-[11px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("framework")}
              >
                Framework {sortKey === "framework" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-3.5 px-4 font-display font-bold text-foreground/45 uppercase tracking-[0.08em] text-[10px] sm:text-[11px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("controlId")}
              >
                Control ID {sortKey === "controlId" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-3.5 px-4 font-display font-bold text-foreground/45 uppercase tracking-[0.08em] text-[10px] sm:text-[11px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("controlName")}
              >
                Control Name {sortKey === "controlName" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-3.5 px-4 font-display font-bold text-foreground/45 uppercase tracking-[0.08em] text-[10px] sm:text-[11px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("status")}
              >
                Status {sortKey === "status" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-3.5 px-4 font-display font-bold text-foreground/45 uppercase tracking-[0.08em] text-[10px] sm:text-[11px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("findings")}
              >
                Linked Findings {sortKey === "findings" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="text-left py-3.5 px-4 font-display font-bold text-foreground/45 uppercase tracking-[0.08em] text-[10px] sm:text-[11px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("effort")}
              >
                Effort {sortKey === "effort" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(({ framework, control, findingCount, effort }) => (
              <tr
                key={`${framework}-${control.controlId}`}
                className="border-b border-slate-900/[0.08] dark:border-white/[0.04] last:border-b-0 transition-colors hover:bg-slate-950/[0.04] dark:hover:bg-white/[0.03]"
              >
                <td className="py-4 px-4 font-display font-semibold text-foreground/75">
                  {framework}
                </td>
                <td className="py-4 px-4 text-foreground/50 font-mono text-[11px] sm:text-xs">
                  {control.controlId}
                </td>
                <td className="py-4 px-4 font-display font-bold text-foreground">
                  {control.controlName}
                </td>
                <td className="py-4 px-4">
                  <span
                    className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider backdrop-blur-sm ${
                      control.status === "fail"
                        ? "text-[#EA0022] border border-[#EA0022]/35"
                        : "text-[#F29400] border border-[#F29400]/35"
                    }`}
                    style={{
                      background:
                        control.status === "fail"
                          ? "linear-gradient(145deg, rgba(234,0,34,0.15), rgba(234,0,34,0.05))"
                          : "linear-gradient(145deg, rgba(242,148,0,0.15), rgba(242,148,0,0.05))",
                      boxShadow:
                        control.status === "fail"
                          ? "0 0 12px rgba(234,0,34,0.12), inset 0 1px 0 rgba(255,255,255,0.06)"
                          : "0 0 12px rgba(242,148,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
                    }}
                  >
                    {control.status}
                  </span>
                </td>
                <td className="py-4 px-4 tabular-nums font-display font-black text-foreground text-base">
                  {findingCount}
                </td>
                <td className="py-4 px-4 text-foreground/45 font-semibold">{effort}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-sm font-bold text-brand-accent hover:underline underline-offset-2"
        >
          Show all {sorted.length} gaps
        </button>
      )}
    </div>
  );
}
