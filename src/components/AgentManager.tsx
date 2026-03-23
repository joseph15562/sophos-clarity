import { useState, useEffect, useCallback } from "react";
import {
  Plug, Plus, Trash2, RefreshCw, Copy, Check, ChevronDown,
  ChevronRight, Download, Server, Key, Play, Link2, Unlink, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

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
  const isRecent =
    lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < 30 * 60 * 1000;
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
      ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]"
      : major >= 21
        ? "bg-[#009CFB]/10 text-[#009CFB]"
        : major >= 19
          ? "bg-[#F29400]/10 text-[#F29400]"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${color}`}>
      {version}
    </span>
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
        }
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
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Register Agent</h3>
            <button onClick={handleClose} className="text-muted-foreground hover:text-foreground text-lg" aria-label="Close">&times;</button>
          </div>

          {generatedKey ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-[#00F2B3]/10 border border-[#00F2B3]/20 p-3">
                <p className="text-[11px] font-semibold text-[#00F2B3] dark:text-[#00F2B3] mb-2">
                  API Key Generated
                </p>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Paste this key into the FireComply Connector app during setup. This key will not be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[10px] bg-background rounded px-2 py-1.5 border border-border font-mono break-all select-all">
                    {generatedKey}
                  </code>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5 text-[#00F2B3]" /> : <Copy className="h-3.5 w-3.5" />}
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
                <label className="text-[10px] font-medium text-foreground block mb-1">Agent Name *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HQ Primary Agent" className="h-8 text-[11px]" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-medium text-foreground block mb-1">Firewall IP / Hostname *</label>
                  <Input value={firewallHost} onChange={(e) => setFirewallHost(e.target.value)} placeholder="192.168.1.1" className="h-8 text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-foreground block mb-1">Port</label>
                  <Input value={firewallPort} onChange={(e) => setFirewallPort(e.target.value)} placeholder="4444" className="h-8 text-[11px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-foreground block mb-1">Customer Name</label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Acme Corp" className="h-8 text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-foreground block mb-1">Environment</label>
                  <Input value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="Production" className="h-8 text-[11px]" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-foreground block mb-1">Schedule</label>
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
                >
                  {SCHEDULE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
                Advanced
              </button>

              {showAdvanced && (
                <div className="space-y-2 pl-3 border-l-2 border-border">
                  <div>
                    <label className="text-[10px] font-medium text-foreground block mb-1">Serial Number</label>
                    <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Optional" className="h-7 text-[10px]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-foreground block mb-1">Hardware Model</label>
                    <Input value={hardwareModel} onChange={(e) => setHardwareModel(e.target.value)} placeholder="e.g. XGS 2300" className="h-7 text-[10px]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-foreground block mb-1">Firmware Version Override</label>
                    <Input value={fwOverride} onChange={(e) => setFwOverride(e.target.value)} placeholder="e.g. 2200.1" className="h-7 text-[10px]" />
                  </div>
                </div>
              )}

              <Button onClick={handleSubmit} disabled={loading || !name.trim() || !firewallHost.trim()} className="w-full text-[11px] h-8 gap-1.5">
                {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />}
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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>({});
  const [retention, setRetention] = useState(90);
  const [scanRequested, setScanRequested] = useState<Record<string, boolean>>({});

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

  const loadSubmissions = useCallback(async (agentId: string) => {
    const { data } = await supabase
      .from("agent_submissions")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(10);
    setSubmissions((prev) => ({ ...prev, [agentId]: data ?? [] }));
  }, []);

  const handleExpand = (agentId: string) => {
    if (expanded === agentId) {
      setExpanded(null);
    } else {
      setExpanded(agentId);
      if (!submissions[agentId]) loadSubmissions(agentId);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm("Delete this agent and all its submissions?")) return;
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) { toast.error("Not authenticated"); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/agent/${agentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
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
      if (!session) { toast.error("Not authenticated"); return; }

      setScanRequested((p) => ({ ...p, [agentId]: true }));

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/agent/${agentId}/run-now`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setScanRequested((p) => ({ ...p, [agentId]: false }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      toast.success("Scan requested — waiting for agent to complete…");

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
          setScanRequested((p) => ({ ...p, [agentId]: false }));
          toast.success(`Scan complete — Score: ${agentData.last_score}/${agentData.last_grade}`);
          loadAgents();
          return;
        }

        if (attempts >= 36) {
          clearInterval(pollInterval);
          setScanRequested((p) => ({ ...p, [agentId]: false }));
          toast.info("Scan is taking longer than expected — refresh to check results");
        }
      }, 5000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    }
  };

  const handleRetentionChange = async (days: number) => {
    if (!org) return;
    setRetention(days);
    await supabase
      .from("organisations")
      .update({ submission_retention_days: days })
      .eq("id", org.id);
    toast.success(`Retention set to ${days} days`);
  };

  if (loading && !showRegister) {
    return (
      <div className="space-y-3 p-4 animate-pulse">
        <div className="h-4 bg-muted/40 rounded w-3/4" />
        <div className="h-20 bg-muted/40 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-tour="connector-section">
      <RegisterDialog open={showRegister} onClose={() => setShowRegister(false)} onRegistered={loadAgents} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">Connector Agents</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        {canManageAgents && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRegister(true)}
            className="gap-1.5 text-[10px] h-7"
            data-tour="connector-register"
          >
            <Plus className="h-3 w-3" />
            Register Agent
          </Button>
        )}
      </div>

      {/* Agent list grouped by tenant */}
      {agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 py-6 text-center text-muted-foreground">
          <Plug className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-[11px]">No agents registered</p>
          <p className="text-[9px] mt-1">Register an agent to start automated firewall monitoring</p>
          {canManageAgents && (
            <Button variant="outline" size="sm" onClick={() => setShowRegister(true)} className="mt-3 gap-1.5 text-[10px] h-7" data-tour="connector-register">
              <Plus className="h-3 w-3" /> Register Agent
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {(() => {
            const grouped = new Map<string, Agent[]>();
            for (const a of agents) {
              const key = a.tenant_name || "Unassigned";
              const list = grouped.get(key) ?? [];
              list.push(a);
              grouped.set(key, list);
            }
            const sorted = Array.from(grouped.entries()).sort(([a], [b]) =>
              a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)
            );

            return sorted.map(([tenantName, tenantAgents]) => {
              const onlineCount = tenantAgents.filter(
                (a) => a.status === "online" && a.last_seen_at && Date.now() - new Date(a.last_seen_at).getTime() < 30 * 60 * 1000
              ).length;
              const isLinked = tenantName !== "Unassigned";

              return (
                <div key={tenantName} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border">
                    <Server className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] font-semibold text-foreground flex-1">{tenantName}</span>
                    {isLinked ? (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3] font-medium flex items-center gap-1">
                        <Link2 className="h-2.5 w-2.5" /> Central Linked
                      </span>
                    ) : (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium flex items-center gap-1">
                        <Unlink className="h-2.5 w-2.5" /> Not Linked
                      </span>
                    )}
                    <span className="text-[9px] text-muted-foreground">
                      {tenantAgents.length} agent{tenantAgents.length !== 1 ? "s" : ""}
                    </span>
                    {onlineCount > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3] font-medium">
                        {onlineCount} online
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-border/50">
                    {tenantAgents.map((agent) => {
                      const isExp = expanded === agent.id;
                      const subs = submissions[agent.id] ?? [];
                      return (
                        <div key={agent.id}>
                          <button
                            onClick={() => handleExpand(agent.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                          >
                            <StatusDot status={agent.status} lastSeenAt={agent.last_seen_at} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-foreground truncate">{agent.name}</p>
                              <p className="text-[9px] text-muted-foreground truncate">
                                {agent.customer_name} · {agent.firewall_host}:{agent.firewall_port}
                              </p>
                            </div>
                            {agent.serial_number && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono shrink-0">
                                {agent.serial_number}
                              </span>
                            )}
                            {agent.hardware_model && (
                              <span className="text-[9px] text-muted-foreground shrink-0">{agent.hardware_model}</span>
                            )}
                            <FirmwareBadge version={agent.firmware_version} />
                            {agent.last_score != null && (
                              <span className="text-[10px] font-bold text-foreground">
                                {agent.last_score}<span className="text-muted-foreground font-normal">/{agent.last_grade}</span>
                              </span>
                            )}
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                              {timeAgo(agent.last_seen_at)}
                            </span>
                            <ChevronDown className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${isExp ? "rotate-180" : ""}`} />
                          </button>

                          {isExp && (
                            <div className="border-t border-border px-3 pb-3 pt-2 space-y-3 bg-muted/5">
                              {/* Agent details */}
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium text-foreground capitalize">{agent.status}</span></div>
                                <div><span className="text-muted-foreground">Environment:</span> <span className="font-medium text-foreground">{agent.environment || "Unknown"}</span></div>
                                <div><span className="text-muted-foreground">Schedule:</span> <span className="font-medium text-foreground">{SCHEDULE_OPTIONS.find(o => o.value === agent.schedule_cron)?.label ?? agent.schedule_cron}</span></div>
                                <div><span className="text-muted-foreground">API Key:</span> <span className="font-mono text-foreground">{agent.api_key_prefix}…</span></div>
                                <div><span className="text-muted-foreground">Serial:</span> <span className="font-mono text-foreground">{agent.serial_number || "—"}</span></div>
                                <div><span className="text-muted-foreground">Model:</span> <span className="font-medium text-foreground">{agent.hardware_model || "—"}</span></div>
                                <div><span className="text-muted-foreground">Tenant:</span> <span className="font-medium text-foreground">{agent.tenant_name || "Unassigned"}</span></div>
                                <div>
                                  <span className="text-muted-foreground">Central:</span>{" "}
                                  {(agent as any).central_firewall_id ? (
                                    <span className="font-medium text-[#00F2B3] dark:text-[#00F2B3]">Linked</span>
                                  ) : (
                                    <span className="font-medium text-muted-foreground">Not linked</span>
                                  )}
                                </div>
                                {agent.error_message && <div className="col-span-2"><span className="text-[#EA0022]">Error:</span> <span className="text-[#EA0022]">{agent.error_message}</span></div>}
                              </div>

                              {/* Recent submissions */}
                              {subs.length > 0 && (
                                <div>
                                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Recent Submissions</p>
                                  <div className="space-y-1">
                                    {subs.map((sub) => (
                                      <div key={sub.id} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/30 text-[10px]">
                                        <span className="font-bold text-foreground">{sub.overall_score}/{sub.overall_grade}</span>
                                        <span className="text-muted-foreground flex-1 truncate">
                                          {(sub.finding_titles as string[]).length} findings
                                        </span>
                                        {sub.drift && (
                                          <span className="text-[9px]">
                                            {(sub.drift as { new?: string[]; fixed?: string[] }).new?.length ? (
                                              <span className="text-[#EA0022]">+{(sub.drift as { new: string[] }).new.length}</span>
                                            ) : null}
                                            {(sub.drift as { fixed?: string[] }).fixed?.length ? (
                                              <span className="text-[#00F2B3] ml-1">-{(sub.drift as { fixed: string[] }).fixed.length}</span>
                                            ) : null}
                                          </span>
                                        )}
                                        <span className="text-muted-foreground whitespace-nowrap">{timeAgo(sub.created_at)}</span>
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
                                    {scanRequested[agent.id] ? <><Loader2 className="h-3 w-3 animate-spin" /> Scanning…</> : <><Play className="h-3 w-3" /> Request Scan</>}
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
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-foreground">Data Retention</p>
              <p className="text-[9px] text-muted-foreground">How long agent submissions are kept</p>
            </div>
            <select
              value={retention}
              onChange={(e) => handleRetentionChange(Number(e.target.value))}
              className="rounded border border-border bg-background px-2 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
            >
              {RETENTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Download section */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2" data-tour="connector-download">
        <p className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
          <Download className="h-3 w-3" /> Download Agent
        </p>
        <p className="text-[9px] text-muted-foreground">
          Download the FireComply Connector for your operating system. Install it on the same network as the firewall(s) you want to monitor.
          {agents.length === 0 && " Register an agent above to get your API key."}
        </p>
        <div className="flex gap-2">
          <a href="https://github.com/joseph15562/sophos-firecomply/releases/latest/download/FireComply-Connector-Setup.exe" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1">
              <Server className="h-3 w-3" /> Windows .exe
            </Button>
          </a>
          <a href="https://github.com/joseph15562/sophos-firecomply/releases/latest/download/FireComply-Connector-mac.zip" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1">
              <Server className="h-3 w-3" /> macOS .zip
            </Button>
          </a>
          <a href="https://github.com/joseph15562/sophos-firecomply/releases/latest/download/FireComply-Connector.AppImage" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1">
              <Server className="h-3 w-3" /> Linux .AppImage
            </Button>
          </a>
        </div>
        <p className="text-[8px] text-muted-foreground">
          Download the latest version.{" "}
          <a href="https://github.com/joseph15562/sophos-firecomply/releases" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">View all releases</a>
        </p>
      </div>

    </div>
  );
}
