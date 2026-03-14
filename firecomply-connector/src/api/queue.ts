import fs from "node:fs";
import path from "node:path";
import type { SubmissionPayload } from "./submit";

const QUEUE_DIR = "submission-queue";

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function enqueue(baseDir: string, payload: SubmissionPayload): void {
  const dir = path.join(baseDir, QUEUE_DIR);
  ensureDir(dir);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(payload), "utf-8");
}

export function dequeueAll(baseDir: string): Array<{ file: string; payload: SubmissionPayload }> {
  const dir = path.join(baseDir, QUEUE_DIR);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf-8");
        return { file, payload: JSON.parse(raw) as SubmissionPayload };
      } catch {
        return null;
      }
    })
    .filter((x): x is { file: string; payload: SubmissionPayload } => x !== null);
}

export function removeQueued(baseDir: string, file: string): void {
  const filepath = path.join(baseDir, QUEUE_DIR, file);
  try { fs.unlinkSync(filepath); } catch { /* ignore */ }
}

export function queueSize(baseDir: string): number {
  const dir = path.join(baseDir, QUEUE_DIR);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}
