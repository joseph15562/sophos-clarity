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

export function Dashboard() {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<FirewallStatus[]>([]);
  const [paused, setPaused] = useState(false);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    const poll = setInterval(async () => {
      const result = await window.electronAPI?.getStatus();
      if (result) {
        setStatuses(result.statuses ?? []);
        setPaused(result.paused ?? false);
        setQueueSize(result.queueSize ?? 0);
      }
    }, 3000);

    window.electronAPI?.getStatus().then((result: any) => {
      if (result) {
        setStatuses(result.statuses ?? []);
        setPaused(result.paused ?? false);
        setQueueSize(result.queueSize ?? 0);
      }
    });

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
        </div>
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
