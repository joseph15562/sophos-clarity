interface ElectronAPI {
  getConfig(): Promise<any>;
  saveConfig(config: any): Promise<{ ok: boolean; errors?: string[] }>;
  testFirewall(fw: { host: string; port: number; username: string; password: string; skipSslVerify: boolean; snmpCommunity?: string }): Promise<{ ok: boolean; firmwareVersion?: string; serialNumber?: string; hardwareModel?: string; apiVersion?: string; error?: string; capabilities?: any }>;
  testSnmp(host: string, community: string): Promise<{ ok: boolean; serialNumber?: string; model?: string; hostname?: string; firmwareVersion?: string; error?: string; rawOids?: Record<string, string> }>;
  testApiKey(url: string, key: string): Promise<{ ok: boolean; error?: string }>;
  getStatus(): Promise<{ running: boolean; paused: boolean; statuses: any[]; queueSize: number; heartbeat: any }>;
  runNow(): Promise<{ ok: boolean }>;
  togglePause(): Promise<void>;
  getVersion(): Promise<string>;
  checkForUpdate(): Promise<{ available: boolean; currentVersion: string; latestVersion?: string; downloadUrl?: string; releaseNotes?: string; error?: string }>;
  openUrl(url: string): Promise<void>;
  getLogs(): Promise<any[]>;
  onStatusUpdate(callback: (status: unknown) => void): void;
  onScanProgress(callback: (progress: unknown) => void): void;
}

interface Window {
  electronAPI: ElectronAPI;
}
