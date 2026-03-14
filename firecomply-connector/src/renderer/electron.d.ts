interface ElectronAPI {
  loadConfig(): Promise<any>;
  saveConfig(config: any): Promise<{ ok: boolean; errors?: string[] }>;
  testFirewall(fw: { host: string; port: number; username: string; password: string; skipSslVerify: boolean }): Promise<{ ok: boolean; firmwareVersion?: string; apiVersion?: string; error?: string; capabilities?: any }>;
  testApiKey(url: string, key: string): Promise<{ ok: boolean; error?: string }>;
  runNow(): Promise<{ ok: boolean }>;
  getStatus(): Promise<{ running: boolean; paused: boolean; statuses: any[]; queueSize: number }>;
  togglePause(): Promise<void>;
  getLogs(): Promise<any[]>;
  onLogEntry(handler: (event: unknown, entry: any) => void): void;
}

interface Window {
  electronAPI: ElectronAPI;
}
