import { ipcMain } from "electron";
import { login } from "../firewall/auth";
import { detectCapabilities } from "../firewall/version";
import { loadConfig, saveConfig, validateConfig, type AppConfig } from "../config";
import { getLogBuffer, onLog } from "../logger";
import { queueSize } from "../api/queue";
import type { BackgroundService } from "./service";

export function registerIpcHandlers(
  configPath: string,
  getService: () => BackgroundService | null
): void {
  ipcMain.handle("config:load", () => {
    return loadConfig(configPath);
  });

  ipcMain.handle("config:save", (_event, config: AppConfig) => {
    const errors = validateConfig(config);
    if (errors.length) return { ok: false, errors };
    saveConfig(configPath, config);
    return { ok: true };
  });

  ipcMain.handle("firewall:test", async (_event, fw: { host: string; port: number; username: string; password: string; skipSslVerify: boolean }) => {
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
      return {
        ok: true,
        firmwareVersion: caps.firmwareVersion,
        apiVersion: result.apiVersion,
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

  ipcMain.handle("firewall:run-now", async () => {
    const service = getService();
    if (!service) return { ok: false, error: "Service not running" };
    service.runNow();
    return { ok: true };
  });

  ipcMain.handle("service:status", () => {
    const service = getService();
    if (!service) return { running: false, paused: false, statuses: [], queueSize: 0 };
    const config = loadConfig(configPath);
    return {
      running: true,
      paused: service.isPaused(),
      statuses: service.getStatuses(),
      queueSize: queueSize(configPath.replace("config.json", "")),
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
}
