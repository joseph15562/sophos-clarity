import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plug,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Server,
  Key,
  Play,
  Link2,
  Unlink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAbortableInFlight } from "@/hooks/use-abortable-in-flight";
import { queryKeys } from "@/hooks/queries";
import { EmptyState } from "@/components/EmptyState";
import { agentSiteLabelForList } from "@/lib/agent-site-label";
import { displayCustomerNameForUi } from "@/lib/sophos-central";
import {
  UNASSIGNED_AGENT_GROUP,
  agentCustomerGroupingKey,
  agentCustomerGroupTitle,
} from "@/lib/agent-customer-bucket";
import { loadOrgResolvedCustomerNames } from "@/lib/org-customer-names";

type Agent = Tables<"agents">;
type Submission = Tables<"agent_submissions">;

const SCHEDULE_OPTIONS = [
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 */12 * * *", label: "Every 12 hours" },
  { value: "0 2 * * *", label: "Daily (02:00)" },
  { value: "0 2 * * 1", label: "Weekly (Mon 02:00)" },
];

const RETENTION_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "1 year" },
];

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
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function FirmwareBadge({ version }: { version: string | null }) {
  if (!version) return <span className="text-[9px] text-muted-foreground">Unknown</span>;
  const major = parseFloat(version.replace(/^v/i, ""));
  const color =
    major >= 21.5
      ? "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]"
      : major >= 21
        ? "bg-[#009CFB]/10 text-[#009CFB]"
        : major >= 19
          ? "bg-[#F29400]/10 text-[#F29400]"
          : "bg-brand-accent/[0.06] text-muted-foreground";
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${color}`}>{version}</span>
  );
}

function timeAgo(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function RegisterDialog({
  open,
  onClose,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const [name, setName] = useState("");
  const [firewallHost, setFirewallHost] = useState("");
  const [firewallPort, setFirewallPort] = useState("4444");
  const [customerName, setCustomerName] = useState("");
  const [environment, setEnvironment] = useState("");
  const [schedule, setSchedule] = useState("0 2 * * *");
  const [serialNumber, setSerialNumber] = useState("");
  const [hardwareModel, setHardwareModel] = useState("");
  const [fwOverride, setFwOverride] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const nextMutationSignal = useAbortableInFlight();

  const handleSubmit = async () => {
    if (!name.trim() || !firewallHost.trim()) return;
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/agent/register`,
        {
          method: "POST",
          signal: nextMutationSignal(),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            name: name.trim(),
            firewall_host: firewallHost.trim(),
            firewall_port: parseInt(firewallPort) || 4444,
            customer_name: customerName.trim() || undefined,
            environment: environment.trim() || undefined,
            schedule_cron: schedule,
            serial_number: serialNumber.trim() || undefined,
            hardware_model: hardwareModel.trim() || undefined,
            firmware_version_override: fwOverride.trim() || undefined,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Registration failed");
      }

      const data = await res.json();
      setGeneratedKey(data.api_key);
      toast.success("Agent registered");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    const wasRegistered = !!generatedKey;
    setName("");
    setFirewallHost("");
    setFirewallPort("4444");
    setCustomerName("");
    setEnvironment("");
    setSchedule("0 2 * * *");
    setSerialNumber("");
    setHardwareModel("");
    setFwOverride("");
    setGeneratedKey(null);
    setCopied(false);
    onClose();
    if (wasRegistered) onRegistered();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.98),rgba(14,20,34,0.98))] shadow-[0_24px_60px_rgba(32,6,247,0.12)] w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#5A00FF] to-[#00EDFF] flex items-center justify-center shrink-0">
                <Key className="h-3.5 w-3.5 text-white" />
              </div>
              <h3 className="text-sm font-display tracking-tight font-bold text-foreground">
                Register Agent
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground text-lg"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          {generatedKey ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-[#00F2B3]/[0.06] border border-[#00F2B3]/15 p-4">
                <p className="text-[11px] font-display font-semibold text-[#007A5A] dark:text-[#00F2B3] mb-2">
                  API Key Generated
                </p>
                <p className="text-[10px] text-muted-foreground/70 mb-2">
                  Paste this key into the FireComply Connector app during setup. This key will not
                  be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[10px] bg-background/60 dark:bg-background/30 rounded-lg px-3 py-2 border border-brand-accent/15 font-mono break-all select-all">
                    {generatedKey}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-[#00F2B3]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              <Button onClick={handleClose} className="w-full text-[11px] h-8">
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-foreground block mb-1">
                  Agent Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HQ Primary Agent"
                  className="h-8 text-[11px]"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-medium text-foreground block mb-1">
                    Firewall IP / Hostname *
                  </label>
                  <Input
                    value={firewallHost}
                    onChange={(e) => setFirewallHost(e.target.value)}
                    placeholder="192.168.1.1"
                    className="h-8 text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-foreground block mb-1">Port</label>
                  <Input
                    value={firewallPort}
                    onChange={(e) => setFirewallPort(e.target.value)}
                    placeholder="4444"
                    className="h-8 text-[11px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-foreground block mb-1">
                    Customer site label
                  </label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Acme Corp"
                    className="h-8 text-[11px]"
                  />
                  <p className="text-[9px] text-muted-foreground/80 mt-1 leading-snug">
                    Site or location only (shown next to the connector in Management and fleet).
                    When Sophos Central is linked, this does not create a separate customer — the
                    Central tenant still groups assessments. Optional; you can change it anytime
                    under the agent.
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-foreground block mb-1">
                    Environment
                  </label>
                  <Input
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    placeholder="Production"
                    className="h-8 text-[11px]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-foreground block mb-1">
                  Schedule
                </label>
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="w-full rounded-xl border border-brand-accent/15 bg-brand-accent/[0.04] dark:bg-brand-accent/[0.08] px-3 py-2 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent/30 transition-all"
                >
                  {SCHEDULE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight
                  className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                />
                Advanced
              </button>

              {showAdvanced && (
                <div className="space-y-2 pl-3 border-l-2 border-brand-accent/15">
                  <div>
                    <label className="text-[10px] font-medium text-foreground block mb-1">
                      Serial Number
                    </label>
                    <Input
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      placeholder="Optional"
                      className="h-7 text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-foreground block mb-1">
                      Hardware Model
                    </label>
                    <Input
                      value={hardwareModel}
                      onChange={(e) => setHardwareModel(e.target.value)}
                      placeholder="e.g. XGS 2300"
                      className="h-7 text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-foreground block mb-1">
                      Firmware Version Override
                    </label>
                    <Input
                      value={fwOverride}
                      onChange={(e) => setFwOverride(e.target.value)}
                      placeholder="e.g. 2200.1"
                      className="h-7 text-[10px]"
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={loading || !name.trim() || !firewallHost.trim()}
                className="w-full text-[11px] h-8 gap-1.5"
              >
                {loading ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Key className="h-3 w-3" />
                )}
                {loading ? "Registering…" : "Register Agent"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentManager() {
  const { org, canManageAgents, canManageTeam } = useAuth();
  const queryClient = useQueryClient();
  const pollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const runNowAbortByAgentRef = useRef<Map<string, AbortController>>(new Map());
  const agentOpAbortByAgentRef = useRef<Map<string, AbortController>>(new Map());
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
      for (const ac of agentOpAbortByAgentRef.current.values()) ac.abort();
      agentOpAbortByAgentRef.current.clear();
    };
  }, []);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>({});
  const [retention, setRetention] = useState(90);
  const [scanRequested, setScanRequested] = useState<Record<string, boolean>>({});
  const [siteLabelDraft, setSiteLabelDraft] = useState("");
  const [siteLabelSaving, setSiteLabelSaving] = useState(false);
  const [assignedCustomerDraft, setAssignedCustomerDraft] = useState("");
  const [assignedCustomerSaving, setAssignedCustomerSaving] = useState(false);
  const [customerNameOptions, setCustomerNameOptions] = useState<string[]>([]);

  const loadAgents = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    const { data } = await supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: false });
    setAgents(data ?? []);
    setLoading(false);
  }, [org]);

  const loadRetention = useCallback(async () => {
    if (!org) return;
    const { data } = await supabase
      .from("organisations")
      .select("submission_retention_days")
      .eq("id", org.id)
      .single();
    if (data) setRetention(data.submission_retention_days);
  }, [org]);

  useEffect(() => {
    loadAgents();
    loadRetention();
  }, [loadAgents, loadRetention]);

  useEffect(() => {
    if (!org) {
      setCustomerNameOptions([]);
      return;
    }
    void loadOrgResolvedCustomerNames(org.id, org.name ?? "").then(setCustomerNameOptions);
  }, [org?.id, org?.name]);

  const loadSubmissionsBatch = useCallback(async (agentIds: string[]) => {
    const unique = [...new Set(agentIds)];
    let toFetch: string[] = [];
    setSubmissions((prev) => {
      toFetch = unique.filter((id) => prev[id] === undefined);
      return prev;
    });
    if (toFetch.length === 0) return;

    const { data } = await supabase
      .from("agent_submissions")
      .select("*")
      .in("agent_id", toFetch)
      .order("created_at", { ascending: false });

    const byAgent = new Map<string, Submission[]>();
    for (const row of data ?? []) {
      const arr = byAgent.get(row.agent_id) ?? [];
      if (arr.length < 10) {
        arr.push(row);
        byAgent.set(row.agent_id, arr);
      }
    }

    setSubmissions((prev) => {
      const n = { ...prev };
      for (const id of toFetch) {
        if (n[id] === undefined) n[id] = byAgent.get(id) ?? [];
      }
      return n;
    });
  }, []);

  const handleExpand = (agentId: string) => {
    if (expanded === agentId) {
      setExpanded(null);
    } else {
      setExpanded(agentId);
      const ag = agents.find((a) => a.id === agentId);
      setSiteLabelDraft(ag && ag.customer_name !== "Unnamed" ? ag.customer_name : "");
      setAssignedCustomerDraft((ag?.assigned_customer_name ?? "").trim());
      if (submissions[agentId] === undefined) void loadSubmissionsBatch([agentId]);
    }
  };

  const handlePatchAgent = async (
    agentId: string,
    body: {
      customer_name?: string | null;
      assigned_customer_name?: string | null;
      name?: string;
      environment?: string | null;
    },
  ) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      toast.error("Not authenticated");
      return false;
    }

    agentOpAbortByAgentRef.current.get(agentId)?.abort();
    const ac = new AbortController();
    agentOpAbortByAgentRef.current.set(agentId, ac);

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/agent/${agentId}`,
      {
        method: "PATCH",
        signal: ac.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Update failed" }));
      toast.error(err.error ?? `HTTP ${res.status}`);
      agentOpAbortByAgentRef.current.delete(agentId);
      return false;
    }

    agentOpAbortByAgentRef.current.delete(agentId);
    toast.success("Agent updated");
    loadAgents();
    return true;
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm("Delete this agent and all its submissions?")) return;
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      agentOpAbortByAgentRef.current.get(agentId)?.abort();
      const delAc = new AbortController();
      agentOpAbortByAgentRef.current.set(agentId, delAc);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/agent/${agentId}`,
        {
          method: "DELETE",
          signal: delAc.signal,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      toast.success("Agent deleted");
      setExpanded(null);
      loadAgents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleRunNow = async (agentId: string) => {
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

      const prevIv = pollIntervalsRef.current.get(agentId);
      if (prevIv) clearInterval(prevIv);

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        const { data: agentData } = await supabase
          .from("agents")
          .select("last_seen_at, last_score, last_grade, pending_command")
          .eq("id", agentId)
          .maybeSingle();

        if (agentData && !agentData.pending_command) {
          clearInterval(pollInterval);
          pollIntervalsRef.current.delete(agentId);
          setScanRequested((p) => ({ ...p, [agentId]: false }));
          toast.success(`Scan complete — Score: ${agentData.last_score}/${agentData.last_grade}`);
          loadAgents();
          return;
        }

        if (attempts >= 36) {
          clearInterval(pollInterval);
          pollIntervalsRef.current.delete(agentId);
          setScanRequested((p) => ({ ...p, [agentId]: false }));
          toast.info("Scan is taking longer than expected — refresh to check results");
        }
      }, 5000);
      pollIntervalsRef.current.set(agentId, pollInterval);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    }
  };

  const retentionMutation = useMutation({
    mutationFn: async (days: number) => {
      if (!org) throw new Error("No organisation");
      const { error } = await supabase
        .from("organisations")
        .update({ submission_retention_days: days })
        .eq("id", org.id);
      if (error) throw error;
      return days;
    },
    onSuccess: (days) => {
      setRetention(days);
      toast.success(`Retention set to ${days} days`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.org.all });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Update failed");
    },
  });

  const handleRetentionChange = (days: number) => {
    retentionMutation.mutate(days);
  };

  if (loading && !showRegister) {
    return (
      <div className="space-y-3 p-4 animate-pulse">
        <div className="h-4 bg-brand-accent/[0.06] dark:bg-brand-accent/[0.08] rounded-lg w-3/4" />
        <div className="h-20 bg-brand-accent/[0.04] dark:bg-brand-accent/[0.06] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-tour="connector-section">
      <RegisterDialog
        open={showRegister}
        onClose={() => setShowRegister(false)}
        onRegistered={loadAgents}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#5A00FF] to-[#00EDFF] flex items-center justify-center shrink-0">
            <Plug className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-display font-semibold tracking-tight text-foreground">
              Connector Agents
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {agents.length} agent{agents.length !== 1 ? "s" : ""} registered
            </p>
          </div>
        </div>
        {canManageAgents && (
          <Button
            size="sm"
            onClick={() => setShowRegister(true)}
            className="gap-1.5 text-[10px] h-8 rounded-xl bg-gradient-to-r from-[#5A00FF] to-[#2006F7] text-white hover:opacity-90 border-0 shadow-sm"
            data-tour="connector-register"
          >
            <Plus className="h-3 w-3" />
            Register Agent
          </Button>
        )}
      </div>

      {/* Agent list grouped by tenant */}
      {agents.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-brand-accent/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))]">
          <EmptyState
            className="py-8"
            icon={<Plug className="h-8 w-8 text-brand-accent/40" />}
            title="No agents registered"
            description="Register an agent to start automated firewall monitoring."
            action={
              canManageAgents ? (
                <Button
                  size="sm"
                  onClick={() => setShowRegister(true)}
                  className="gap-1.5 text-[10px] h-8 rounded-xl bg-gradient-to-r from-[#5A00FF] to-[#2006F7] text-white hover:opacity-90 border-0 shadow-sm"
                  data-tour="connector-register"
                >
                  <Plus className="h-3 w-3" /> Register Agent
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {(() => {
            const grouped = new Map<string, Agent[]>();
            for (const a of agents) {
              const key = agentCustomerGroupingKey(a);
              const list = grouped.get(key) ?? [];
              list.push(a);
              grouped.set(key, list);
            }
            const sorted = Array.from(grouped.entries()).sort(([a], [b]) =>
              a === UNASSIGNED_AGENT_GROUP
                ? 1
                : b === UNASSIGNED_AGENT_GROUP
                  ? -1
                  : a.localeCompare(b),
            );

            return sorted.map(([groupKey, tenantAgents]) => {
              const tenantTitle = agentCustomerGroupTitle(groupKey, org?.name);
              const onlineCount = tenantAgents.filter(
                (a) =>
                  a.status === "online" &&
                  a.last_seen_at &&
                  Date.now() - new Date(a.last_seen_at).getTime() < 30 * 60 * 1000,
              ).length;
              const anyCentralLinked = tenantAgents.some((a) => Boolean(a.tenant_name?.trim()));

              return (
                <div
                  key={groupKey}
                  className="rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_8px_30px_rgba(32,6,247,0.05)] overflow-hidden"
                >
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-brand-accent/[0.03] dark:bg-brand-accent/[0.06] border-b border-brand-accent/10">
                    <Server className="h-3.5 w-3.5 text-brand-accent/50 shrink-0" />
                    <span className="text-[10px] font-display font-semibold text-foreground flex-1">
                      {tenantTitle}
                    </span>
                    {anyCentralLinked ? (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3] font-semibold flex items-center gap-1">
                        <Link2 className="h-2.5 w-2.5" /> Central Linked
                      </span>
                    ) : (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-brand-accent/[0.06] text-muted-foreground font-semibold flex items-center gap-1">
                        <Unlink className="h-2.5 w-2.5" /> Not Linked
                      </span>
                    )}
                    <span className="text-[9px] text-muted-foreground/60">
                      {tenantAgents.length} agent{tenantAgents.length !== 1 ? "s" : ""}
                    </span>
                    {onlineCount > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3] font-semibold">
                        {onlineCount} online
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-brand-accent/[0.06]">
                    {tenantAgents.map((agent) => {
                      const isExp = expanded === agent.id;
                      const subs = submissions[agent.id] ?? [];
                      const listSiteLabel = agentSiteLabelForList(agent);
                      return (
                        <div key={agent.id}>
                          <button
                            onClick={() => handleExpand(agent.id)}
                            className="w-full px-4 py-3 text-left hover:bg-brand-accent/[0.02] dark:hover:bg-brand-accent/[0.04] transition-colors space-y-1.5"
                          >
                            <div className="flex items-center gap-2.5">
                              <StatusDot status={agent.status} lastSeenAt={agent.last_seen_at} />
                              <span className="text-[11px] font-display font-semibold text-foreground flex-1 min-w-0 truncate">
                                {agent.name}
                              </span>
                              {agent.last_score != null && (
                                <span className="text-[10px] font-bold text-foreground shrink-0">
                                  {agent.last_score}
                                  <span className="text-muted-foreground/60 font-normal">
                                    /{agent.last_grade}
                                  </span>
                                </span>
                              )}
                              <span className="text-[9px] text-muted-foreground/50 whitespace-nowrap shrink-0">
                                {timeAgo(agent.last_seen_at)}
                              </span>
                              <ChevronDown
                                className={`h-3 w-3 text-muted-foreground/40 shrink-0 transition-transform ${isExp ? "rotate-180" : ""}`}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 pl-[18px] flex-wrap">
                              {listSiteLabel ? (
                                <>
                                  <span className="text-[9px] text-muted-foreground/70">
                                    {listSiteLabel}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/40">·</span>
                                </>
                              ) : null}
                              <span className="text-[9px] text-muted-foreground/70 font-mono">
                                {agent.firewall_host}:{agent.firewall_port}
                              </span>
                              {agent.serial_number && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-brand-accent/[0.06] text-muted-foreground/60 font-mono">
                                  {agent.serial_number}
                                </span>
                              )}
                              {agent.hardware_model && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-brand-accent/[0.06] text-muted-foreground/60">
                                  {agent.hardware_model}
                                </span>
                              )}
                              <FirmwareBadge version={agent.firmware_version} />
                            </div>
                          </button>

                          {isExp && (
                            <div className="border-t border-brand-accent/10 px-4 pb-4 pt-3 space-y-3 bg-brand-accent/[0.01] dark:bg-brand-accent/[0.03]">
                              {canManageAgents && (
                                <div className="rounded-lg border border-brand-accent/10 bg-brand-accent/[0.02] dark:bg-brand-accent/[0.04] p-3 space-y-2">
                                  <label
                                    htmlFor={`agent-assigned-customer-${agent.id}`}
                                    className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide"
                                  >
                                    Customer (grouping)
                                  </label>
                                  <div className="flex flex-wrap gap-2 items-end">
                                    <Input
                                      id={`agent-assigned-customer-${agent.id}`}
                                      list={`agent-customer-pick-${agent.id}`}
                                      value={assignedCustomerDraft}
                                      onChange={(e) => setAssignedCustomerDraft(e.target.value)}
                                      placeholder="e.g. same name on each connector for this end customer"
                                      className="h-8 text-[11px] flex-1 min-w-[160px]"
                                    />
                                    <datalist id={`agent-customer-pick-${agent.id}`}>
                                      {customerNameOptions.map((n) => (
                                        <option key={n} value={n} />
                                      ))}
                                    </datalist>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      className="h-8 text-[10px] gap-1.5"
                                      disabled={
                                        assignedCustomerSaving ||
                                        assignedCustomerDraft.trim() ===
                                          (agent.assigned_customer_name ?? "").trim()
                                      }
                                      onClick={async () => {
                                        setAssignedCustomerSaving(true);
                                        try {
                                          await handlePatchAgent(agent.id, {
                                            assigned_customer_name:
                                              assignedCustomerDraft.trim() || null,
                                          });
                                        } finally {
                                          setAssignedCustomerSaving(false);
                                        }
                                      }}
                                    >
                                      {assignedCustomerSaving ? (
                                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                      ) : null}
                                      Save
                                    </Button>
                                  </div>
                                  <p className="text-[9px] text-muted-foreground/70 leading-snug">
                                    Optional. Use the same value on multiple connectors to group
                                    them under one customer. New assessments bucket here instead of
                                    the Sophos Central tenant. Clear the field to follow Central
                                    again. Pick from existing customers or type a new name.
                                  </p>
                                </div>
                              )}
                              {canManageAgents && (
                                <div className="rounded-lg border border-brand-accent/10 bg-brand-accent/[0.02] dark:bg-brand-accent/[0.04] p-3 space-y-2">
                                  <label
                                    htmlFor={`agent-site-label-${agent.id}`}
                                    className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide"
                                  >
                                    Customer site label
                                  </label>
                                  <div className="flex flex-wrap gap-2 items-end">
                                    <Input
                                      id={`agent-site-label-${agent.id}`}
                                      value={siteLabelDraft}
                                      onChange={(e) => setSiteLabelDraft(e.target.value)}
                                      placeholder="e.g. Acme Corp"
                                      className="h-8 text-[11px] flex-1 min-w-[160px]"
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      className="h-8 text-[10px] gap-1.5"
                                      disabled={
                                        siteLabelSaving ||
                                        siteLabelDraft.trim() ===
                                          (agent.customer_name === "Unnamed"
                                            ? ""
                                            : agent.customer_name)
                                      }
                                      onClick={async () => {
                                        setSiteLabelSaving(true);
                                        try {
                                          await handlePatchAgent(agent.id, {
                                            customer_name: siteLabelDraft.trim() || null,
                                          });
                                        } finally {
                                          setSiteLabelSaving(false);
                                        }
                                      }}
                                    >
                                      {siteLabelSaving ? (
                                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                      ) : null}
                                      Save label
                                    </Button>
                                  </div>
                                  <p className="text-[9px] text-muted-foreground/70 leading-snug">
                                    Site or location only. Leave blank to clear (shows as unnamed in
                                    lists). Does not split customers when{" "}
                                    <span className="font-medium text-foreground/80">
                                      Customer (grouping)
                                    </span>{" "}
                                    or Central tenant applies.
                                  </p>
                                </div>
                              )}
                              {/* Agent details */}
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                                <div>
                                  <span className="text-muted-foreground">Status:</span>{" "}
                                  <span className="font-medium text-foreground capitalize">
                                    {agent.status}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Environment:</span>{" "}
                                  <span className="font-medium text-foreground">
                                    {agent.environment || "Unknown"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Schedule:</span>{" "}
                                  <span className="font-medium text-foreground">
                                    {SCHEDULE_OPTIONS.find((o) => o.value === agent.schedule_cron)
                                      ?.label ?? agent.schedule_cron}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">API Key:</span>{" "}
                                  <span className="font-mono text-foreground">
                                    {agent.api_key_prefix}…
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Serial:</span>{" "}
                                  <span className="font-mono text-foreground">
                                    {agent.serial_number || "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Model:</span>{" "}
                                  <span className="font-medium text-foreground">
                                    {agent.hardware_model || "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Customer grouping:</span>{" "}
                                  <span className="font-medium text-foreground">
                                    {(agent.assigned_customer_name ?? "").trim() || "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Tenant:</span>{" "}
                                  <span className="font-medium text-foreground">
                                    {agent.tenant_name
                                      ? displayCustomerNameForUi(agent.tenant_name, org?.name)
                                      : "Unassigned"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Central:</span>{" "}
                                  {(agent as Record<string, unknown>).central_firewall_id ? (
                                    <span className="font-medium text-[#007A5A] dark:text-[#00F2B3]">
                                      Linked
                                    </span>
                                  ) : (
                                    <span className="font-medium text-muted-foreground">
                                      Not linked
                                    </span>
                                  )}
                                </div>
                                {agent.error_message && (
                                  <div className="col-span-2">
                                    <span className="text-[#EA0022]">Error:</span>{" "}
                                    <span className="text-[#EA0022]">{agent.error_message}</span>
                                  </div>
                                )}
                              </div>

                              {/* Recent submissions */}
                              {subs.length > 0 && (
                                <div>
                                  <p className="text-[9px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.08em] mb-1.5">
                                    Recent Submissions
                                  </p>
                                  <div className="space-y-1">
                                    {subs.map((sub) => (
                                      <div
                                        key={sub.id}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-accent/[0.03] dark:bg-brand-accent/[0.06] border border-brand-accent/[0.06] text-[10px]"
                                      >
                                        <span className="font-bold text-foreground">
                                          {sub.overall_score}/{sub.overall_grade}
                                        </span>
                                        <span className="text-muted-foreground flex-1 truncate">
                                          {(sub.finding_titles as string[]).length} findings
                                        </span>
                                        {sub.drift && (
                                          <span className="text-[9px]">
                                            {(sub.drift as { new?: string[]; fixed?: string[] }).new
                                              ?.length ? (
                                              <span className="text-[#EA0022]">
                                                +{(sub.drift as { new: string[] }).new.length}
                                              </span>
                                            ) : null}
                                            {(sub.drift as { fixed?: string[] }).fixed?.length ? (
                                              <span className="text-[#00F2B3] ml-1">
                                                -{(sub.drift as { fixed: string[] }).fixed.length}
                                              </span>
                                            ) : null}
                                          </span>
                                        )}
                                        <span className="text-muted-foreground whitespace-nowrap">
                                          {timeAgo(sub.created_at)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Actions */}
                              {canManageAgents && (
                                <div className="flex gap-2 pt-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-[10px] h-7"
                                    onClick={() => handleRunNow(agent.id)}
                                    disabled={!!scanRequested[agent.id]}
                                  >
                                    {scanRequested[agent.id] ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin" /> Scanning…
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
                                    className="gap-1.5 text-[10px] h-7 text-[#EA0022] hover:text-[#EA0022] hover:bg-[#EA0022]/5"
                                    onClick={() => handleDelete(agent.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Data retention */}
      {canManageTeam && agents.length > 0 && (
        <div className="rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_8px_30px_rgba(32,6,247,0.05)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-display font-semibold text-foreground">
                Data Retention
              </p>
              <p className="text-[9px] text-muted-foreground/60">
                How long agent submissions are kept
              </p>
            </div>
            <select
              value={retention}
              onChange={(e) => handleRetentionChange(Number(e.target.value))}
              className="rounded-xl border border-brand-accent/15 bg-brand-accent/[0.04] dark:bg-brand-accent/[0.08] px-3 py-1.5 text-[10px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent/30 transition-all"
            >
              {RETENTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Download section */}
      <div
        className="rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_8px_30px_rgba(32,6,247,0.05)] p-4 space-y-3"
        data-tour="connector-download"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#00F2B3] to-[#009CFB] flex items-center justify-center shrink-0">
            <Download className="h-3 w-3 text-white" />
          </div>
          <p className="text-[11px] font-display font-semibold text-foreground">Download Agent</p>
        </div>
        <p className="text-[9px] text-muted-foreground/70">
          Download the FireComply Connector for your operating system. Install it on the same
          network as the firewall(s) you want to monitor.
          {agents.length === 0 && " Register an agent above to get your API key."}
        </p>
        <div className="flex gap-2">
          <a
            href="https://github.com/joseph15562/sophos-firecomply/releases/latest/download/FireComply-Connector-Setup.exe"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] h-7 gap-1 rounded-lg border-brand-accent/15 hover:bg-brand-accent/[0.06]"
            >
              <Server className="h-3 w-3" /> Windows .exe
            </Button>
          </a>
          <a
            href="https://github.com/joseph15562/sophos-firecomply/releases/latest/download/FireComply-Connector-mac.zip"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] h-7 gap-1 rounded-lg border-brand-accent/15 hover:bg-brand-accent/[0.06]"
            >
              <Server className="h-3 w-3" /> macOS .zip
            </Button>
          </a>
          <a
            href="https://github.com/joseph15562/sophos-firecomply/releases/latest/download/FireComply-Connector.AppImage"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] h-7 gap-1 rounded-lg border-brand-accent/15 hover:bg-brand-accent/[0.06]"
            >
              <Server className="h-3 w-3" /> Linux .AppImage
            </Button>
          </a>
        </div>
        <p className="text-[8px] text-muted-foreground/50">
          Download the latest version.{" "}
          <a
            href="https://github.com/joseph15562/sophos-firecomply/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            View all releases
          </a>
        </p>
      </div>
    </div>
  );
}
