import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getConfig: () => ipcRenderer.invoke("config:load"),
  saveConfig: (config: unknown) => ipcRenderer.invoke("config:save", config),
  testFirewall: (fw: unknown) => ipcRenderer.invoke("firewall:test", fw),
  testApiKey: (url: string, key: string) => ipcRenderer.invoke("api:test-key", url, key),
  getStatus: () => ipcRenderer.invoke("service:status"),
  runNow: () => ipcRenderer.invoke("firewall:run-now"),
  togglePause: () => ipcRenderer.invoke("service:toggle"),
  getVersion: () => ipcRenderer.invoke("app:version"),
  getLogs: () => ipcRenderer.invoke("logs:get"),

  onStatusUpdate: (callback: (status: unknown) => void) => {
    ipcRenderer.on("status-update", (_event, status) => callback(status));
  },
  onScanProgress: (callback: (progress: unknown) => void) => {
    ipcRenderer.on("scan-progress", (_event, progress) => callback(progress));
  },
  onLogEntry: (callback: (_event: unknown, entry: unknown) => void) => {
    ipcRenderer.on("log:entry", (_event, entry) => callback(_event, entry));
  },
});
