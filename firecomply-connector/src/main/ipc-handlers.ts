import { app, ipcMain, shell } from "electron";
import { login, getDeviceInfo } from "../firewall/auth";
import { testSnmpConnection } from "../firewall/snmp";
import { detectCapabilities } from "../firewall/version";
import { loadConfig, saveConfig, validateConfig, type AppConfig } from "../config";
import { getLogBuffer, onLog } from "../logger";
import { queueSize } from "../api/queue";
import type { BackgroundService } from "./service";

const GITHUB_RELEASES_URL = "https://api.github.com/repos/joseph15562/sophos-clarity/releases";

interface UpdateCheckResult {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  downloadUrl?: string;
  releaseNotes?: string;
  error?: string;
}

export function registerIpcHandlers(
  configPath: string,
  getService: () => BackgroundService | null,
  restartService?: (config: AppConfig) => void
): void {
  ipcMain.handle("api:test-key", async (_event, url: string, key: string) => {
    try {
      const res = await fetch(`${url}/api/agent/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: JSON.stringify({ status: "test" }),
      });
      return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("config:load", () => {
    return loadConfig(configPath);
  });

  ipcMain.handle("config:save", (_event, config: AppConfig) => {
    const errors = validateConfig(config);
    if (errors.length) return { ok: false, errors };
    saveConfig(configPath, config);
    restartService?.(config);
    return { ok: true };
  });

  ipcMain.handle("firewall:test", async (_event, fw: { host: string; port: number; username: string; password: string; skipSslVerify: boolean; snmpCommunity?: string }) => {
    try {
      const result = await login({
        host: fw.host,
        port: fw.port,
        username: fw.username,
        password: fw.password,
        skipSslVerify: fw.skipSslVerify ?? true,
      });

      if (!result.success) {
        return { ok: false, error: result.error };
      }

      const caps = detectCapabilities(result.apiVersion);
      const creds = { host: fw.host, port: fw.port, username: fw.username, password: fw.password, skipSslVerify: fw.skipSslVerify ?? true };
      const deviceInfo = await getDeviceInfo(creds, fw.snmpCommunity);

      return {
        ok: true,
        firmwareVersion: caps.firmwareVersion,
        apiVersion: result.apiVersion,
        serialNumber: deviceInfo.serialNumber ?? undefined,
        hardwareModel: deviceInfo.hardwareModel ?? undefined,
        capabilities: {
          hasAtp: caps.hasAtp,
          hasMdr: caps.hasMdr,
          hasNdr: caps.hasNdr,
          hasSslTlsInspection: caps.hasSslTlsInspection,
          hasThirdPartyFeeds: caps.hasThirdPartyFeeds,
        },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("snmp:test", async (_event, host: string, community: string) => {
    try {
      return await testSnmpConnection(host, community);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("firewall:run-now", async () => {
    const service = getService();
    if (!service) return { ok: false, error: "Service not running" };
    service.runNow();
    return { ok: true };
  });

  ipcMain.handle("service:status", () => {
    const service = getService();
    if (!service) return { running: false, paused: false, statuses: [], queueSize: 0, heartbeat: null };
    return {
      running: true,
      paused: service.isPaused(),
      statuses: service.getStatuses(),
      queueSize: queueSize(configPath.replace("config.json", "")),
      heartbeat: service.getHeartbeatInfo(),
    };
  });

  ipcMain.handle("service:toggle", () => {
    const service = getService();
    if (!service) return;
    service.togglePause();
  });

  ipcMain.handle("logs:get", () => {
    return getLogBuffer();
  });

  ipcMain.handle("logs:stream", (event) => {
    const unsubscribe = onLog((entry) => {
      event.sender.send("log:entry", entry);
    });
    event.sender.on("destroyed", unsubscribe);
  });

  ipcMain.handle("app:check-update", async (): Promise<UpdateCheckResult> => {
    const currentVersion = app.getVersion();
    try {
      const res = await fetch(GITHUB_RELEASES_URL, {
        headers: { "Accept": "application/vnd.github+json", "User-Agent": "FireComply-Connector" },
      });
      if (!res.ok) return { available: false, currentVersion, error: `GitHub API: ${res.status}` };

      const releases = (await res.json()) as Array<{ tag_name: string; html_url: string; body?: string; assets?: Array<{ name: string; browser_download_url: string }> }>;
      const connectorReleases = releases.filter((r) => r.tag_name.startsWith("connector-v"));
      if (connectorReleases.length === 0) return { available: false, currentVersion, error: "No connector releases found" };

      const latest = connectorReleases[0];
      const latestVersion = latest.tag_name.replace("connector-v", "");

      const isNewer = compareVersions(latestVersion, currentVersion) > 0;
      const exeAsset = latest.assets?.find((a) => a.name.endsWith(".exe"));

      return {
        available: isNewer,
        currentVersion,
        latestVersion,
        downloadUrl: exeAsset?.browser_download_url ?? latest.html_url,
        releaseNotes: latest.body ?? undefined,
      };
    } catch (err) {
      return { available: false, currentVersion, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("app:open-url", (_event, url: string) => {
    shell.openExternal(url);
  });
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}
