import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { setupTray } from "./tray";
import { registerIpcHandlers } from "./ipc-handlers";
import { BackgroundService } from "./service";
import { loadConfig } from "../config";
import { initLogger } from "../logger";

let mainWindow: BrowserWindow | null = null;
let service: BackgroundService | null = null;

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const isDev = !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    title: "FireComply Connector",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.on("close", (e) => {
    e.preventDefault();
    mainWindow?.hide();
  });
}

app.whenReady().then(() => {
  const config = loadConfig(CONFIG_PATH);
  if (config) {
    initLogger(config.logFile, config.logLevel);
  }

  createWindow();
  setupTray(mainWindow!, () => service?.runNow(), () => service?.togglePause());
  registerIpcHandlers(CONFIG_PATH, () => service);

  if (config) {
    service = new BackgroundService(config, app.getPath("userData"));
    service.start();
  }
});

app.on("window-all-closed", () => {
  // Keep running in tray
});

app.on("before-quit", () => {
  service?.stop();
  mainWindow?.destroy();
});

export { service, CONFIG_PATH };
