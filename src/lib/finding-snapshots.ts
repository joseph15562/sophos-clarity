/**
 * Finding snapshots for history and regression detection.
 * Uses localStorage since we can't create Supabase tables without migrations.
 */

export interface FindingSnapshot {
  hostname: string;
  titles: string[];
  score: number;
  timestamp: string;
}

const STORAGE_KEY_PREFIX = "firecomply-finding-snapshots:";
const MAX_SNAPSHOTS_PER_HOST = 20;

function getStorageKey(hostname: string): string {
  return `${STORAGE_KEY_PREFIX}${hostname}`;
}

/**
 * Saves a finding snapshot to localStorage, keyed by hostname.
 * Keeps up to MAX_SNAPSHOTS_PER_HOST snapshots (newest first).
 */
export function saveFindingSnapshot(
  hostname: string,
  findings: { title: string }[],
  score: number
): void {
  const snapshot: FindingSnapshot = {
    hostname,
    titles: findings.map((f) => f.title),
    score,
    timestamp: new Date().toISOString(),
  };

  const key = getStorageKey(hostname);
  let history: FindingSnapshot[] = [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as FindingSnapshot[];
      if (Array.isArray(parsed)) history = parsed;
    }
  } catch {
    // ignore parse errors
  }

  history = [snapshot, ...history].slice(0, MAX_SNAPSHOTS_PER_HOST);
  try {
    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    console.warn("[finding-snapshots] localStorage set failed", e);
  }
}

/**
 * Loads the most recent snapshot for a hostname.
 */
export function loadPreviousSnapshot(hostname: string): FindingSnapshot | null {
  const key = getStorageKey(hostname);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FindingSnapshot[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed[0];
  } catch {
    return null;
  }
}

/**
 * Loads the snapshot before the previous one (for regression detection).
 */
export function loadSnapshotBeforePrevious(hostname: string): FindingSnapshot | null {
  const key = getStorageKey(hostname);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FindingSnapshot[];
    if (!Array.isArray(parsed) || parsed.length < 2) return null;
    return parsed[1];
  } catch {
    return null;
  }
}

export interface FindingDiff {
  newFindings: string[];
  fixedFindings: string[];
  regressed: string[];
}

/**
 * Diffs previous snapshot against current findings.
 * - newFindings: in current, not in previous
 * - fixedFindings: in previous, not in current
 * - regressed: in current, not in previous, but existed in a snapshot before previous (was fixed, now back)
 */
export function diffFindings(
  previous: FindingSnapshot | null,
  current: { title: string }[],
  beforePrevious?: FindingSnapshot | null
): FindingDiff {
  const currentTitles = new Set(current.map((f) => f.title));
  const previousTitles = previous ? new Set(previous.titles) : new Set<string>();
  const beforePreviousTitles = beforePrevious ? new Set(beforePrevious.titles) : new Set<string>();

  const newFindings: string[] = [];
  const fixedFindings: string[] = [];
  const regressed: string[] = [];

  for (const t of currentTitles) {
    if (!previousTitles.has(t)) {
      if (beforePreviousTitles.has(t)) {
        regressed.push(t);
      } else {
        newFindings.push(t);
      }
    }
  }

  for (const t of previousTitles) {
    if (!currentTitles.has(t)) {
      fixedFindings.push(t);
    }
  }

  return { newFindings, fixedFindings, regressed };
}
