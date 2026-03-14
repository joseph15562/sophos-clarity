import fs from "node:fs";
import path from "node:path";

export interface FirewallConfig {
  label: string;
  host: string;
  port: number;
  username: string;
  password: string;
  skipSslVerify: boolean;
  versionOverride: string | null;
}

export interface AppConfig {
  firecomplyApiUrl: string;
  agentApiKey: string;
  firewalls: FirewallConfig[];
  schedule: string;
  proxy: string | null;
  logFile: string | null;
  logLevel: "debug" | "info" | "warn" | "error";
}

const DEFAULT_CONFIG: AppConfig = {
  firecomplyApiUrl: "",
  agentApiKey: "",
  firewalls: [],
  schedule: "0 2 * * *",
  proxy: null,
  logFile: "./firecomply-connector.log",
  logLevel: "info",
};

export function loadConfig(configPath: string): AppConfig | null {
  try {
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return null;
  }
}

export function saveConfig(configPath: string, config: AppConfig): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];
  if (!config.firecomplyApiUrl) errors.push("FireComply API URL is required");
  if (!config.agentApiKey) errors.push("Agent API key is required");
  if (!config.firewalls.length) errors.push("At least one firewall must be configured");
  for (const fw of config.firewalls) {
    if (!fw.host) errors.push(`Firewall "${fw.label}": host is required`);
    if (!fw.username) errors.push(`Firewall "${fw.label}": username is required`);
    if (!fw.password) errors.push(`Firewall "${fw.label}": password is required`);
  }
  return errors;
}
