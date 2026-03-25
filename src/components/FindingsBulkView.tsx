"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import {
  acceptFinding,
  loadAcceptedFindings,
  isAccepted,
  type AcceptedFinding,
} from "@/lib/accepted-findings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const STORAGE_KEY_PLAN = "sophos-remediation-plan-ids";

function loadPlanIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLAN);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function savePlanIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function findingKey(label: string, f: Finding): string {
  return `${label}:${f.title}`;
}

const SEV_STYLE: Record<string, string> = {
  critical: "bg-[#EA0022]/10 text-[#EA0022]",
  high: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]",
  medium: "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]",
  low: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]",
  info: "bg-[#009CFB]/10 text-[#009CFB]",
};

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

export function FindingsBulkView({ analysisResults }: Props) {
  const [acceptedList, setAcceptedList] = useState<AcceptedFinding[]>([]);
  const [planIds, setPlanIds] = useState<Set<string>>(loadPlanIds);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allFindings = useMemo(() => {
    const out: { key: string; label: string; finding: Finding }[] = [];
    const results =
      analysisResults && typeof analysisResults === "object" && !Array.isArray(analysisResults)
        ? analysisResults
        : {};
    for (const [label, ar] of Object.entries(results)) {
      const findings = Array.isArray((ar as AnalysisResult)?.findings)
        ? (ar as AnalysisResult).findings
        : [];
      for (const f of findings) {
        out.push({ key: findingKey(label, f), label, finding: f });
      }
    }
    return out.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (order[a.finding.severity] ?? 5) - (order[b.finding.severity] ?? 5);
    });
  }, [analysisResults]);

  const loadAccepted = useCallback(() => {
    loadAcceptedFindings().then(setAcceptedList);
  }, []);

  useEffect(() => {
    loadAccepted();
    const onStorage = () => {
      loadAccepted();
      setPlanIds(loadPlanIds());
    };
    window.addEventListener("accepted-findings-changed", onStorage);
    return () => window.removeEventListener("accepted-findings-changed", onStorage);
  }, [loadAccepted]);

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selected.size >= allFindings.length) setSelected(new Set());
    else setSelected(new Set(allFindings.map((x) => x.key)));
  }, [allFindings, selected.size]);

  const handleMarkAccepted = useCallback(async () => {
    const titles = new Set<string>();
    selected.forEach((key) => {
      const item = allFindings.find((x) => x.key === key);
      if (item) titles.add(item.finding.title);
    });
    for (const title of titles) await acceptFinding(title);
    loadAccepted();
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, allFindings]);

  const handleExportSelected = useCallback(() => {
    const rows = allFindings.filter((x) => selected.has(x.key));
    const header = "Firewall,Severity,Title,Detail,Section\n";
    const body = rows
      .map((r) => {
        const d = (r.finding.detail ?? "").replace(/"/g, '""').replace(/\n/g, " ");
        const t = (r.finding.title ?? "").replace(/"/g, '""');
        return `${r.label},${r.finding.severity},"${t}","${d}",${r.finding.section ?? ""}`;
      })
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "findings-selected.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [selected, allFindings]);

  const handleAddToPlan = useCallback(() => {
    const next = new Set(planIds);
    selected.forEach((key) => next.add(key));
    savePlanIds(next);
    setPlanIds(next);
    setSelected(new Set());
  }, [selected, planIds]);

  if (allFindings.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-border/50 bg-card p-5 space-y-4"
      data-tour="findings-bulk"
    >
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
        Findings — bulk actions
      </h3>
      <p className="text-[11px] text-muted-foreground">
        Select findings to mark as accepted risk, add to remediation plan, or export as CSV.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleMarkAccepted}
          disabled={selected.size === 0}
          className="gap-1.5 text-xs"
        >
          Mark as accepted risk
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportSelected}
          disabled={selected.size === 0}
          className="gap-1.5 text-xs"
        >
          Export selected (CSV)
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddToPlan}
          disabled={selected.size === 0}
          className="gap-1.5 text-xs"
        >
          Add to remediation plan
        </Button>
        {selected.size > 0 && (
          <span className="text-[10px] text-muted-foreground">{selected.size} selected</span>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 border-b border-border">
              <tr>
                <th className="text-left p-2 w-8">
                  <Checkbox
                    checked={selected.size === allFindings.length && allFindings.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left p-2 font-medium text-muted-foreground">Firewall</th>
                <th className="text-left p-2 font-medium text-muted-foreground w-24">Severity</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Finding</th>
                <th className="text-left p-2 font-medium text-muted-foreground w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {allFindings.map(({ key, label, finding }) => {
                const accepted = isAccepted(acceptedList, finding.title);
                const inPlan = planIds.has(key);
                return (
                  <tr key={key} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2">
                      <Checkbox
                        checked={selected.has(key)}
                        onCheckedChange={() => toggleSelect(key)}
                        disabled={accepted}
                        aria-label={`Select ${finding.title}`}
                      />
                    </td>
                    <td className="p-2 text-muted-foreground">{label}</td>
                    <td className="p-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SEV_STYLE[finding.severity] ?? ""}`}
                      >
                        {finding.severity}
                      </span>
                    </td>
                    <td className="p-2 text-foreground">{finding.title}</td>
                    <td className="p-2 text-[10px] text-muted-foreground">
                      {accepted && "Accepted"}
                      {inPlan && !accepted && "In plan"}
                      {!accepted && !inPlan && "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
