import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const SCHEDULES = [
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 */12 * * *", label: "Every 12 hours" },
  { value: "0 2 * * *", label: "Daily at 02:00" },
  { value: "0 2 * * 1", label: "Weekly (Monday 02:00)" },
];

interface FirewallEntry {
  label: string;
  host: string;
  port: number;
  username: string;
  password: string;
  skipSslVerify: boolean;
  snmpCommunity?: string;
  versionOverride: string | null;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<any>(null);
  const [customerName, setCustomerName] = useState("");
  const [schedule, setSchedule] = useState("0 2 * * *");
  const [firewalls, setFirewalls] = useState<FirewallEntry[]>([]);
  const [editingFw, setEditingFw] = useState<number | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [testingSnmp, setTestingSnmp] = useState<number | null>(null);
  const [snmpResult, setSnmpResult] = useState<{ idx: number; ok: boolean; detail: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [version, setVersion] = useState("1.0.0");
  const [updater, setUpdater] = useState<UpdaterStatus | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    window.electronAPI?.getConfig().then((cfg: any) => {
      if (cfg) {
        setConfig(cfg);
        setCustomerName(cfg.customerName ?? "");
        setSchedule(cfg.schedule ?? "0 2 * * *");
        setFirewalls(cfg.firewalls ?? []);
      }
    });
    window.electronAPI?.getVersion().then((v: string) => {
      if (v) setVersion(v);
    });
    window.electronAPI?.onUpdaterStatus((status: UpdaterStatus) => {
      setUpdater(status);
      if (status.status === "checking") setCheckingUpdate(true);
      else setCheckingUpdate(false);
      if (status.status !== "downloading") setDownloading(false);
    });
  }, []);

  const updateFirewall = (idx: number, patch: Partial<FirewallEntry>) => {
    setFirewalls((prev) => prev.map((fw, i) => (i === idx ? { ...fw, ...patch } : fw)));
    setDirty(true);
  };

  const addFirewall = () => {
    setFirewalls((prev) => [
      ...prev,
      {
        label: "",
        host: "",
        port: 4444,
        username: "",
        password: "",
        skipSslVerify: true,
        snmpCommunity: "",
        versionOverride: null,
      },
    ]);
    setEditingFw(firewalls.length);
    setDirty(true);
  };

  const removeFirewall = (idx: number) => {
    if (firewalls.length <= 1) {
      toast.error("At least one firewall is required");
      return;
    }
    setFirewalls((prev) => prev.filter((_, i) => i !== idx));
    setEditingFw(null);
    setDirty(true);
  };

  const testFirewall = async (idx: number) => {
    const fw = firewalls[idx];
    setTesting(idx);
    try {
      const result = await window.electronAPI?.testFirewall({
        host: fw.host,
        port: fw.port,
        username: fw.username,
        password: fw.password,
        skipSslVerify: fw.skipSslVerify,
        snmpCommunity: fw.snmpCommunity || undefined,
      });
      if (result?.ok) {
        toast.success(
          `Connected — ${result.firmwareVersion}${result.serialNumber ? ` · SN: ${result.serialNumber}` : ""}`,
        );
      } else {
        toast.error(result?.error ?? "Connection failed");
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
    setSnmpResult(null);
    try {
      const result = await window.electronAPI?.testSnmp(fw.host, fw.snmpCommunity);
      if (result?.ok) {
        const parts = [];
        if (result.serialNumber) parts.push(`SN: ${result.serialNumber}`);
        if (result.model) parts.push(`Model: ${result.model}`);
        if (result.hostname) parts.push(`Host: ${result.hostname}`);
        if (result.firmwareVersion) parts.push(`FW: ${result.firmwareVersion}`);
        toast.success(`SNMP OK — ${parts.join(" · ") || "Connected"}`);
        setSnmpResult({
          idx,
          ok: true,
          detail: parts.join("\n") || "Connected but no Sophos OIDs returned",
        });
      } else {
        toast.error(result?.error ?? "SNMP test failed");
        setSnmpResult({ idx, ok: false, detail: result?.error ?? "Unknown error" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SNMP test failed";
      toast.error(msg);
      setSnmpResult({ idx, ok: false, detail: msg });
    }
    setTestingSnmp(null);
  };

  const saveAll = async () => {
    if (!config) return;
    setSaving(true);
    const updated = { ...config, customerName, schedule, firewalls };
    const result = await window.electronAPI?.saveConfig(updated);
    if (result?.ok) {
      setConfig(updated);
      setDirty(false);
      setEditingFw(null);
      toast.success("Settings saved — service restarted");
    } else {
      toast.error(result?.errors?.join(", ") ?? "Failed to save");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Dashboard
          </button>
          <h1 className="text-lg font-bold text-foreground">Settings</h1>
          <button
            onClick={() => navigate("/help")}
            className="text-xs text-[#6B5BFF] hover:underline ml-auto"
          >
            Help
          </button>
        </div>
        {dirty && (
          <button
            onClick={saveAll}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#6B5BFF] text-white text-xs font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save All Changes"}
          </button>
        )}
      </div>

      {/* Customer Name */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Customer Name</h2>
        <p className="text-[10px] text-muted-foreground">
          The client/tenant name shown in reports and the dashboard.
        </p>
        <input
          value={customerName}
          onChange={(e) => {
            setCustomerName(e.target.value);
            setDirty(true);
          }}
          placeholder="e.g. Acme Corp"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Firewalls */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Firewalls</h2>
          <button onClick={addFirewall} className="text-xs text-[#6B5BFF] hover:underline">
            + Add firewall
          </button>
        </div>

        {firewalls.map((fw, idx) => {
          const isEditing = editingFw === idx;
          return (
            <div key={idx} className="border border-border rounded-lg overflow-hidden">
              {/* Collapsed row */}
              <div
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/20"
                onClick={() => setEditingFw(isEditing ? null : idx)}
              >
                <span className="text-xs font-medium text-foreground flex-1">
                  {fw.label || fw.host || "New firewall"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {fw.host ? `${fw.host}:${fw.port}` : "Not configured"}
                </span>
                {fw.snmpCommunity && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                    SNMP
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">{isEditing ? "▲" : "▼"}</span>
              </div>

              {/* Expanded editor */}
              {isEditing && (
                <div className="border-t border-border px-3 py-3 space-y-3 bg-muted/10">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Label</label>
                    <input
                      value={fw.label}
                      onChange={(e) => updateFirewall(idx, { label: e.target.value })}
                      placeholder="e.g. HQ Primary"
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[10px] text-muted-foreground block mb-1">
                        Host / IP
                      </label>
                      <input
                        value={fw.host}
                        onChange={(e) => updateFirewall(idx, { host: e.target.value })}
                        placeholder="192.168.1.1"
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Port</label>
                      <input
                        type="number"
                        value={fw.port}
                        onChange={(e) =>
                          updateFirewall(idx, { port: parseInt(e.target.value) || 4444 })
                        }
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">
                        API Username
                      </label>
                      <input
                        value={fw.username}
                        onChange={(e) => updateFirewall(idx, { username: e.target.value })}
                        placeholder="firecomply-api"
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">
                        API Password
                      </label>
                      <input
                        type="password"
                        value={fw.password}
                        onChange={(e) => updateFirewall(idx, { password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">
                      SNMP Community (optional — for serial number)
                    </label>
                    <input
                      value={fw.snmpCommunity ?? ""}
                      onChange={(e) => updateFirewall(idx, { snmpCommunity: e.target.value })}
                      placeholder="e.g. firecomply-ro"
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                    />
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
                    <button
                      onClick={() => removeFirewall(idx)}
                      className="text-xs px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>

                  {snmpResult && snmpResult.idx === idx && (
                    <div
                      className={`rounded-lg px-3 py-2 text-xs ${snmpResult.ok ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-400"}`}
                    >
                      <p className="font-medium">
                        {snmpResult.ok ? "✓ SNMP Connected" : "✗ SNMP Failed"}
                      </p>
                      <p className="whitespace-pre-wrap mt-1 text-[10px] opacity-80">
                        {snmpResult.detail}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Schedule */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Schedule</h2>
        <select
          value={schedule}
          onChange={(e) => {
            setSchedule(e.target.value);
            setDirty(true);
          }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {SCHEDULES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* About & Updates */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">About</h2>
          <button
            onClick={async () => {
              setCheckingUpdate(true);
              setUpdater(null);
              try {
                await window.electronAPI?.updaterCheck();
              } catch {
                setUpdater({ status: "error", error: "Failed to check for updates" });
                setCheckingUpdate(false);
              }
            }}
            disabled={checkingUpdate || downloading}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#6B5BFF] text-white hover:bg-[#5a4be6] disabled:opacity-50"
          >
            {checkingUpdate ? "Checking…" : "Check for Updates"}
          </button>
        </div>
        <p>FireComply Connector v{version}</p>
        <p>API: {config?.firecomplyApiUrl ?? "Not configured"}</p>
        <p className="text-[10px]">
          Updates are downloaded and installed automatically. The connector restarts briefly to
          apply them.
        </p>

        {updater && (
          <div
            className={`rounded-lg px-3 py-2.5 mt-2 ${
              updater.status === "available" || updater.status === "downloading"
                ? "bg-blue-500/10 border border-blue-500/20"
                : updater.status === "ready"
                  ? "bg-green-500/10 border border-green-500/20"
                  : updater.status === "error"
                    ? "bg-red-500/10 border border-red-500/20"
                    : "bg-muted/20 border border-border"
            }`}
          >
            {updater.status === "available" && (
              <p className="text-blue-500 font-medium">
                Update found: v{updater.version} — downloading…
              </p>
            )}

            {updater.status === "downloading" && (
              <div className="space-y-2">
                <p className="text-blue-500 font-medium">
                  Downloading v{updater.version}… {updater.percent ?? 0}%
                </p>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#6B5BFF] h-full rounded-full transition-all duration-300"
                    style={{ width: `${updater.percent ?? 0}%` }}
                  />
                </div>
                {updater.total != null && (
                  <p className="text-[10px] text-muted-foreground">
                    {((updater.transferred ?? 0) / 1048576).toFixed(1)} /{" "}
                    {(updater.total / 1048576).toFixed(1)} MB
                  </p>
                )}
              </div>
            )}

            {updater.status === "ready" && (
              <div className="space-y-2">
                <p className="text-green-500 font-medium">
                  v{updater.version} downloaded — restarting to install…
                </p>
                <button
                  onClick={() => window.electronAPI?.updaterInstall()}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700"
                >
                  Install Now
                </button>
              </div>
            )}

            {updater.status === "up-to-date" && (
              <p className="text-muted-foreground">You're on the latest version (v{version})</p>
            )}

            {updater.status === "error" && <p className="text-red-400">{updater.error}</p>}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-card border border-red-500/30 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-red-500">Danger Zone</h2>
        <p className="text-[10px] text-muted-foreground">
          Disconnect this agent and clear all settings. You'll need to re-enter your API key and
          firewall credentials.
        </p>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10"
          >
            Disconnect & Re-setup
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setResetting(true);
                try {
                  const result = await window.electronAPI?.resetConfig();
                  if (result?.ok) {
                    toast.success("Configuration cleared");
                    navigate("/setup", { replace: true });
                  } else {
                    toast.error(result?.error ?? "Failed to reset");
                    setConfirmReset(false);
                  }
                } catch {
                  toast.error("Failed to reset");
                  setConfirmReset(false);
                }
                setResetting(false);
              }}
              disabled={resetting}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {resetting ? "Resetting…" : "Yes, clear everything"}
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
