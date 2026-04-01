import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  Wrench,
  ExternalLink,
  Settings2,
  Zap,
  ShieldOff,
  ShieldCheck,
  Download,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { AnalysisResult, Severity } from "@/lib/analyse-config";
import { generatePlaybook, type Playbook } from "@/lib/remediation-playbooks";
import { computeRiskScore } from "@/lib/risk-score";
import { useAuth } from "@/hooks/use-auth";
import { useRemediationPlaybookIdsQuery } from "@/hooks/queries/use-remediation-playbook-ids-query";
import { getFirstDetectedAtBatch } from "@/lib/finding-snapshots";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getAvailableRemediations } from "@/lib/auto-remediate";
import {
  loadAcceptedFindings,
  acceptFinding,
  unacceptFinding,
  isAccepted,
  type AcceptedFinding,
} from "@/lib/accepted-findings";
import { SEVERITY_ORDER } from "@/lib/design-tokens";
import { useRemediationDeltaMutation } from "@/hooks/queries/use-remediation-status-mutations";
import { warnOptionalError } from "@/lib/client-error-feedback";

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

function getSophosConsoleLink(findingSection: string): string {
  const linkMap: Record<string, string> = {
    "Firewall Rules": "/protect/rules/firewall",
    "NAT Rules": "/protect/rules/nat",
    "Web Filtering": "/protect/web/policies",
    IPS: "/protect/intrusion-prevention",
    "SSL/TLS Inspection": "/protect/rules/ssl-tls-inspection",
    Authentication: "/configure/authentication/services",
    "Admin Access": "/system/administration/device-access",
    VPN: "/configure/vpn",
    Wireless: "/protect/wireless",
    Logging: "/system/system-services/log-settings",
  };
  for (const [key, path] of Object.entries(linkMap)) {
    if (findingSection.toLowerCase().includes(key.toLowerCase())) return path;
  }
  return "/";
}

const SLA_STORAGE_KEY = "sophos-sla-config";

const DEFAULT_SLA_DAYS: Record<Severity, number> = {
  critical: 7,
  high: 14,
  medium: 30,
  low: 90,
  info: 90,
};

export type SlaConfig = Record<Severity, number>;

function loadSlaConfig(): SlaConfig {
  try {
    const raw = localStorage.getItem(SLA_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SLA_DAYS };
    const parsed = JSON.parse(raw) as Partial<SlaConfig>;
    return { ...DEFAULT_SLA_DAYS, ...parsed };
  } catch (e) {
    warnOptionalError("RemediationPlaybooks.loadSlaConfig", e);
    return { ...DEFAULT_SLA_DAYS };
  }
}

function saveSlaConfig(config: SlaConfig): void {
  try {
    localStorage.setItem(SLA_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    warnOptionalError("RemediationPlaybooks.saveSlaConfig", e);
  }
}

type SlaStatus = "resolved" | "breached" | "due";

function computeSlaStatus(
  firstDetectedAt: string,
  slaDays: number,
  isCompleted: boolean,
): { status: SlaStatus; daysOverdue?: number; daysUntilDue?: number } {
  const deadline = new Date(firstDetectedAt);
  deadline.setDate(deadline.getDate() + slaDays);
  const now = new Date();

  if (isCompleted) {
    return { status: "resolved" };
  }
  if (now > deadline) {
    const daysOverdue = Math.floor((now.getTime() - deadline.getTime()) / (24 * 60 * 60 * 1000));
    return { status: "breached", daysOverdue };
  }
  const daysUntilDue = Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return { status: "due", daysUntilDue };
}

const SEV_BADGE: Record<Severity, string> = {
  critical: "bg-[#EA0022]/10 text-[#EA0022] ring-[#EA0022]/20",
  high: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400] ring-[#F29400]/20",
  medium:
    "bg-[#ca8a04]/12 text-[#78350f] dark:bg-[#F8E300]/10 dark:text-[#F8E300] ring-[#ca8a04]/20 dark:ring-[#F8E300]/20",
  low: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3] ring-[#00F2B3]/20",
  info: "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB] ring-[#009CFB]/20",
};

export function RemediationPlaybooks({ analysisResults }: Props) {
  const { org } = useAuth();
  const { mutateAsync: persistRemediationRows } = useRemediationDeltaMutation();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [slaConfig, setSlaConfig] = useState<SlaConfig>(() => loadSlaConfig());
  const [firstDetectedMap, setFirstDetectedMap] = useState<Map<string, string>>(new Map());
  const [acceptedList, setAcceptedList] = useState<AcceptedFinding[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const customerHash = useMemo(() => getCustomerHash(analysisResults), [analysisResults]);

  const remediationIdsQuery = useRemediationPlaybookIdsQuery(org?.id ?? null, customerHash);

  const playbooks = useMemo(() => {
    const list: (Playbook & {
      fwLabel: string;
      findingSection: string;
      findingTitle: string;
      hostname: string;
    })[] = [];
    for (const [label, result] of Object.entries(analysisResults)) {
      const hostname = result.hostname ?? label;
      const mgmtIp = result.managementIp;
      for (const finding of result.findings) {
        const pb = generatePlaybook(finding, mgmtIp);
        if (pb)
          list.push({
            ...pb,
            fwLabel: label,
            findingSection: finding.section,
            findingTitle: finding.title,
            hostname,
          });
      }
    }
    list.sort(
      (a, b) => SEVERITY_ORDER[a.severity as Severity] - SEVERITY_ORDER[b.severity as Severity],
    );
    return list;
  }, [analysisResults]);

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = checkedIds.size > 0 && checkedIds.size < playbooks.length;
  }, [checkedIds.size, playbooks.length]);

  useEffect(() => {
    loadAcceptedFindings().then(setAcceptedList);
  }, []);

  const skipNextSaveRef = useRef(false);

  useEffect(() => {
    if (org?.id && remediationIdsQuery.isPending) return;

    if (org?.id && remediationIdsQuery.isSuccess && remediationIdsQuery.data.length > 0) {
      skipNextSaveRef.current = true;
      setCompleted(new Set(remediationIdsQuery.data));
      return;
    }

    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${customerHash}`);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) {
          skipNextSaveRef.current = true;
          setCompleted(new Set(arr));
        }
      }
    } catch (e) {
      warnOptionalError("RemediationPlaybooks.loadCompletedLocal", e);
    }
  }, [
    org?.id,
    customerHash,
    remediationIdsQuery.isPending,
    remediationIdsQuery.isSuccess,
    remediationIdsQuery.data,
  ]);

  const persistCompleted = useCallback(
    async (next: Set<string>, prev: Set<string>) => {
      const orgId = org?.id ?? null;
      if (!orgId) {
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${customerHash}`, JSON.stringify([...next]));
        } catch (e) {
          warnOptionalError("RemediationPlaybooks.persistCompletedLocal", e);
        }
        return;
      }

      const added = [...next].filter((id) => !prev.has(id));
      const removed = [...prev].filter((id) => !next.has(id));
      if (added.length === 0 && removed.length === 0) return;

      await persistRemediationRows({ orgId, customerHash, added, removed });
    },
    [customerHash, persistRemediationRows, org?.id],
  );

  // Load first-detected timestamps for SLA tracking
  useEffect(() => {
    let cancelled = false;
    const orgId = org?.id;
    if (!orgId || playbooks.length === 0) return;
    void (async () => {
      const pairs = playbooks.map((p) => ({ hostname: p.hostname, findingTitle: p.findingTitle }));
      const map = await getFirstDetectedAtBatch(orgId, pairs);
      if (!cancelled) setFirstDetectedMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [playbooks, org?.id]);

  const totalMinutes = playbooks
    .filter((p) => !completed.has(p.findingId))
    .reduce((s, p) => s + p.estimatedMinutes, 0);

  const slaStats = useMemo(() => {
    let resolvedWithinSla = 0;
    let totalWithSla = 0;
    for (const pb of playbooks) {
      const sev = pb.severity as Severity;
      if (sev === "info") continue;
      totalWithSla++;
      if (completed.has(pb.findingId)) resolvedWithinSla++;
    }
    return { resolvedWithinSla, totalWithSla };
  }, [playbooks, completed]);

  const copyConsolePath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
    toast.success("Console path copied to clipboard — paste into your Sophos XGS admin URL");
  }, []);

  if (playbooks.length === 0) {
    return (
      <EmptyState
        className="!py-10"
        icon={<Wrench className="h-6 w-6 text-muted-foreground/50" />}
        title="No remediation playbooks"
        description="There are no open findings with remediation guides for this analysis."
      />
    );
  }

  function getProjectedScore(
    pb: Playbook & { fwLabel: string },
  ): { current: number; projected: number } | null {
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markComplete = (id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (!skipNextSaveRef.current) {
        persistCompleted(next, prev);
      } else {
        skipNextSaveRef.current = false;
      }
      return next;
    });
  };

  const toggleAccept = async (findingTitle: string) => {
    if (isAccepted(acceptedList, findingTitle)) {
      await unacceptFinding(findingTitle);
      toast.info("Finding restored — it will appear in analysis views again");
    } else {
      await acceptFinding(findingTitle, "Accepted risk via remediation playbook");
      toast.success("Finding accepted — suppressed from Priority Matrix and analysis");
    }
    const updated = await loadAcceptedFindings();
    setAcceptedList(updated);
  };

  function renderSlaStatus(pb: (typeof playbooks)[0]) {
    const isDone = completed.has(pb.findingId);
    const sev = pb.severity as Severity;
    const firstAt =
      firstDetectedMap.get(`${pb.hostname}:${pb.findingTitle}`) ?? new Date().toISOString();
    const slaDays = slaConfig[sev] ?? 90;
    const { status, daysOverdue, daysUntilDue } = computeSlaStatus(firstAt, slaDays, isDone);
    if (status === "resolved") {
      return (
        <span className="text-[10px] font-medium text-[#007A5A] dark:text-[#00F2B3]">
          Resolved within SLA
        </span>
      );
    }
    if (status === "breached" && daysOverdue != null) {
      return (
        <span className="text-[10px] font-medium text-[#EA0022]">
          SLA Breached ({daysOverdue} overdue)
        </span>
      );
    }
    if (status === "due" && daysUntilDue != null) {
      return (
        <span className="text-[10px] font-medium text-[#F29400]">Due in {daysUntilDue} days</span>
      );
    }
    return null;
  }

  return (
    <section
      className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] p-5 sm:p-6 space-y-4 shadow-[0_18px_50px_rgba(32,6,247,0.08)] overflow-hidden"
      data-tour="remediation-playbooks"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
            Guided remediation
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Wrench className="h-5 w-5 text-brand-accent" />
            <h3 className="text-lg font-display font-black tracking-tight text-foreground">
              Remediation Playbooks
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {playbooks.length} playbook{playbooks.length !== 1 ? "s" : ""} &middot; Sophos XGS
              step-by-step
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Structured, engineer-friendly steps for closing findings with clear effort, SLA context,
            and Sophos console guidance.
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-2 rounded-xl border border-border/50 bg-card/70 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
                aria-label="SLA settings"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <p className="text-[10px] font-semibold text-foreground mb-2">
                SLA days per severity
              </p>
              <div className="space-y-2 text-[10px]">
                {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => (
                  <div key={sev} className="flex items-center justify-between gap-2">
                    <span className="capitalize text-muted-foreground">{sev}</span>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={slaConfig[sev]}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1 && v <= 365) {
                          const next = { ...slaConfig, [sev]: v };
                          setSlaConfig(next);
                          saveSlaConfig(next);
                        }
                      }}
                      className="w-16 h-9 rounded-lg px-2 py-1 text-right text-[11px]"
                    />
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>~{totalMinutes} min remaining</span>
          {completed.size > 0 && (
            <span className="ml-1 text-[#007A5A] dark:text-[#00F2B3] font-bold">
              {completed.size}/{playbooks.length} done
            </span>
          )}
        </div>
      </div>

      {slaStats.totalWithSla > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/70 px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-muted-foreground">SLA progress</span>
            <span className="font-medium text-foreground">
              {slaStats.resolvedWithinSla} of {slaStats.totalWithSla} findings resolved within SLA
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[#00A878] dark:bg-[#00F2B3] transition-all"
              style={{
                width: `${slaStats.totalWithSla > 0 ? (100 * slaStats.resolvedWithinSla) / slaStats.totalWithSla : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Select All header */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/50 bg-card/70 shadow-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={playbooks.length > 0 && checkedIds.size === playbooks.length}
            onChange={() => {
              if (checkedIds.size === playbooks.length) {
                setCheckedIds(new Set());
              } else {
                setCheckedIds(new Set(playbooks.map((p) => p.findingId)));
              }
            }}
            className="rounded border-border"
          />
          <span className="text-xs font-medium text-muted-foreground">Select All</span>
        </label>
      </div>

      <div className="space-y-2">
        {playbooks.map((pb) => {
          const isOpen = expanded.has(pb.findingId);
          const isDone = completed.has(pb.findingId);
          const accepted = isAccepted(acceptedList, pb.findingTitle);
          const sev = pb.severity as Severity;
          const consolePath = getSophosConsoleLink(pb.findingSection);

          return (
            <div
              key={pb.findingId}
              className={`rounded-[24px] border ${accepted ? "border-muted-foreground/20 bg-muted/[0.04] opacity-60" : isDone ? "border-[#008F69]/30 dark:border-[#00F2B3]/20 dark:border-[#008F69]/30 dark:border-[#00F2B3]/20 bg-[#00F2B3]/[0.02] dark:bg-[#00F2B3]/[0.02]" : "border-border/50 bg-card/85"} transition-colors shadow-sm`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <label className="shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(pb.findingId)}
                    onChange={(e) => {
                      e.stopPropagation();
                      setCheckedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(pb.findingId)) next.delete(pb.findingId);
                        else next.add(pb.findingId);
                        return next;
                      });
                    }}
                    className="rounded border-border"
                  />
                </label>
                <button
                  onClick={() => toggle(pb.findingId)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-medium ${accepted ? "line-through text-muted-foreground" : isDone ? "line-through text-muted-foreground" : "text-foreground"}`}
                      >
                        {pb.title}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ring-1 ${SEV_BADGE[sev]}`}
                      >
                        {sev}
                      </span>
                      {accepted && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded ring-1 ring-muted-foreground/20 bg-muted text-muted-foreground">
                          Accepted Risk
                        </span>
                      )}
                      {Object.keys(analysisResults).length > 1 && (
                        <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {pb.fwLabel}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyConsolePath(consolePath);
                        }}
                        className="inline-flex items-center gap-1 text-[9px] text-muted-foreground hover:text-[#2006F7] dark:hover:text-[#00EDFF] transition-colors"
                        title="Copy console path to clipboard"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open in Sophos console
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!accepted && sev !== "info" && renderSlaStatus(pb)}
                    {!accepted &&
                      (() => {
                        const proj = getProjectedScore(pb);
                        if (proj && proj.projected > proj.current) {
                          const diff = proj.projected - proj.current;
                          return (
                            <span className="text-[10px] font-medium text-[#007A5A] dark:text-[#00F2B3]">
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
              </div>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {accepted && (
                    <div className="ml-7 rounded-lg bg-muted/30 border border-muted-foreground/10 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        <ShieldCheck className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                        <span className="font-semibold">Risk accepted</span> — this finding is
                        suppressed from the Priority Matrix and analysis views.
                        {acceptedList.find((a) => a.findingTitle === pb.findingTitle)
                          ?.acceptedBy && (
                          <>
                            {" "}
                            by{" "}
                            {
                              acceptedList.find((a) => a.findingTitle === pb.findingTitle)!
                                .acceptedBy
                            }
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  {!accepted && (
                    <>
                      <ol className="space-y-2 ml-7">
                        {pb.steps.map((s) => {
                          const isUrl = s.path?.startsWith("https://");
                          return (
                            <li key={s.step} className="text-xs leading-relaxed">
                              <span className="inline-flex items-center justify-center h-4.5 w-4.5 rounded-full bg-brand-accent/10 text-brand-accent text-[9px] font-bold mr-2">
                                {s.step}
                              </span>
                              <span className="text-foreground">{s.action}</span>
                              {s.path && isUrl ? (
                                <a
                                  href={s.path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 ml-2 text-[10px] font-mono text-brand-accent hover:underline underline-offset-2"
                                >
                                  {s.path}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              ) : s.path ? (
                                <span className="block ml-6 mt-0.5 text-[10px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded">
                                  {s.path}
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ol>

                      <div className="ml-7 rounded-lg bg-[#2006F7]/[0.04] dark:bg-brand-accent/[0.08] border border-brand-accent/10 px-3 py-2">
                        <p className="text-[10px] text-foreground leading-relaxed">
                          <span className="font-semibold text-[#10037C] dark:text-[#009CFB]">
                            Verify:
                          </span>{" "}
                          {pb.verifyStep}
                        </p>
                      </div>

                      {pb.notes && (
                        <p className="ml-7 text-[10px] text-muted-foreground leading-relaxed italic">
                          {pb.notes}
                        </p>
                      )}
                    </>
                  )}

                  <div className="ml-7 flex items-center gap-2 flex-wrap">
                    {!accepted && getAvailableRemediations(pb.findingTitle).length > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              disabled
                              className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-md bg-muted/50 text-muted-foreground cursor-not-allowed opacity-70"
                              aria-label="Auto-fix (coming soon)"
                            >
                              <Zap className="h-3.5 w-3.5" />
                              Auto-fix
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px]">
                            <p>Coming soon — auto-remediation via Sophos Central API</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {!accepted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markComplete(pb.findingId);
                        }}
                        className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-md transition-colors ${isDone ? "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isDone ? "Completed" : "Mark as done"}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccept(pb.findingTitle);
                      }}
                      className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-md transition-colors ${accepted ? "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                    >
                      {accepted ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldOff className="h-3.5 w-3.5" />
                      )}
                      {accepted ? "Restore Finding" : "Accept Risk"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky bulk actions toolbar */}
      {checkedIds.size > 0 && (
        <div className="sticky bottom-0 left-0 right-0 -mx-5 -mb-5 mt-4 flex items-center justify-between gap-3 rounded-t-xl border-t border-border bg-card/95 backdrop-blur-sm px-5 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <span className="text-xs font-medium text-foreground">
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-brand-accent/10 text-[#2006F7] dark:bg-[#00EDFF]/10 dark:text-[#00EDFF] font-bold">
              {checkedIds.size}
            </span>{" "}
            selected
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const idsToMark = [...checkedIds];
                setCompleted((prev) => {
                  const next = new Set(prev);
                  idsToMark.forEach((id) => next.add(id));
                  if (!skipNextSaveRef.current) persistCompleted(next, prev);
                  else skipNextSaveRef.current = false;
                  return next;
                });
                setCheckedIds(new Set());
                toast.success(`Marked ${idsToMark.length} as done`);
              }}
              className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-md bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#00F2B3] dark:bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3] hover:bg-[#00F2B3]/20 dark:hover:bg-[#00F2B3]/20 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark {checkedIds.size} as Done
            </button>
            <button
              type="button"
              onClick={async () => {
                const selected = playbooks.filter((p) => checkedIds.has(p.findingId));
                for (const p of selected) {
                  await acceptFinding(p.findingTitle, "Bulk accept risk via remediation playbook");
                }
                const updated = await loadAcceptedFindings();
                setAcceptedList(updated);
                setCheckedIds(new Set());
                toast.success(
                  `Accepted risk for ${selected.length} finding${selected.length !== 1 ? "s" : ""}`,
                );
              }}
              className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              Accept Risk for {checkedIds.size}
            </button>
            <button
              type="button"
              onClick={() => {
                const selected = playbooks.filter((p) => checkedIds.has(p.findingId));
                const headers = [
                  "Finding",
                  "Severity",
                  "Firewall",
                  "Section",
                  "Est. Minutes",
                  "Status",
                ];
                const rows = selected.map((p) =>
                  [
                    `"${(p.title ?? "").replace(/"/g, '""')}"`,
                    p.severity,
                    `"${(p.fwLabel ?? "").replace(/"/g, '""')}"`,
                    `"${(p.findingSection ?? "").replace(/"/g, '""')}"`,
                    p.estimatedMinutes,
                    completed.has(p.findingId) ? "Done" : "Pending",
                  ].join(","),
                );
                const csv = [headers.join(","), ...rows].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `remediation-findings-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success(`Exported ${selected.length} findings to CSV`);
              }}
              className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export {checkedIds.size} (CSV)
            </button>
            <button
              type="button"
              onClick={() => setCheckedIds(new Set())}
              className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear Selection
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
