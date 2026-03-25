import { autoUpdater, type UpdateInfo } from "electron-updater";
import { BrowserWindow, ipcMain } from "electron";
import { log } from "../logger";

autoUpdater.logger = {
  info: (msg: string) => log.info(`[updater] ${msg}`),
  warn: (msg: string) => log.warn(`[updater] ${msg}`),
  error: (msg: string) => log.error(`[updater] ${msg}`),
  debug: (msg: string) => log.debug(`[updater] ${msg}`),
};
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const AUTO_RESTART_DELAY_MS = 10_000;

let mainWin: BrowserWindow | null = null;

function send(channel: string, ...args: unknown[]) {
  mainWin?.webContents?.send(channel, ...args);
}

export function initAutoUpdater(win: BrowserWindow) {
  mainWin = win;

  autoUpdater.on("checking-for-update", () => {
    send("updater:status", { status: "checking" });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    log.info(`[updater] Update available: v${info.version} — downloading automatically`);
    send("updater:status", {
      status: "available",
      version: info.version,
      releaseNotes:
        typeof info.releaseNotes === "string"
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map((n) => n.note).join("\n")
            : undefined,
    });
  });

  autoUpdater.on("update-not-available", () => {
    send("updater:status", { status: "up-to-date" });
  });

  autoUpdater.on("download-progress", (progress) => {
    send("updater:status", {
      status: "downloading",
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    log.info(
      `[updater] v${info.version} downloaded — restarting in ${AUTO_RESTART_DELAY_MS / 1000}s to apply`,
    );
    send("updater:status", {
      status: "ready",
      version: info.version,
      autoRestartIn: AUTO_RESTART_DELAY_MS,
    });

    setTimeout(() => {
      log.info("[updater] Auto-restarting to install update");
      autoUpdater.quitAndInstall(false, true);
    }, AUTO_RESTART_DELAY_MS);
  });

  autoUpdater.on("error", (err) => {
    send("updater:status", {
      status: "error",
      error: err?.message ?? String(err),
    });
  });

  ipcMain.handle("updater:check", async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, version: result?.updateInfo?.version };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("updater:download", async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("updater:install", () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // Check for updates 30s after launch, then every 4 hours
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 30_000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}
