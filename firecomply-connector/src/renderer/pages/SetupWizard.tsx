import { useState } from "react";
import { toast } from "sonner";

interface Props { onComplete: () => void; }

type Step = "api-key" | "firewalls" | "schedule" | "confirm";

interface FirewallEntry {
  label: string;
  host: string;
  port: string;
  username: string;
  password: string;
  skipSslVerify: boolean;
  testResult?: { ok: boolean; firmwareVersion?: string; error?: string };
}

const SCHEDULES = [
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 */12 * * *", label: "Every 12 hours" },
  { value: "0 2 * * *", label: "Daily at 02:00" },
  { value: "0 2 * * 1", label: "Weekly (Monday 02:00)" },
];

const DEFAULT_API_URL = "https://rpnvyrxorfaqabkdhctl.supabase.co/functions/v1";

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("api-key");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl] = useState(DEFAULT_API_URL);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [firewalls, setFirewalls] = useState<FirewallEntry[]>([
    { label: "", host: "", port: "4444", username: "", password: "", skipSslVerify: true },
  ]);
  const [schedule, setSchedule] = useState("0 2 * * *");
  const [saving, setSaving] = useState(false);

  const verifyKey = async () => {
    setVerifying(true);
    try {
      const result = await window.electronAPI.testApiKey(apiUrl, apiKey);
      if (result.ok) {
        setVerified(true);
        toast.success("API key verified");
      } else {
        toast.error(result.error ?? "Verification failed");
      }
    } catch {
      toast.error("Could not reach FireComply API");
    }
    setVerifying(false);
  };

  const testFirewall = async (idx: number) => {
    const fw = firewalls[idx];
    try {
      const result = await window.electronAPI.testFirewall({
        host: fw.host, port: parseInt(fw.port) || 4444,
        username: fw.username, password: fw.password,
        skipSslVerify: fw.skipSslVerify,
      });
      updateFirewall(idx, { testResult: result });
      if (result.ok) toast.success(`Connected — ${result.firmwareVersion}`);
      else toast.error(result.error ?? "Connection failed");
    } catch (err) {
      toast.error("Connection failed");
    }
  };

  const updateFirewall = (idx: number, patch: Partial<FirewallEntry>) => {
    setFirewalls((prev) => prev.map((fw, i) => (i === idx ? { ...fw, ...patch } : fw)));
  };

  const addFirewall = () => {
    setFirewalls((prev) => [...prev, { label: "", host: "", port: "4444", username: "", password: "", skipSslVerify: true }]);
  };

  const removeFirewall = (idx: number) => {
    if (firewalls.length <= 1) return;
    setFirewalls((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    try {
      await window.electronAPI.saveConfig({
        firecomplyApiUrl: apiUrl,
        agentApiKey: apiKey,
        firewalls: firewalls.map((fw) => ({
          label: fw.label || fw.host,
          host: fw.host,
          port: parseInt(fw.port) || 4444,
          username: fw.username,
          password: fw.password,
          skipSslVerify: fw.skipSslVerify,
          versionOverride: null,
        })),
        schedule,
        proxy: null,
        logFile: "./firecomply-connector.log",
        logLevel: "info",
      });
      toast.success("Configuration saved — monitoring started");
      onComplete();
    } catch {
      toast.error("Failed to save configuration");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">FireComply Connector</h1>
          <p className="text-sm text-muted-foreground mt-1">Setup Wizard</p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2">
          {(["api-key", "firewalls", "schedule", "confirm"] as Step[]).map((s, i) => (
            <div key={s} className={`h-1.5 w-12 rounded-full ${s === step ? "bg-[#6B5BFF]" : "bg-muted"}`} />
          ))}
        </div>

        {step === "api-key" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Step 1 — Connect to FireComply</h2>
            <p className="text-xs text-muted-foreground">
              Paste the API key from your FireComply dashboard (Settings → Connector Agents → Register Agent).
            </p>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">API Key</label>
              <input value={apiKey} onChange={(e) => { setApiKey(e.target.value); setVerified(false); }} placeholder="ck_xxxxxxxxxxxxxxxx" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono" autoFocus />
            </div>
            {verified && <p className="text-sm text-green-500 font-medium">✓ Connected to FireComply</p>}
            <div className="flex gap-2">
              <button onClick={verifyKey} disabled={!apiKey || verifying} className="px-4 py-2 rounded-lg bg-[#6B5BFF] text-white text-sm font-medium disabled:opacity-50">
                {verifying ? "Verifying…" : "Verify"}
              </button>
              <button onClick={() => setStep("firewalls")} disabled={!verified} className="px-4 py-2 rounded-lg border border-border text-sm font-medium disabled:opacity-50">
                Next →
              </button>
            </div>
          </div>
        )}

        {step === "firewalls" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Step 2 — Add Firewalls</h2>
            {firewalls.map((fw, idx) => (
              <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Firewall {idx + 1}</span>
                  {firewalls.length > 1 && (
                    <button onClick={() => removeFirewall(idx)} className="text-xs text-red-500 hover:underline">Remove</button>
                  )}
                </div>
                <input value={fw.label} onChange={(e) => updateFirewall(idx, { label: e.target.value })} placeholder="Label (e.g. HQ Primary)" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
                <div className="grid grid-cols-3 gap-2">
                  <input value={fw.host} onChange={(e) => updateFirewall(idx, { host: e.target.value })} placeholder="IP / Hostname" className="col-span-2 rounded border border-border bg-background px-2 py-1.5 text-xs" />
                  <input value={fw.port} onChange={(e) => updateFirewall(idx, { port: e.target.value })} placeholder="Port" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={fw.username} onChange={(e) => updateFirewall(idx, { username: e.target.value })} placeholder="API Username" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
                  <input type="password" value={fw.password} onChange={(e) => updateFirewall(idx, { password: e.target.value })} placeholder="API Password" className="rounded border border-border bg-background px-2 py-1.5 text-xs" />
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={() => testFirewall(idx)} disabled={!fw.host || !fw.username} className="text-xs px-3 py-1 rounded bg-muted hover:bg-muted/80 disabled:opacity-50">
                    Test Connection
                  </button>
                  {fw.testResult?.ok && (
                    <span className="text-xs text-green-500">✓ {fw.testResult.firmwareVersion}</span>
                  )}
                  {fw.testResult && !fw.testResult.ok && (
                    <span className="text-xs text-red-500">✗ {fw.testResult.error}</span>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addFirewall} className="text-xs text-[#6B5BFF] hover:underline">+ Add another firewall</button>
            <div className="flex gap-2">
              <button onClick={() => setStep("api-key")} className="px-4 py-2 rounded-lg border border-border text-sm">← Back</button>
              <button onClick={() => setStep("schedule")} disabled={firewalls.every((f) => !f.host)} className="px-4 py-2 rounded-lg bg-[#6B5BFF] text-white text-sm font-medium disabled:opacity-50">Next →</button>
            </div>
          </div>
        )}

        {step === "schedule" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Step 3 — Schedule</h2>
            <div className="space-y-2">
              {SCHEDULES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="schedule" value={s.value} checked={schedule === s.value} onChange={() => setSchedule(s.value)} className="accent-[#6B5BFF]" />
                  <span className="text-sm text-foreground">{s.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep("firewalls")} className="px-4 py-2 rounded-lg border border-border text-sm">← Back</button>
              <button onClick={() => setStep("confirm")} className="px-4 py-2 rounded-lg bg-[#6B5BFF] text-white text-sm font-medium">Next →</button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Step 4 — Confirm</h2>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p><strong className="text-foreground">Firewalls:</strong> {firewalls.length}</p>
              {firewalls.map((fw, i) => (
                <p key={i} className="pl-3">• {fw.label || fw.host}:{fw.port} {fw.testResult?.ok ? `(${fw.testResult.firmwareVersion})` : ""}</p>
              ))}
              <p><strong className="text-foreground">Schedule:</strong> {SCHEDULES.find((s) => s.value === schedule)?.label}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep("schedule")} className="px-4 py-2 rounded-lg border border-border text-sm">← Back</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[#6B5BFF] text-white text-sm font-medium disabled:opacity-50">
                {saving ? "Saving…" : "Start Monitoring"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
