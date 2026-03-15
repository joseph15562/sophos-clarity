import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown, ChevronRight, Server,
  AlertTriangle, TrendingUp, TrendingDown,
  ArrowRight, Clock, Activity, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";
import type { AnalysisResult } from "@/lib/analyse-config";

type Agent = Tables<"agents">;
type Submission = Tables<"agent_submissions">;

interface AgentFleetPanelProps {
  onLoadAssessment?: (label: string, analysis: AnalysisResult, customerName: string) => void;
}

function StatusDot({ status, lastSeenAt }: { status: string; lastSeenAt: string | null }) {
  const isRecent = lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < 30 * 60 * 1000;
  const color =
    status === "online" && isRecent ? "bg-[#00995a]" :
    status === "error" ? "bg-[#EA0022]" :
    status === "online" ? "bg-[#F29400]" :
    "bg-muted-foreground/40";
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

const SEV_COLORS: Record<string, string> = {
  critical: "bg-[#EA0022]/10 text-[#EA0022]",
  high: "bg-[#F29400]/10 text-[#F29400]",
  medium: "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]",
  low: "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]",
  info: "bg-[#009CFB]/10 text-[#009CFB]",
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${SEV_COLORS[severity] ?? "bg-muted text-muted-foreground"}`}>
      {severity}
    </span>
  );
}

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const color = score >= 75 ? "#00995a" : score >= 50 ? "#F29400" : "#EA0022";
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/20" />
        <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 34 34)" />
        <text x="34" y="31" textAnchor="middle" fill={color} fontSize="16" fontWeight="700">{score}</text>
        <text x="34" y="44" textAnchor="middle" fill={color} fontSize="9" fontWeight="600">Grade {grade}</text>
      </svg>
    </div>
  );
}

function AgentSummaryCard({
  agent,
  submission,
  loadingSubmission,
  onLoadFull,
}: {
  agent: Agent;
  submission: Submission | null;
  loadingSubmission: boolean;
  onLoadFull: () => void;
}) {
  if (loadingSubmission) {
    return (
      <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading assessment…
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        No submissions yet. The agent will submit data after its first scheduled run.
      </div>
    );
  }

  const findings = (submission.findings_summary as Array<{ title: string; severity: string; confidence?: string }>) ?? [];
  const drift = submission.drift as { new?: string[]; fixed?: string[]; regressed?: string[] } | null;
  const threatStatus = submission.threat_status as Record<string, unknown> | null;
  const sevCounts: Record<string, number> = {};
  for (const f of findings) {
    sevCounts[f.severity] = (sevCounts[f.severity] ?? 0) + 1;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <ScoreGauge score={submission.overall_score} grade={submission.overall_grade} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(["critical", "high", "medium", "low"] as const).map((sev) =>
              sevCounts[sev] ? (
                <span key={sev} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SEV_COLORS[sev]}`}>
                  {sevCounts[sev]} {sev}
                </span>
              ) : null
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
                <span className="flex items-center gap-0.5 text-[9px] font-medium text-[#00995a] dark:text-[#00F2B3]">
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
                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${(threatStatus.atp as { enabled: boolean }).enabled ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]" : "bg-[#EA0022]/10 text-[#EA0022]"}`}>
                  ATP {(threatStatus.atp as { enabled: boolean }).enabled ? "ON" : "OFF"}
                </span>
              )}
              {threatStatus.mdr != null && (
                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${(threatStatus.mdr as { enabled: boolean }).enabled ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]" : "bg-muted text-muted-foreground"}`}>
                  MDR {(threatStatus.mdr as { enabled: boolean }).enabled ? "ON" : "OFF"}
                </span>
              )}
              {threatStatus.ndr != null && (
                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${(threatStatus.ndr as { enabled: boolean }).enabled ? "bg-[#009CFB]/10 text-[#009CFB]" : "bg-muted text-muted-foreground"}`}>
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
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Top Findings</p>
          <div className="space-y-0.5">
            {findings.slice(0, 5).map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
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
          <Clock className="h-2.5 w-2.5" /> {new Date(submission.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[10px] h-7"
          onClick={onLoadFull}
          disabled={!submission.full_analysis}
          title={!submission.full_analysis ? "Full analysis not yet available — the agent will include it on the next submission" : "Load into the full analysis view"}
        >
          <ArrowRight className="h-3 w-3" />
          {submission.full_analysis ? "Load Full Assessment" : "Full view pending…"}
        </Button>
      </div>
    </div>
  );
}

export function AgentFleetPanel({ onLoadAssessment }: AgentFleetPanelProps) {
  const { org, isGuest } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, Submission | null>>({});
  const [loadingSub, setLoadingSub] = useState<Record<string, boolean>>({});

  const loadAgents = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    const { data } = await supabase
      .from("agents")
      .select("*")
      .order("customer_name")
      .order("name");
    setAgents(data ?? []);
    setLoading(false);
  }, [org]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const grouped = useMemo(() => {
    const map = new Map<string, Agent[]>();
    for (const a of agents) {
      const key = a.tenant_name || "Unassigned";
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)
    );
  }, [agents]);

  useEffect(() => {
    if (grouped.length === 1) {
      setExpandedTenant(grouped[0][0]);
    }
  }, [grouped]);

  const loadSubmission = useCallback(async (agentId: string) => {
    if (submissions[agentId] !== undefined) return;
    setLoadingSub((p) => ({ ...p, [agentId]: true }));
    const { data } = await supabase
      .from("agent_submissions")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(1);
    setSubmissions((p) => ({ ...p, [agentId]: data?.[0] ?? null }));
    setLoadingSub((p) => ({ ...p, [agentId]: false }));
  }, [submissions]);

  const handleAgentClick = (agentId: string) => {
    if (expandedAgent === agentId) {
      setExpandedAgent(null);
    } else {
      setExpandedAgent(agentId);
      loadSubmission(agentId);
    }
  };

  const handleLoadFull = (agent: Agent) => {
    const sub = submissions[agent.id];
    if (!sub || !onLoadAssessment) return;
    const fullAnalysis = sub.full_analysis as unknown as AnalysisResult | null;
    if (!fullAnalysis) return;
    onLoadAssessment(
      agent.name || agent.firewall_host,
      fullAnalysis,
      sub.customer_name,
    );
  };

  if (isGuest || !org) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-3">
        <div className="h-4 bg-muted/40 rounded w-48" />
        <div className="h-12 bg-muted/40 rounded" />
        <div className="h-12 bg-muted/40 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border bg-card">
        <div className="h-6 w-6 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0">
          <Activity className="h-3 w-3 text-[#2006F7] dark:text-[#00EDFF]" />
        </div>
        <span className="text-xs font-semibold text-foreground flex-1">Connected Firewalls</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-muted text-muted-foreground">
          {agents.length} agent{agents.length !== 1 ? "s" : ""}
        </span>
      </div>

      {agents.length === 0 && (
        <div className="px-5 py-6 text-center space-y-2">
          <Server className="h-6 w-6 mx-auto text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            No agents connected yet. Register one in the{" "}
            <span className="font-semibold text-foreground">Management Panel</span> to see your firewalls here.
          </p>
        </div>
      )}

      <div className="divide-y divide-border">
        {grouped.map(([tenantName, tenantAgents]) => {
          const isOpen = expandedTenant === tenantName;
          const onlineCount = tenantAgents.filter((a) =>
            a.status === "online" && a.last_seen_at && Date.now() - new Date(a.last_seen_at).getTime() < 30 * 60 * 1000
          ).length;

          return (
            <div key={tenantName}>
              <button
                onClick={() => setExpandedTenant(isOpen ? null : tenantName)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
              >
                {isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-semibold text-foreground flex-1">{tenantName}</span>
                <span className="text-[9px] text-muted-foreground">
                  {tenantAgents.length} firewall{tenantAgents.length !== 1 ? "s" : ""}
                </span>
                {onlineCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3] font-medium">
                    {onlineCount} online
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="bg-muted/10">
                  {tenantAgents.map((agent) => {
                    const isAgentOpen = expandedAgent === agent.id;
                    return (
                      <div key={agent.id} className="border-t border-border/50">
                        <button
                          onClick={() => handleAgentClick(agent.id)}
                          className="w-full flex items-center gap-2.5 px-6 py-2 text-left hover:bg-muted/30 transition-colors"
                        >
                          <StatusDot status={agent.status} lastSeenAt={agent.last_seen_at} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium text-foreground truncate">{agent.name}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{agent.firewall_host}:{agent.firewall_port}</p>
                          </div>
                          {agent.hardware_model && (
                            <span className="text-[9px] text-muted-foreground shrink-0">{agent.hardware_model}</span>
                          )}
                          {agent.firmware_version && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#009CFB]/10 text-[#009CFB] font-semibold shrink-0">
                              {agent.firmware_version}
                            </span>
                          )}
                          {agent.last_score != null && (
                            <span className={`text-[10px] font-bold shrink-0 ${
                              agent.last_score >= 75 ? "text-[#00995a] dark:text-[#00F2B3]" :
                              agent.last_score >= 50 ? "text-[#F29400]" : "text-[#EA0022]"
                            }`}>
                              {agent.last_score}/{agent.last_grade}
                            </span>
                          )}
                          <span className="text-[9px] text-muted-foreground whitespace-nowrap shrink-0">
                            {timeAgo(agent.last_seen_at)}
                          </span>
                          <ChevronDown className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${isAgentOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isAgentOpen && (
                          <div className="px-6 pb-3 pt-1">
                            <AgentSummaryCard
                              agent={agent}
                              submission={submissions[agent.id] ?? null}
                              loadingSubmission={!!loadingSub[agent.id]}
                              onLoadFull={() => handleLoadFull(agent)}
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
