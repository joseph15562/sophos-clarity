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
  snmpCommunity: string;
  testResult?: { ok: boolean; firmwareVersion?: string; serialNumber?: string; hardwareModel?: string; error?: string };
  snmpResult?: { ok: boolean; detail: string };
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
    { label: "", host: "", port: "4444", username: "", password: "", skipSslVerify: true, snmpCommunity: "" },
  ]);
  const [testing, setTesting] = useState<number | null>(null);
  const [testingSnmp, setTestingSnmp] = useState<number | null>(null);
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
    setTesting(idx);
    try {
      const result = await window.electronAPI.testFirewall({
        host: fw.host, port: parseInt(fw.port) || 4444,
        username: fw.username, password: fw.password,
        skipSslVerify: fw.skipSslVerify,
        snmpCommunity: fw.snmpCommunity || undefined,
      });
      updateFirewall(idx, { testResult: result });
      if (result.ok) {
        const parts = [result.firmwareVersion];
        if (result.serialNumber) parts.push(`SN: ${result.serialNumber}`);
        if (result.hardwareModel) parts.push(result.hardwareModel);
        toast.success(`Connected — ${parts.filter(Boolean).join(" · ")}`);
      } else {
        toast.error(result.error ?? "Connection failed");
      }
    } catch {
      toast.error("Connection failed");
    }
    setTesting(null);
  };

  const testSnmp = async (idx: number) => {
    const fw = firewalls[idx];
    if (!fw.host || !fw.snmpCommunity) {
      toast.error("Enter a host and SNMP community string first");
      return;
    }
    setTestingSnmp(idx);
    updateFirewall(idx, { snmpResult: undefined });
    try {
      const result = await window.electronAPI.testSnmp(fw.host, fw.snmpCommunity);
      if (result?.ok) {
        const parts = [];
        if (result.serialNumber) parts.push(`SN: ${result.serialNumber}`);
        if (result.model) parts.push(`Model: ${result.model}`);
        if (result.hostname) parts.push(`Host: ${result.hostname}`);
        if (result.firmwareVersion) parts.push(`FW: ${result.firmwareVersion}`);
        toast.success(`SNMP OK — ${parts.join(" · ") || "Connected"}`);
        updateFirewall(idx, { snmpResult: { ok: true, detail: parts.join("\n") || "Connected but no Sophos OIDs returned" } });
      } else {
        toast.error(result?.error ?? "SNMP test failed");
        updateFirewall(idx, { snmpResult: { ok: false, detail: result?.error ?? "Unknown error" } });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SNMP test failed";
      toast.error(msg);
      updateFirewall(idx, { snmpResult: { ok: false, detail: msg } });
    }
    setTestingSnmp(null);
  };

  const updateFirewall = (idx: number, patch: Partial<FirewallEntry>) => {
    setFirewalls((prev) => prev.map((fw, i) => (i === idx ? { ...fw, ...patch } : fw)));
  };

  const addFirewall = () => {
    setFirewalls((prev) => [...prev, { label: "", host: "", port: "4444", username: "", password: "", skipSslVerify: true, snmpCommunity: "" }]);
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
          snmpCommunity: fw.snmpCommunity || undefined,
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
          {(["api-key", "firewalls", "schedule", "confirm"] as Step[]).map((s) => (
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
              <label className="text-[10px] text-muted-foreground block mb-1">API Key</label>
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

            <details className="border border-border rounded-lg bg-muted/30 text-xs">
              <summary className="px-3 py-2 cursor-pointer text-[#6B5BFF] font-medium select-none hover:underline">
                How to set up API access on your firewall
              </summary>
              <div className="px-3 pb-3 pt-1 space-y-2 text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground">1. Create a read-only admin profile</p>
                <p>Administration → Device access → Admin and user settings → Administration profiles → <strong>Add</strong>. Name it <code className="bg-muted px-1 rounded">API read only</code> and set every category to <strong>Read-only</strong>.</p>

                <p className="font-semibold text-foreground">2. Create the service account</p>
                <p>Authentication → Users → <strong>Add</strong>. Set username to <code className="bg-muted px-1 rounded">firecomply-api</code>, user type <strong>Administrator</strong>, profile <strong>API read only</strong>. Use a strong password. <strong>Do not enable OTP/MFA</strong> — the XML API does not support interactive MFA tokens.</p>

                <p className="font-semibold text-foreground">3. Enable the API</p>
                <p>Backup &amp; firmware → API → toggle <strong>On</strong>.</p>

                <p className="font-semibold text-foreground">4. Restrict API access by IP</p>
                <p>On the same page, under <strong>Allowed IP addresses</strong>, add the IP of this machine only.</p>

                <p className="font-semibold text-foreground">5. Enable SNMP (optional — for serial number)</p>
                <p>Administration → SNMP → toggle <strong>On</strong>. Set a read-only community string (e.g. <code className="bg-muted px-1 rounded">firecomply-ro</code>). Under Device access, enable SNMP for the relevant zone.</p>

                <p className="text-[10px] text-muted-foreground/70 pt-1">A non-MFA service account is compliant when restricted to read-only access, IP-locked, and using a strong password. See docs/firewall-api-setup.md for the full guide and compliance notes.</p>
              </div>
            </details>

            {firewalls.map((fw, idx) => (
              <div key={idx} className="border border-border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Firewall {idx + 1}</span>
                  {firewalls.length > 1 && (
                    <button onClick={() => removeFirewall(idx)} className="text-xs text-red-500 hover:underline">Remove</button>
                  )}
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Label</label>
                  <input value={fw.label} onChange={(e) => updateFirewall(idx, { label: e.target.value })} placeholder="e.g. HQ Primary" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] text-muted-foreground block mb-1">Host / IP</label>
                    <input value={fw.host} onChange={(e) => updateFirewall(idx, { host: e.target.value })} placeholder="192.168.1.1" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Port</label>
                    <input value={fw.port} onChange={(e) => updateFirewall(idx, { port: e.target.value })} placeholder="4444" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">API Username</label>
                    <input value={fw.username} onChange={(e) => updateFirewall(idx, { username: e.target.value })} placeholder="firecomply-api" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">API Password</label>
                    <input type="password" value={fw.password} onChange={(e) => updateFirewall(idx, { password: e.target.value })} placeholder="••••••••" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">SNMP Community (optional — for serial number)</label>
                  <input value={fw.snmpCommunity} onChange={(e) => updateFirewall(idx, { snmpCommunity: e.target.value })} placeholder="e.g. firecomply-ro" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs" />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => testFirewall(idx)}
                    disabled={!fw.host || !fw.username || testing === idx}
                    className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50"
                  >
                    {testing === idx ? "Testing…" : "Test API"}
                  </button>
                  <button
                    onClick={() => testSnmp(idx)}
                    disabled={!fw.host || !fw.snmpCommunity || testingSnmp === idx}
                    className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50"
                  >
                    {testingSnmp === idx ? "Testing…" : "Test SNMP"}
                  </button>
                </div>

                {fw.testResult && (
                  <div className={`rounded-lg px-3 py-2 text-xs ${fw.testResult.ok ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-400"}`}>
                    {fw.testResult.ok ? (
                      <div className="space-y-0.5">
                        <p className="font-medium">✓ API Connected</p>
                        <p className="text-[10px] opacity-80">
                          {[fw.testResult.firmwareVersion, fw.testResult.hardwareModel, fw.testResult.serialNumber ? `SN: ${fw.testResult.serialNumber}` : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    ) : (
                      <p>✗ {fw.testResult.error}</p>
                    )}
                  </div>
                )}

                {fw.snmpResult && (
                  <div className={`rounded-lg px-3 py-2 text-xs ${fw.snmpResult.ok ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-400"}`}>
                    <p className="font-medium">{fw.snmpResult.ok ? "✓ SNMP Connected" : "✗ SNMP Failed"}</p>
                    <p className="whitespace-pre-wrap mt-1 text-[10px] opacity-80">{fw.snmpResult.detail}</p>
                  </div>
                )}
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
            <p className="text-xs text-muted-foreground">
              Choose how often the connector should pull a full configuration export and run the security analysis.
            </p>
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
            <div className="text-xs space-y-2 text-muted-foreground">
              <p><strong className="text-foreground">Firewalls:</strong> {firewalls.length}</p>
              {firewalls.map((fw, i) => (
                <div key={i} className="pl-3 border-l-2 border-border ml-1 space-y-0.5">
                  <p className="text-foreground font-medium">{fw.label || fw.host}:{fw.port}</p>
                  {fw.testResult?.ok && (
                    <p className="text-green-500 text-[10px]">
                      ✓ {[fw.testResult.firmwareVersion, fw.testResult.hardwareModel, fw.testResult.serialNumber ? `SN: ${fw.testResult.serialNumber}` : null].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {fw.snmpResult?.ok && (
                    <p className="text-blue-500 text-[10px]">✓ SNMP configured</p>
                  )}
                  {!fw.testResult?.ok && (
                    <p className="text-amber-500 text-[10px]">⚠ Not tested</p>
                  )}
                </div>
              ))}
              <p className="pt-1"><strong className="text-foreground">Schedule:</strong> {SCHEDULES.find((s) => s.value === schedule)?.label}</p>
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
