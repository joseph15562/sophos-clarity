import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FirewallCard } from "../components/FirewallCard";
import { StatusDot } from "../components/StatusDot";

interface FirewallStatus {
  label: string;
  status: "idle" | "running" | "success" | "error";
  lastScore?: number;
  lastGrade?: string;
  lastRun?: string;
  error?: string;
  firmwareVersion?: string;
}

interface HeartbeatInfo {
  lastSentAt: string | null;
  lastOk: boolean;
  lastError?: string;
  commandReceived?: string;
  commandReceivedAt?: string;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<FirewallStatus[]>([]);
  const [paused, setPaused] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [heartbeat, setHeartbeat] = useState<HeartbeatInfo | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const update = (result: any) => {
      if (!result) return;
      setRunning(result.running ?? false);
      setStatuses(result.statuses ?? []);
      setPaused(result.paused ?? false);
      setQueueSize(result.queueSize ?? 0);
      setHeartbeat(result.heartbeat ?? null);
    };

    window.electronAPI?.getStatus().then(update);
    const poll = setInterval(() => window.electronAPI?.getStatus().then(update), 3000);
    return () => clearInterval(poll);
  }, []);

  const handleRunNow = () => window.electronAPI?.runNow();
  const handleToggle = () => window.electronAPI?.togglePause();

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">FireComply Connector</h1>
          <p className="text-xs text-muted-foreground">
            {statuses.length} firewall{statuses.length !== 1 ? "s" : ""} monitored
            {paused && <span className="text-amber-500 ml-2">· Paused</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRunNow} className="px-3 py-1.5 rounded-lg bg-[#6B5BFF] text-white text-xs font-medium hover:bg-[#6B5BFF]/90">
            Run Now
          </button>
          <button onClick={handleToggle} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
            {paused ? "Resume" : "Pause"}
          </button>
          <button onClick={() => navigate("/logs")} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
            Logs
          </button>
          <button onClick={() => navigate("/settings")} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
            Settings
          </button>
          <button onClick={() => navigate("/help")} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
            Help
          </button>
        </div>
      </div>

      {/* Heartbeat / connection status */}
      <div className="rounded-lg border border-border bg-card px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${
            heartbeat?.lastOk ? "bg-green-500"
              : heartbeat?.lastSentAt ? "bg-red-500"
              : running ? "bg-amber-400 animate-pulse"
              : "bg-gray-400"
          }`} />
          <span className="text-[11px] font-medium text-foreground">
            {heartbeat?.lastOk ? "Connected"
              : heartbeat?.lastSentAt ? "Disconnected"
              : running ? "Connecting…"
              : "Service not running"}
          </span>
        </div>
        {heartbeat?.lastSentAt && (
          <span className="text-[10px] text-muted-foreground">
            Last heartbeat: {timeAgo(heartbeat.lastSentAt)}
          </span>
        )}
        {heartbeat?.lastError && (
          <span className="text-[10px] text-red-500 truncate flex-1">{heartbeat.lastError}</span>
        )}
        {heartbeat?.commandReceived && heartbeat.commandReceivedAt && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#6B5BFF]/10 text-[#6B5BFF] font-medium ml-auto">
            Remote scan triggered {timeAgo(heartbeat.commandReceivedAt)}
          </span>
        )}
      </div>

      {/* Queue indicator */}
      {queueSize > 0 && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-xs text-amber-600">
          {queueSize} submission{queueSize !== 1 ? "s" : ""} queued — API unreachable
        </div>
      )}

      {/* Firewall cards */}
      <div className="grid gap-4">
        {statuses.map((fw) => (
          <FirewallCard key={fw.label} {...fw} />
        ))}
      </div>

      {statuses.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No firewalls configured.{" "}
          <button onClick={() => navigate("/setup")} className="text-[#6B5BFF] hover:underline">Run setup</button>
        </div>
      )}
    </div>
  );
}
