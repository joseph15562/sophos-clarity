import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight, Clock, CheckCircle2, Wrench } from "lucide-react";
import type { AnalysisResult, Severity } from "@/lib/analyse-config";
import { generatePlaybook, type Playbook } from "@/lib/remediation-playbooks";
import { computeRiskScore } from "@/lib/risk-score";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

const STORAGE_PREFIX = "firecomply_remediation_";

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = ((h << 5) - h + c) | 0;
  }
  return Math.abs(h).toString(36);
}

function getCustomerHash(analysisResults: Record<string, AnalysisResult>): string {
  const ids: string[] = [];
  for (const result of Object.values(analysisResults)) {
    for (const f of result.findings) ids.push(f.id);
  }
  ids.sort();
  return simpleHash(ids.join(","));
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const SEV_BADGE: Record<Severity, string> = {
  critical: "bg-[#EA0022]/10 text-[#EA0022] ring-[#EA0022]/20",
  high: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400] ring-[#F29400]/20",
  medium: "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300] ring-[#F8E300]/20",
  low: "bg-[#00F2B3]/10 text-[#00995a] dark:text-[#00F2B3] ring-[#00F2B3]/20",
  info: "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB] ring-[#009CFB]/20",
};

export function RemediationPlaybooks({ analysisResults }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const customerHash = useMemo(() => getCustomerHash(analysisResults), [analysisResults]);
  const storageKey = `${STORAGE_PREFIX}${customerHash}`;

  const skipNextSaveRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) {
          skipNextSaveRef.current = true;
          setCompleted(new Set(arr));
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [storageKey]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify([...completed]));
    } catch {
      // ignore quota errors
    }
  }, [storageKey, completed]);

  const playbooks: (Playbook & { fwLabel: string })[] = [];
  for (const [label, result] of Object.entries(analysisResults)) {
    for (const finding of result.findings) {
      const pb = generatePlaybook(finding);
      if (pb) playbooks.push({ ...pb, fwLabel: label });
    }
  }

  playbooks.sort((a, b) => SEVERITY_ORDER[a.severity as Severity] - SEVERITY_ORDER[b.severity as Severity]);

  if (playbooks.length === 0) return null;

  const totalMinutes = playbooks.filter((p) => !completed.has(p.findingId)).reduce((s, p) => s + p.estimatedMinutes, 0);

  function getProjectedScore(pb: Playbook & { fwLabel: string }): { current: number; projected: number } | null {
    const result = analysisResults[pb.fwLabel];
    if (!result) return null;
    const current = computeRiskScore(result).overall;
    const modified: AnalysisResult = {
      ...result,
      findings: result.findings.filter((f) => f.id !== pb.findingId),
    };
    const projected = computeRiskScore(modified).overall;
    return { current, projected };
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const markComplete = (id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-[#2006F7] dark:text-[#00EDFF]" />
          <h3 className="text-sm font-semibold text-foreground">Remediation Playbooks</h3>
          <span className="text-[10px] text-muted-foreground">
            {playbooks.length} playbook{playbooks.length !== 1 ? "s" : ""} &middot; Sophos XGS step-by-step
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>~{totalMinutes} min remaining</span>
          {completed.size > 0 && (
            <span className="ml-1 text-[#00995a] dark:text-[#00F2B3] font-bold">{completed.size}/{playbooks.length} done</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {playbooks.map((pb) => {
          const isOpen = expanded.has(pb.findingId);
          const isDone = completed.has(pb.findingId);
          const sev = pb.severity as Severity;

          return (
            <div key={pb.findingId} className={`rounded-lg border ${isDone ? "border-[#00995a]/20 dark:border-[#00F2B3]/20 bg-[#00995a]/[0.02] dark:bg-[#00F2B3]/[0.02]" : "border-border bg-card"} transition-colors`}>
              <button
                onClick={() => toggle(pb.findingId)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                {isOpen
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{pb.title}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ring-1 ${SEV_BADGE[sev]}`}>{sev}</span>
                    {Object.keys(analysisResults).length > 1 && (
                      <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{pb.fwLabel}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(() => {
                    const proj = getProjectedScore(pb);
                    if (proj && proj.projected > proj.current) {
                      const diff = proj.projected - proj.current;
                      return (
                        <span className="text-[10px] font-medium text-[#00995a] dark:text-[#00F2B3]">
                          Score: {proj.current} → {proj.projected} (+{diff})
                        </span>
                      );
                    }
                    return null;
                  })()}
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {pb.estimatedMinutes}m
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <ol className="space-y-2 ml-7">
                    {pb.steps.map((s) => (
                      <li key={s.step} className="text-xs leading-relaxed">
                        <span className="inline-flex items-center justify-center h-4.5 w-4.5 rounded-full bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF] text-[9px] font-bold mr-2">{s.step}</span>
                        <span className="text-foreground">{s.action}</span>
                        {s.path && (
                          <span className="block ml-6 mt-0.5 text-[10px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded">{s.path}</span>
                        )}
                      </li>
                    ))}
                  </ol>

                  <div className="ml-7 rounded-lg bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08] border border-[#2006F7]/10 px-3 py-2">
                    <p className="text-[10px] text-foreground leading-relaxed">
                      <span className="font-semibold text-[#10037C] dark:text-[#009CFB]">Verify:</span> {pb.verifyStep}
                    </p>
                  </div>

                  {pb.notes && (
                    <p className="ml-7 text-[10px] text-muted-foreground leading-relaxed italic">{pb.notes}</p>
                  )}

                  <div className="ml-7">
                    <button
                      onClick={(e) => { e.stopPropagation(); markComplete(pb.findingId); }}
                      className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-md transition-colors ${isDone ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isDone ? "Completed" : "Mark as done"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
