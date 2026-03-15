import fs from "node:fs";
import path from "node:path";

// SafeStorage from Electron — not available in tests or non-Electron contexts
let safeStorage: { encryptString(plainText: string): Buffer; decryptString(encrypted: Buffer): string } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electron = require("electron");
  if (electron.safeStorage?.isEncryptionAvailable?.()) {
    safeStorage = electron.safeStorage;
  }
} catch {
  // Not in Electron (e.g. tests) — encryption unavailable
}

const ENC_PREFIX = "enc:";

function encryptField(value: string): string {
  if (!value) return value;
  if (!safeStorage) return value;
  try {
    const buf = safeStorage.encryptString(value);
    return ENC_PREFIX + Buffer.from(buf).toString("base64");
  } catch {
    return value;
  }
}

function decryptField(encoded: string): string {
  if (!encoded) return encoded;
  if (!encoded.startsWith(ENC_PREFIX)) return encoded; // backward compatibility: plain text
  if (!safeStorage) return encoded;
  try {
    const b64 = encoded.slice(ENC_PREFIX.length);
    const buf = Buffer.from(b64, "base64");
    return safeStorage.decryptString(buf);
  } catch {
    return encoded;
  }
}

export interface FirewallConfig {
  label: string;
  host: string;
  port: number;
  username: string;
  password: string;
  skipSslVerify: boolean;
  versionOverride: string | null;
  snmpCommunity?: string;
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
    const config = { ...DEFAULT_CONFIG, ...parsed };
    // Decrypt sensitive fields (backward compatible: plain text if no enc: prefix)
    config.agentApiKey = decryptField(config.agentApiKey);
    if (config.firewalls) {
      config.firewalls = config.firewalls.map((fw: FirewallConfig & Record<string, unknown>) => ({
        ...fw,
        port: fw.port ?? 4444,
        password: decryptField(fw.password),
      }));
    }
    return config;
  } catch {
    return null;
  }
}

export function saveConfig(configPath: string, config: AppConfig): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Encrypt sensitive fields before persisting
  const toSave: AppConfig = {
    ...config,
    agentApiKey: encryptField(config.agentApiKey),
    firewalls: config.firewalls.map((fw) => ({
      ...fw,
      password: encryptField(fw.password),
    })),
  };
  fs.writeFileSync(configPath, JSON.stringify(toSave, null, 2), "utf-8");
}

function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];
  if (!config.firecomplyApiUrl) errors.push("FireComply API URL is required");
  else if (!isValidUrl(config.firecomplyApiUrl)) errors.push("FireComply API URL must be a valid http or https URL");
  if (!config.agentApiKey) errors.push("Agent API key is required");
  if (!config.firewalls.length) errors.push("At least one firewall must be configured");
  for (const fw of config.firewalls) {
    if (!fw.host) errors.push(`Firewall "${fw.label}": host is required`);
    if (!fw.username) errors.push(`Firewall "${fw.label}": username is required`);
    if (!fw.password) errors.push(`Firewall "${fw.label}": password is required`);
    if (!isValidPort(fw.port)) errors.push(`Firewall "${fw.label}": port must be between 1 and 65535`);
  }
  return errors;
}
