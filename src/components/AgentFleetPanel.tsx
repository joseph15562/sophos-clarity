import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrgAgentsQuery } from "@/hooks/queries/use-org-agents-query";
import { useAgentSubmissionCounts7dQuery } from "@/hooks/queries/use-agent-submission-counts-7d-query";
import { useAgentSubmissionsLatestBatchQuery } from "@/hooks/queries/use-agent-submissions-latest-batch-query";
import { queryKeys } from "@/hooks/queries/keys";
import { fetchLatestSubmissionForAgent } from "@/lib/data/agent-submissions-latest";
import {
  ChevronDown,
  ChevronRight,
  Server,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  Activity,
  Loader2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";
import type { AnalysisResult } from "@/lib/analyse-config";
import { rawConfigToSections } from "@/lib/raw-config-to-sections";
import { analyseConfig } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { getLatestConnectorVersion, isConnectorVersionOutdated } from "@/lib/connector-version";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { resolveAgentCustomerDisplayName } from "@/lib/agent-site-label";
import { isAgentFleetEligible } from "@/lib/agent-fleet-eligibility";
import {
  UNASSIGNED_AGENT_GROUP,
  agentCustomerGroupingKey,
  agentCustomerGroupTitle,
} from "@/lib/agent-customer-bucket";
import { resolveCustomerName } from "@/lib/customer-name";

type Agent = Tables<"agents">;
type Submission = Tables<"agent_submissions">;

export interface AgentMeta {
  serialNumber?: string;
  hostname?: string;
  model?: string;
  tenantName?: string;
}

interface AgentFleetPanelProps {
  onLoadAssessment?: (
    label: string,
    analysis: AnalysisResult,
    customerName: string,
    rawConfig?: Record<string, unknown>,
    agentMeta?: AgentMeta,
  ) => void;
  filterTenantName?: string;
  loadedLabels?: Set<string>;
}

function StatusDot({ status, lastSeenAt }: { status: string; lastSeenAt: string | null }) {
  const isRecent = lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < 30 * 60 * 1000;
  const color =
    status === "online" && isRecent
      ? "bg-[#00F2B3]"
      : status === "error"
        ? "bg-[#EA0022]"
        : status === "online"
          ? "bg-[#F29400]"
          : "bg-muted-foreground/40";
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`} />;
}

function timeAgo(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isAgentInError(a: Agent): boolean {
  return a.status === "error" || Boolean(a.error_message?.trim());
}

/** Not recently seen as “live” (30m), regardless of DB status. */
function isEffectivelyOffline(a: Agent): boolean {
  const recent = a.last_seen_at && Date.now() - new Date(a.last_seen_at).getTime() < 30 * 60 * 1000;
  return !(a.status === "online" && Boolean(recent));
}

type FleetFilter = "all" | "attention" | "error" | "offline" | "outdated";

const SEV_COLORS: Record<string, string> = {
  critical: "bg-[#EA0022]/10 text-[#EA0022]",
  high: "bg-[#F29400]/10 text-[#F29400]",
  medium: "bg-[#ca8a04]/12 text-[#78350f] dark:bg-[#F8E300]/10 dark:text-[#F8E300]",
  low: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]",
  info: "bg-[#009CFB]/10 text-[#009CFB]",
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${SEV_COLORS[severity] ?? "bg-muted text-muted-foreground"}`}
    >
      {severity}
    </span>
  );
}

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const color = score >= 75 ? "#00F2B3" : score >= 50 ? "#F29400" : "#EA0022";
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/20"
        />
        <circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 34 34)"
        />
        <text
          x="34"
          y="31"
          textAnchor="middle"
          fill={color}
          fontSize="16"
          fontWeight="700"
          style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}
        >
          {score}
        </text>
        <text
          x="34"
          y="44"
          textAnchor="middle"
          fill={color}
          fontSize="9"
          fontWeight="600"
          style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}
        >
          Grade {grade}
        </text>
      </svg>
    </div>
  );
}

const recomputeCache = new Map<string, { score: number; grade: string } | null>();

function recomputeFromRaw(submission: Submission): { score: number; grade: string } | null {
  const cacheKey = submission.id;
  if (recomputeCache.has(cacheKey)) return recomputeCache.get(cacheKey)!;
  const rawConfig = submission.raw_config as unknown as Record<string, unknown> | null;
  if (!rawConfig || Object.keys(rawConfig).length === 0) {
    recomputeCache.set(cacheKey, null);
    return null;
  }
  try {
    const sections = rawConfigToSections(rawConfig);
    if (Object.keys(sections).length === 0) {
      recomputeCache.set(cacheKey, null);
      return null;
    }
    const analysis = analyseConfig(sections);
    const risk = computeRiskScore(analysis);
    const result = { score: risk.overall, grade: risk.grade };
    recomputeCache.set(cacheKey, result);
    return result;
  } catch {
    recomputeCache.set(cacheKey, null);
    return null;
  }
}

function AgentSummaryCard({
  agent,
  submission,
  loadingSubmission,
  onLoadFull,
  onRequestScan,
  scanRequested,
  isLoaded,
  submissionsLast7d = 0,
}: {
  agent: Agent;
  submission: Submission | null;
  loadingSubmission: boolean;
  onLoadFull: () => void;
  onRequestScan: () => void;
  scanRequested: boolean;
  isLoaded?: boolean;
  submissionsLast7d?: number;
}) {
  const recomputed = submission ? recomputeFromRaw(submission) : null;

  if (loadingSubmission) {
    return (
      <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading assessment…
      </div>
    );
  }

  if (!submission) {
    return (
      <EmptyState
        className="py-6"
        icon={<Activity className="h-6 w-6 text-muted-foreground/50" />}
        title="No submissions yet"
        description="The agent will submit data after its first scheduled run."
        action={
          agent.status === "online" ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[10px] h-7"
              onClick={onRequestScan}
              disabled={scanRequested}
            >
              {scanRequested ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Scan Requested…
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" /> Request Scan Now
                </>
              )}
            </Button>
          ) : undefined
        }
      />
    );
  }

  const displayScore = recomputed?.score ?? submission.overall_score;
  const displayGrade = recomputed?.grade ?? submission.overall_grade;

  const findings =
    (submission.findings_summary as Array<{
      title: string;
      severity: string;
      confidence?: string;
    }>) ?? [];
  const drift = submission.drift as {
    new?: string[];
    fixed?: string[];
    regressed?: string[];
  } | null;
  const threatStatus = submission.threat_status as Record<string, unknown> | null;
  const sevCounts: Record<string, number> = {};
  for (const f of findings) {
    sevCounts[f.severity] = (sevCounts[f.severity] ?? 0) + 1;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground">
        <span className="rounded-md border border-border/60 bg-muted/30 px-2 py-1">
          Submissions (7d):{" "}
          <span className="font-semibold text-foreground">{submissionsLast7d}</span>
        </span>
        {agent.connector_version ? (
          <span className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 font-mono">
            Connector {agent.connector_version}
            {isConnectorVersionOutdated(agent.connector_version) ? (
              <span className="ml-1 font-sans font-semibold text-[#F29400]">
                · update available
              </span>
            ) : null}
          </span>
        ) : (
          <span className="rounded-md border border-dashed border-border/60 px-2 py-1 italic">
            Connector version unknown (agent not yet reporting)
          </span>
        )}
      </div>
      <div className="flex items-start gap-4">
        <ScoreGauge score={displayScore} grade={displayGrade} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(["critical", "high", "medium", "low"] as const).map((sev) =>
              sevCounts[sev] ? (
                <span
                  key={sev}
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SEV_COLORS[sev]}`}
                >
                  {sevCounts[sev]} {sev}
                </span>
              ) : null,
            )}
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {findings.length} total findings
            </span>
          </div>

          {drift && (drift.new?.length || drift.fixed?.length || drift.regressed?.length) ? (
            <div className="flex flex-wrap gap-1.5">
              {drift.new && drift.new.length > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] font-medium text-[#EA0022]">
                  <TrendingUp className="h-2.5 w-2.5" /> +{drift.new.length} new
                </span>
              )}
              {drift.fixed && drift.fixed.length > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] font-medium text-[#007A5A] dark:text-[#00F2B3]">
                  <TrendingDown className="h-2.5 w-2.5" /> -{drift.fixed.length} fixed
                </span>
              )}
              {drift.regressed && drift.regressed.length > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] font-medium text-[#F29400]">
                  <AlertTriangle className="h-2.5 w-2.5" /> {drift.regressed.length} regressed
                </span>
              )}
            </div>
          ) : null}

          {threatStatus && (
            <div className="flex flex-wrap gap-1.5">
              {threatStatus.atp != null && (
                <span
                  className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${(threatStatus.atp as { enabled: boolean }).enabled ? "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]" : "bg-[#EA0022]/10 text-[#EA0022]"}`}
                >
                  ATP {(threatStatus.atp as { enabled: boolean }).enabled ? "ON" : "OFF"}
                </span>
              )}
              {threatStatus.mdr != null && (
                <span
                  className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${(threatStatus.mdr as { enabled: boolean }).enabled ? "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]" : "bg-muted text-muted-foreground"}`}
                >
                  MDR {(threatStatus.mdr as { enabled: boolean }).enabled ? "ON" : "OFF"}
                </span>
              )}
              {threatStatus.ndr != null && (
                <span
                  className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${(threatStatus.ndr as { enabled: boolean }).enabled ? "bg-[#009CFB]/10 text-[#009CFB]" : "bg-muted text-muted-foreground"}`}
                >
                  NDR {(threatStatus.ndr as { enabled: boolean }).enabled ? "ON" : "OFF"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Top findings preview */}
      {findings.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            Top Findings
          </p>
          <div className="space-y-0.5">
            {findings.slice(0, 5).map((f, i) => (
              <div
                key={`${f.title}-${f.severity}-${i}`}
                className="flex items-center gap-2 text-[10px]"
              >
                <SeverityBadge severity={f.severity} />
                <span className="text-foreground truncate">{f.title}</span>
              </div>
            ))}
            {findings.length > 5 && (
              <p className="text-[9px] text-muted-foreground pl-1">+{findings.length - 5} more</p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />{" "}
          {new Date(submission.created_at).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[10px] h-7"
            onClick={onRequestScan}
            disabled={scanRequested}
          >
            {scanRequested ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Scan Requested…
              </>
            ) : (
              <>
                <Play className="h-3 w-3" /> Request Scan
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[10px] h-7"
            onClick={onLoadFull}
            disabled={!submission.full_analysis || isLoaded}
            title={
              isLoaded
                ? "This firewall is already loaded in the assessment"
                : !submission.full_analysis
                  ? "Full analysis not yet available — the agent will include it on the next submission"
                  : "Load into the full analysis view"
            }
          >
            <ArrowRight className="h-3 w-3" />
            {isLoaded
              ? "Already Loaded"
              : submission.full_analysis
                ? "Load Full Assessment"
                : "Full view pending…"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AgentFleetPanel({
  onLoadAssessment,
  filterTenantName,
  loadedLabels,
}: AgentFleetPanelProps) {
  const { org, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const agentsQuery = useOrgAgentsQuery(org?.id ?? null);
  const countsQuery = useAgentSubmissionCounts7dQuery(org?.id ?? null);
  const agents = agentsQuery.data ?? [];
  const fleetAgents = useMemo(() => agents.filter(isAgentFleetEligible), [agents]);
  const loading = agentsQuery.isPending;
  const submissionCounts7d = countsQuery.data ?? {};
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [submissionMap, setSubmissionMap] = useState<Record<string, Submission | null>>({});
  const [scanRequested, setScanRequested] = useState<Record<string, boolean>>({});
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>("all");
  const pollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const runNowAbortByAgentRef = useRef<Map<string, AbortController>>(new Map());
  const pollUnmountAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    pollUnmountAbortRef.current = new AbortController();
    return () => {
      for (const iv of pollIntervalsRef.current.values()) clearInterval(iv);
      pollIntervalsRef.current.clear();
      pollUnmountAbortRef.current?.abort();
      pollUnmountAbortRef.current = null;
      for (const ac of runNowAbortByAgentRef.current.values()) ac.abort();
      runNowAbortByAgentRef.current.clear();
    };
  }, []);

  const agentsForUi = useMemo(() => {
    if (fleetFilter === "all") return fleetAgents;
    if (fleetFilter === "attention") {
      return fleetAgents.filter(
        (a) =>
          a.status === "error" ||
          Boolean(a.error_message?.trim()) ||
          (a.status !== "online" && a.status !== "error"),
      );
    }
    if (fleetFilter === "error") return fleetAgents.filter(isAgentInError);
    if (fleetFilter === "offline") return fleetAgents.filter(isEffectivelyOffline);
    if (fleetFilter === "outdated") {
      return fleetAgents.filter((a) => isConnectorVersionOutdated(a.connector_version));
    }
    return fleetAgents;
  }, [fleetAgents, fleetFilter]);

  const grouped = useMemo(() => {
    const filtered = filterTenantName
      ? agentsForUi.filter((a) => {
          const gk = agentCustomerGroupingKey(a);
          const title = agentCustomerGroupTitle(gk, org?.name);
          const f = filterTenantName.trim();
          return (
            title === filterTenantName ||
            gk === filterTenantName ||
            title === resolveCustomerName(f, org?.name ?? "")
          );
        })
      : agentsForUi;
    const map = new Map<string, Agent[]>();
    for (const a of filtered) {
      const key = agentCustomerGroupingKey(a);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a === UNASSIGNED_AGENT_GROUP ? 1 : b === UNASSIGNED_AGENT_GROUP ? -1 : a.localeCompare(b),
    );
  }, [agentsForUi, filterTenantName, org?.name]);

  useEffect(() => {
    if (grouped.length === 1) {
      setExpandedTenant(grouped[0][0]);
    }
  }, [grouped]);

  const idsToFetch = useMemo(() => {
    const ids = new Set<string>();
    if (expandedTenant) {
      const tenantAgents = grouped.find(([name]) => name === expandedTenant)?.[1] ?? [];
      for (const a of tenantAgents) {
        if (submissionMap[a.id] === undefined) ids.add(a.id);
      }
    }
    if (expandedAgent && submissionMap[expandedAgent] === undefined) {
      ids.add(expandedAgent);
    }
    return [...ids].sort();
  }, [expandedTenant, expandedAgent, grouped, submissionMap]);

  const submissionsBatchQuery = useAgentSubmissionsLatestBatchQuery(org?.id ?? null, idsToFetch);

  useEffect(() => {
    if (!submissionsBatchQuery.data) return;
    setSubmissionMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [agentId, row] of Object.entries(submissionsBatchQuery.data)) {
        if (next[agentId] === undefined) {
          next[agentId] = row;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [submissionsBatchQuery.data]);

  const loadingSub = useMemo(() => {
    const fetching = submissionsBatchQuery.isFetching;
    const out: Record<string, boolean> = {};
    if (!fetching) return out;
    for (const id of idsToFetch) {
      if (submissionMap[id] === undefined) out[id] = true;
    }
    return out;
  }, [submissionsBatchQuery.isFetching, idsToFetch, submissionMap]);

  const handleAgentClick = (agentId: string) => {
    if (expandedAgent === agentId) {
      setExpandedAgent(null);
    } else {
      setExpandedAgent(agentId);
    }
  };

  const handleRequestScan = async (agentId: string) => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      setScanRequested((p) => ({ ...p, [agentId]: true }));

      runNowAbortByAgentRef.current.get(agentId)?.abort();
      const runAc = new AbortController();
      runNowAbortByAgentRef.current.set(agentId, runAc);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/agent/${agentId}/run-now`,
        {
          method: "POST",
          signal: runAc.signal,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setScanRequested((p) => ({ ...p, [agentId]: false }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      toast.success("Scan requested — waiting for agent to complete…");

      const existingTs = submissionMap[agentId]?.created_at;
      let attempts = 0;
      const maxAttempts = 36; // 3 minutes at 5s intervals
      const orgId = org?.id;
      if (!orgId) {
        setScanRequested((p) => ({ ...p, [agentId]: false }));
        return;
      }

      const prevIv = pollIntervalsRef.current.get(agentId);
      if (prevIv) clearInterval(prevIv);

      const pollInterval = setInterval(() => {
        void (async () => {
          attempts++;
          let latest: Submission | null = null;
          try {
            latest = await fetchLatestSubmissionForAgent(
              orgId,
              agentId,
              pollUnmountAbortRef.current?.signal,
            );
          } catch {
            return;
          }
          if (latest && latest.created_at !== existingTs) {
            clearInterval(pollInterval);
            pollIntervalsRef.current.delete(agentId);
            setSubmissionMap((p) => ({ ...p, [agentId]: latest }));
            setScanRequested((p) => ({ ...p, [agentId]: false }));
            toast.success(`Scan complete — Score: ${latest.overall_score}/${latest.overall_grade}`);
            if (org?.id) {
              void queryClient.invalidateQueries({ queryKey: queryKeys.org.agents(org.id) });
              void queryClient.invalidateQueries({
                queryKey: queryKeys.org.agentSubmissionCounts7d(org.id),
              });
              void queryClient.invalidateQueries({
                queryKey: ["org", org.id, "agent_submissions_latest_batch"] as const,
              });
            }
            return;
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            pollIntervalsRef.current.delete(agentId);
            setScanRequested((p) => ({ ...p, [agentId]: false }));
            toast.info("Scan is taking longer than expected — refresh the page to check results");
          }
        })();
      }, 5000);
      pollIntervalsRef.current.set(agentId, pollInterval);
    } catch (err) {
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (aborted) {
        setScanRequested((p) => ({ ...p, [agentId]: false }));
        return;
      }
      toast.error(err instanceof Error ? err.message : "Request failed");
    }
  };

  const handleLoadFull = (agent: Agent) => {
    const sub = submissionMap[agent.id];
    if (!sub || !onLoadAssessment) return;
    const fullAnalysis = sub.full_analysis as unknown as AnalysisResult | null;
    if (!fullAnalysis) return;
    const rawConfig = sub.raw_config as unknown as Record<string, unknown> | null;
    const displayName = resolveAgentCustomerDisplayName(agent, sub.customer_name);
    onLoadAssessment(
      agent.name || agent.firewall_host,
      fullAnalysis,
      displayName,
      rawConfig ?? undefined,
      {
        serialNumber: agent.serial_number ?? undefined,
        hostname: agent.firewall_host,
        model: agent.hardware_model ?? undefined,
        tenantName: agent.tenant_name ?? undefined,
      },
    );
  };

  if (isGuest || !org) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4 animate-pulse space-y-3">
        <div className="h-4 bg-muted/40 rounded w-48" />
        <div className="h-12 bg-muted/40 rounded" />
        <div className="h-12 bg-muted/40 rounded" />
      </div>
    );
  }

  const onlineAgents = agentsForUi.filter(
    (a) =>
      a.status === "online" &&
      a.last_seen_at &&
      Date.now() - new Date(a.last_seen_at).getTime() < 30 * 60 * 1000,
  ).length;

  return (
    <div
      className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(12,18,34,0.98),rgba(10,14,26,0.98))] overflow-hidden shadow-[0_16px_45px_rgba(32,6,247,0.08)]"
      data-tour="agent-fleet"
    >
      <div className="px-5 py-4 border-b border-border/50 bg-card/70">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-brand-accent/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0">
              <Activity className="h-4 w-4 text-brand-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent mb-1">
                Live managed estate
              </p>
              <h4 className="text-base font-display font-black text-foreground tracking-tight">
                Connected Firewalls
              </h4>
              <p className="text-sm font-medium text-foreground/80 dark:text-white/75 mt-1 max-w-2xl leading-relaxed">
                <span className="text-brand-accent font-semibold">
                  Load fresh assessments from connected agents
                </span>
                , compare customer sites side-by-side, and{" "}
                <span className="text-foreground dark:text-white font-semibold">
                  refresh posture without waiting for manual exports
                </span>
                .
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-muted text-muted-foreground">
              {agentsForUi.length} agent{agentsForUi.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]">
              {onlineAgents} online
            </span>
            <Button
              type="button"
              variant={fleetFilter === "all" ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => setFleetFilter("all")}
            >
              All
            </Button>
            <Button
              type="button"
              variant={fleetFilter === "attention" ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => setFleetFilter("attention")}
            >
              Needs attention
            </Button>
            <Button
              type="button"
              variant={fleetFilter === "error" ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => setFleetFilter("error")}
            >
              Errors
            </Button>
            <Button
              type="button"
              variant={fleetFilter === "offline" ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => setFleetFilter("offline")}
            >
              Offline
            </Button>
            <Button
              type="button"
              variant={fleetFilter === "outdated" ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-[10px]"
              title={`Latest connector: ${getLatestConnectorVersion()} (set VITE_CONNECTOR_VERSION_LATEST)`}
              onClick={() => setFleetFilter("outdated")}
            >
              Outdated
            </Button>
          </div>
        </div>
      </div>

      {agentsForUi.length === 0 && fleetAgents.length > 0 && fleetFilter !== "all" && (
        <EmptyState
          className="py-8 px-6"
          title="No agents match this filter"
          description="Try showing all firewalls or pick a different filter."
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setFleetFilter("all")}>
              Show all
            </Button>
          }
        />
      )}

      {agents.length === 0 && (
        <EmptyState
          className="py-8 px-6"
          icon={<Server className="h-6 w-6 text-muted-foreground/50" />}
          title="No connected firewalls yet"
          description="Register an agent in the Management Panel to turn one-off reviews into a continuous managed assessment workflow."
        />
      )}

      {agents.length > 0 && fleetAgents.length === 0 && (
        <EmptyState
          className="py-8 px-6"
          icon={<Server className="h-6 w-6 text-muted-foreground/50" />}
          title="Connector setup in progress"
          description="This list appears after the connector successfully reaches your firewall (serial or firmware is reported). Finish the connector wizard and API test, or open Management to review the registered agent."
        />
      )}

      <div className="divide-y divide-border">
        {grouped.map(([groupKey, tenantAgents]) => {
          const isOpen = expandedTenant === groupKey;
          const groupTitle = agentCustomerGroupTitle(groupKey, org?.name);
          const onlineCount = tenantAgents.filter(
            (a) =>
              a.status === "online" &&
              a.last_seen_at &&
              Date.now() - new Date(a.last_seen_at).getTime() < 30 * 60 * 1000,
          ).length;

          return (
            <div key={groupKey}>
              <button
                onClick={() => setExpandedTenant(isOpen ? null : groupKey)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-semibold text-foreground flex-1">
                  {groupTitle}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {tenantAgents.length} firewall{tenantAgents.length !== 1 ? "s" : ""}
                </span>
                {onlineCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3] font-medium">
                    {onlineCount} online
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="bg-muted/10">
                  {tenantAgents.map((agent) => {
                    const isAgentOpen = expandedAgent === agent.id;
                    const sub = submissionMap[agent.id];
                    const recomputed = sub ? recomputeFromRaw(sub) : null;
                    const headerScore = recomputed?.score ?? agent.last_score;
                    const headerGrade = recomputed?.grade ?? agent.last_grade;
                    const agentLabel = agent.name || agent.firewall_host;
                    const isLoaded = loadedLabels?.has(agentLabel) ?? false;
                    return (
                      <div
                        key={agent.id}
                        className={`border-t border-border/50 ${isLoaded ? "opacity-50" : ""}`}
                      >
                        <button
                          onClick={() => handleAgentClick(agent.id)}
                          className="w-full flex items-center gap-2.5 px-6 py-2 text-left hover:bg-muted/30 transition-colors"
                        >
                          <StatusDot status={agent.status} lastSeenAt={agent.last_seen_at} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium text-foreground truncate">
                              {agent.name}
                            </p>
                            <p className="text-[9px] text-muted-foreground truncate">
                              {agent.firewall_host}:{agent.firewall_port}
                            </p>
                          </div>
                          {isLoaded && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3] font-bold shrink-0">
                              ✓ Loaded
                            </span>
                          )}
                          {agent.hardware_model && (
                            <span className="text-[9px] text-muted-foreground shrink-0">
                              {agent.hardware_model}
                            </span>
                          )}
                          {agent.connector_version && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                                isConnectorVersionOutdated(agent.connector_version)
                                  ? "bg-[#F29400]/15 text-[#F29400]"
                                  : "bg-muted text-muted-foreground"
                              }`}
                              title="Connector package version"
                            >
                              c:{agent.connector_version}
                            </span>
                          )}
                          {agent.firmware_version && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#009CFB]/10 text-[#009CFB] font-semibold shrink-0">
                              {agent.firmware_version}
                            </span>
                          )}
                          {headerScore != null && (
                            <span
                              className={`text-[10px] font-bold shrink-0 ${
                                headerScore >= 75
                                  ? "text-[#007A5A] dark:text-[#00F2B3]"
                                  : headerScore >= 50
                                    ? "text-[#F29400]"
                                    : "text-[#EA0022]"
                              }`}
                            >
                              {headerScore}/{headerGrade}
                            </span>
                          )}
                          <span className="text-[9px] text-muted-foreground whitespace-nowrap shrink-0">
                            {timeAgo(agent.last_seen_at)}
                          </span>
                          <ChevronDown
                            className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${isAgentOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {isAgentOpen && (
                          <div className="px-6 pb-3 pt-1">
                            <AgentSummaryCard
                              agent={agent}
                              submission={submissionMap[agent.id] ?? null}
                              loadingSubmission={!!loadingSub[agent.id]}
                              onLoadFull={() => handleLoadFull(agent)}
                              onRequestScan={() => handleRequestScan(agent.id)}
                              scanRequested={!!scanRequested[agent.id]}
                              isLoaded={isLoaded}
                              submissionsLast7d={submissionCounts7d[agent.id] ?? 0}
                            />
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
    </div>
  );
}
