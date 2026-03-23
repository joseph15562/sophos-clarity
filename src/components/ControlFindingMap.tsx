import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import { mapToAllFrameworks, type ControlMapping, type ControlStatus } from "@/lib/compliance-map";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  selectedFrameworks: string[];
}

const STATUS_STYLES: Record<ControlStatus, string> = {
  pass: "bg-[#00F2B3]/20 text-[#00F2B3]",
  partial: "bg-[#F29400]/20 text-[#F29400]",
  fail: "bg-[#EA0022]/20 text-[#EA0022]",
  na: "bg-[#6B7280]/20 text-[#6B7280]",
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-[#EA0022]/20 text-[#EA0022]",
  high: "bg-[#F29400]/20 text-[#F29400]",
  medium: "bg-[#6B7280]/20 text-[#6B7280]",
  low: "bg-[#00F2B3]/20 text-[#00F2B3]",
  info: "bg-muted/40 text-muted-foreground",
};

type FilterStatus = "all" | "fail" | "partial" | "pass";

export function ControlFindingMap({ analysisResults, selectedFrameworks }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [collapsedFrameworks, setCollapsedFrameworks] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterStatus>("all");

  const firstResult = Object.values(analysisResults)[0];
  const mappings = useMemo(() => {
    if (!firstResult || selectedFrameworks.length === 0) return [];
    return mapToAllFrameworks(selectedFrameworks, firstResult);
  }, [firstResult, selectedFrameworks]);

  const findingsById = useMemo(() => {
    const map = new Map<string, Finding>();
    for (const r of Object.values(analysisResults)) {
      for (const f of r.findings) map.set(f.id, f);
    }
    return map;
  }, [analysisResults]);

  const filteredMappings = useMemo(() => {
    if (filter === "all") return mappings;
    return mappings.map((m) => ({
      ...m,
      controls: m.controls.filter((c) => c.status === filter),
    })).filter((m) => m.controls.length > 0);
  }, [mappings, filter]);

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleFramework = (framework: string) => {
    setCollapsedFrameworks((prev) => {
      const next = new Set(prev);
      if (next.has(framework)) next.delete(framework);
      else next.add(framework);
      return next;
    });
  };

  if (selectedFrameworks.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Control-to-Finding Mapping</h3>
        <p className="text-sm text-muted-foreground">Select compliance frameworks to see control mapping</p>
      </div>
    );
  }
  if (mappings.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-foreground">Control-to-Finding Mapping</h3>
        <div className="flex gap-1">
          {(["all", "fail", "partial", "pass"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-[10px] font-medium rounded-md border transition-colors ${
                filter === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {filteredMappings.map((m) => {
          const fwKey = `fw-${m.framework}`;
          const isFwExpanded = !collapsedFrameworks.has(fwKey);
          return (
            <div key={m.framework} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleFramework(fwKey)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                {isFwExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                )}
                {m.framework} ({m.controls.length} controls)
              </button>
              {isFwExpanded && (
                <div className="divide-y divide-border/50">
                  {m.controls.map((control) => {
                    const rowKey = `${m.framework}-${control.controlId}`;
                    const isExpanded = expandedRows.has(rowKey);
                    const findings = control.relatedFindings
                      .map((id) => findingsById.get(id))
                      .filter((f): f is Finding => !!f);
                    return (
                      <div key={rowKey}>
                        <button
                          onClick={() => toggleRow(rowKey)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] hover:bg-muted/20 transition-colors"
                        >
                          {findings.length > 0 ? (
                            isExpanded ? (
                              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                            )
                          ) : (
                            <span className="w-3" />
                          )}
                          <span className="font-mono text-muted-foreground min-w-[4rem]">{control.controlId}</span>
                          <span className="flex-1 truncate">{control.controlName}</span>
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ${STATUS_STYLES[control.status]}`}
                          >
                            {control.status}
                          </span>
                          <span className="tabular-nums text-muted-foreground">{findings.length} findings</span>
                        </button>
                        {isExpanded && findings.length > 0 && (
                          <div className="px-3 py-2 pl-8 bg-muted/10 space-y-1.5">
                            {findings.map((f) => (
                              <div key={f.id} className="flex items-start gap-2 text-[10px]">
                                <span
                                  className={`inline-flex px-1 py-0.5 rounded text-[9px] font-medium shrink-0 ${
                                    SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.info
                                  }`}
                                >
                                  {f.severity}
                                </span>
                                <span className="text-foreground">{f.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {filteredMappings.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No controls match the selected filter</p>
      )}
    </div>
  );
}
