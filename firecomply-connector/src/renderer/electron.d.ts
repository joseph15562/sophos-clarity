interface ElectronAPI {
  getConfig(): Promise<any>;
  saveConfig(config: any): Promise<{ ok: boolean; errors?: string[] }>;
  testFirewall(fw: { host: string; port: number; username: string; password: string; skipSslVerify: boolean }): Promise<{ ok: boolean; firmwareVersion?: string; apiVersion?: string; error?: string; capabilities?: any }>;
  testApiKey(url: string, key: string): Promise<{ ok: boolean; error?: string }>;
  getStatus(): Promise<{ running: boolean; paused: boolean; statuses: any[]; queueSize: number }>;
  runNow(): Promise<{ ok: boolean }>;
  togglePause(): Promise<void>;
  getVersion(): Promise<string>;
  getLogs(): Promise<any[]>;
  onStatusUpdate(callback: (status: unknown) => void): void;
  onScanProgress(callback: (progress: unknown) => void): void;
}

interface Window {
  electronAPI: ElectronAPI;
}
