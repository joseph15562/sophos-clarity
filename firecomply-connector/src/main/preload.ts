import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (config: unknown) => ipcRenderer.invoke("save-config", config),
  testFirewall: (fw: unknown) => ipcRenderer.invoke("test-firewall", fw),
  getStatus: () => ipcRenderer.invoke("get-status"),
  runNow: () => ipcRenderer.invoke("run-now"),
  togglePause: () => ipcRenderer.invoke("toggle-pause"),
  getVersion: () => ipcRenderer.invoke("get-version"),
  getLogs: () => ipcRenderer.invoke("get-logs"),

  onStatusUpdate: (callback: (status: unknown) => void) => {
    ipcRenderer.on("status-update", (_event, status) => callback(status));
  },
  onScanProgress: (callback: (progress: unknown) => void) => {
    ipcRenderer.on("scan-progress", (_event, progress) => callback(progress));
  },
});
