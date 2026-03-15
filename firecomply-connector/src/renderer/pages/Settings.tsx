import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const SCHEDULES = [
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 */12 * * *", label: "Every 12 hours" },
  { value: "0 2 * * *", label: "Daily at 02:00" },
  { value: "0 2 * * 1", label: "Weekly (Monday 02:00)" },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<any>(null);
  const [schedule, setSchedule] = useState("0 2 * * *");

  useEffect(() => {
    window.electronAPI?.getConfig().then((cfg: any) => {
      if (cfg) {
        setConfig(cfg);
        setSchedule(cfg.schedule ?? "0 2 * * *");
      }
    });
  }, []);

  const saveSchedule = async () => {
    if (!config) return;
    const updated = { ...config, schedule };
    const result = await window.electronAPI?.saveConfig(updated);
    if (result?.ok) toast.success("Schedule updated");
    else toast.error("Failed to save");
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")} className="text-xs text-muted-foreground hover:text-foreground">← Dashboard</button>
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
      </div>

      {/* Firewalls (read-only) */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Linked Firewalls</h2>
        {config?.firewalls?.map((fw: any, i: number) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30">
            <span className="text-xs font-medium text-foreground">{fw.label || fw.host}</span>
            <span className="text-[10px] text-muted-foreground">{fw.host}:{fw.port}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-auto">🔒 Locked</span>
          </div>
        ))}
        <button onClick={() => navigate("/setup")} className="text-xs text-[#6B5BFF] hover:underline">
          Re-run Setup Wizard
        </button>
      </div>

      {/* Schedule */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Schedule</h2>
        <select
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {SCHEDULES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button onClick={saveSchedule} className="px-4 py-2 rounded-lg bg-[#6B5BFF] text-white text-xs font-medium">
          Save Schedule
        </button>
      </div>

      {/* About */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2 text-xs text-muted-foreground">
        <h2 className="text-sm font-semibold text-foreground">About</h2>
        <p>FireComply Connector v1.0.0</p>
        <p>API URL: {config?.firecomplyApiUrl ?? "Not configured"}</p>
      </div>
    </div>
  );
}
