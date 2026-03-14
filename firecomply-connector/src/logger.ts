import fs from "node:fs";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  firewall?: string;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MAX_BUFFER = 1000;

let logFile: string | null = null;
let minLevel: LogLevel = "info";
const buffer: LogEntry[] = [];
const listeners: Array<(entry: LogEntry) => void> = [];

export function initLogger(file: string | null, level: LogLevel = "info"): void {
  logFile = file;
  minLevel = level;
}

export function onLog(fn: (entry: LogEntry) => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function getLogBuffer(): LogEntry[] {
  return [...buffer];
}

function emit(level: LogLevel, message: string, firewall?: string): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    firewall,
  };

  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  const line = `[${entry.timestamp}] ${entry.level.toUpperCase().padEnd(5)} ${firewall ? `[${firewall}] ` : ""}${message}`;
  console.log(line);

  if (logFile) {
    try { fs.appendFileSync(logFile, line + "\n"); } catch { /* ignore */ }
  }

  for (const fn of listeners) {
    try { fn(entry); } catch { /* ignore */ }
  }
}

export const log = {
  debug: (msg: string, fw?: string) => emit("debug", msg, fw),
  info: (msg: string, fw?: string) => emit("info", msg, fw),
  warn: (msg: string, fw?: string) => emit("warn", msg, fw),
  error: (msg: string, fw?: string) => emit("error", msg, fw),
};
