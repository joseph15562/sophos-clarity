"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import {
  acceptFinding,
  loadAcceptedFindings,
  isAccepted,
  type AcceptedFinding,
} from "@/lib/accepted-findings";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { AutotaskTicketFromFindingDialog } from "@/components/AutotaskTicketFromFindingDialog";
import { ConnectWiseTicketFromFindingDialog } from "@/components/ConnectWiseTicketFromFindingDialog";
import { supabase } from "@/integrations/supabase/client";
import { warnOptionalError } from "@/lib/client-error-feedback";

const STORAGE_KEY_PLAN = "sophos-remediation-plan-ids";

function loadPlanIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLAN);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch (e) {
    warnOptionalError("FindingsBulkView.loadPlanIds", e);
    return new Set();
  }
}

function savePlanIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify([...ids]));
  } catch (e) {
    warnOptionalError("FindingsBulkView.savePlanIds", e);
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
  /** Resolved customer name for PSA company mapping */
  firecomplyCustomerKey?: string;
}

export function FindingsBulkView({ analysisResults, firecomplyCustomerKey }: Props) {
  const { org, canManageTeam } = useAuth();
  const [acceptedList, setAcceptedList] = useState<AcceptedFinding[]>([]);
  const [planIds, setPlanIds] = useState<Set<string>>(loadPlanIds);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cwTicketOpen, setCwTicketOpen] = useState(false);
  const [atTicketOpen, setAtTicketOpen] = useState(false);
  const [psaLinked, setPsaLinked] = useState<{ cw: boolean; at: boolean }>({
    cw: false,
    at: false,
  });

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

  useEffect(() => {
    if (!org?.id || !canManageTeam) {
      setPsaLinked({ cw: false, at: false });
      return;
    }
    let cancelled = false;
    void (async () => {
      const [cwRes, atRes] = await Promise.all([
        supabase
          .from("connectwise_manage_credentials")
          .select("org_id")
          .eq("org_id", org.id)
          .maybeSingle(),
        supabase
          .from("autotask_psa_credentials")
          .select("org_id")
          .eq("org_id", org.id)
          .maybeSingle(),
      ]);
      if (!cancelled) {
        setPsaLinked({ cw: !!cwRes.data, at: !!atRes.data });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id, canManageTeam]);

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

  const singleSelectedFinding = useMemo(() => {
    if (selected.size !== 1) return null;
    const key = [...selected][0];
    return allFindings.find((x) => x.key === key) ?? null;
  }, [selected, allFindings]);

  const cwIdempotencyKey = useMemo(() => {
    if (!org?.id || !singleSelectedFinding) return "";
    const safe = singleSelectedFinding.key.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 220);
    return `cw_find_${org.id}_${safe}`;
  }, [org?.id, singleSelectedFinding]);

  const atIdempotencyKey = useMemo(() => {
    if (!org?.id || !singleSelectedFinding) return "";
    const safe = singleSelectedFinding.key.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 220);
    return `at_find_${org.id}_${safe}`;
  }, [org?.id, singleSelectedFinding]);

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
        {canManageTeam && singleSelectedFinding && psaLinked.cw && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCwTicketOpen(true)}
            className="gap-1.5 text-xs"
          >
            ConnectWise ticket
          </Button>
        )}
        {canManageTeam && singleSelectedFinding && psaLinked.at && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAtTicketOpen(true)}
            className="gap-1.5 text-xs"
          >
            Autotask ticket
          </Button>
        )}
        {selected.size > 0 && (
          <span className="text-[10px] text-muted-foreground">{selected.size} selected</span>
        )}
      </div>

      {singleSelectedFinding && cwIdempotencyKey && (
        <ConnectWiseTicketFromFindingDialog
          open={cwTicketOpen}
          onOpenChange={setCwTicketOpen}
          idempotencyKey={cwIdempotencyKey}
          summary={singleSelectedFinding.finding.title}
          firecomplyCustomerKey={firecomplyCustomerKey}
          description={[
            singleSelectedFinding.finding.detail,
            singleSelectedFinding.finding.remediation
              ? `Remediation: ${singleSelectedFinding.finding.remediation}`
              : "",
            `Firewall: ${singleSelectedFinding.label}`,
            `Severity: ${singleSelectedFinding.finding.severity}`,
          ]
            .filter(Boolean)
            .join("\n\n")}
        />
      )}
      {singleSelectedFinding && atIdempotencyKey && (
        <AutotaskTicketFromFindingDialog
          open={atTicketOpen}
          onOpenChange={setAtTicketOpen}
          idempotencyKey={atIdempotencyKey}
          title={singleSelectedFinding.finding.title}
          firecomplyCustomerKey={firecomplyCustomerKey}
          description={[
            singleSelectedFinding.finding.detail,
            singleSelectedFinding.finding.remediation
              ? `Remediation: ${singleSelectedFinding.finding.remediation}`
              : "",
            `Firewall: ${singleSelectedFinding.label}`,
            `Severity: ${singleSelectedFinding.finding.severity}`,
          ]
            .filter(Boolean)
            .join("\n\n")}
        />
      )}

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
                    <td className="p-2 text-foreground">
                      <div className="flex flex-col gap-0.5">
                        <span>{finding.title}</span>
                        <Link
                          to={`/playbooks?highlight=${encodeURIComponent(finding.title.slice(0, 120))}`}
                          className="text-[10px] font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF] w-fit"
                        >
                          Related playbooks
                        </Link>
                      </div>
                    </td>
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
