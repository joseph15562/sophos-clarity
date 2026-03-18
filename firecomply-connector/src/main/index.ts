import { app, BrowserWindow, Menu } from "electron";
import path from "node:path";
import { setupTray } from "./tray";
import { registerIpcHandlers } from "./ipc-handlers";
import { BackgroundService } from "./service";
import { loadConfig, type AppConfig } from "../config";
import { initLogger } from "../logger";

let mainWindow: BrowserWindow | null = null;
let service: BackgroundService | null = null;

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const isDev = !app.isPackaged;

function startService(config: AppConfig): void {
  service?.stop();
  initLogger(config.logFile, config.logLevel);
  service = new BackgroundService(config, app.getPath("userData"));
  service.start();
}

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
    mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.on("close", (e) => {
    e.preventDefault();
    mainWindow?.hide();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  const config = loadConfig(CONFIG_PATH);
  if (config) {
    initLogger(config.logFile, config.logLevel);
  }

  createWindow();
  setupTray(mainWindow!, () => service?.runNow(), () => service?.togglePause());
  registerIpcHandlers(CONFIG_PATH, () => service, startService);

  if (config) {
    startService(config);
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
