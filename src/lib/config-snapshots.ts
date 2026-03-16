/**
 * Configuration snapshots — store config metadata over time for version control.
 * For now, stored in localStorage. Supabase migration pending.
 */

export interface ConfigSnapshot {
  id: string;
  hostname: string;
  customer_name: string;
  section_keys: string[];
  section_count: number;
  rule_count: number;
  findings_count: number;
  overall_score: number;
  snapshot_hash: string;
  created_at: string;
  /** Optional: raw sections for ConfigDiff comparison */
  sections?: Record<string, unknown>;
}

/** Generate a hash of the config for deduplication */
export function hashConfig(sections: Record<string, unknown>): string {
  const str = JSON.stringify(sections);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

const STORAGE_KEY = "sophos-config-snapshots";

export function saveConfigSnapshot(snapshot: Omit<ConfigSnapshot, "id" | "created_at">): ConfigSnapshot {
  const snapshots = loadConfigSnapshots();
  // Skip if identical hash already exists for same hostname within 1 hour
  const recent = snapshots.find(s =>
    s.hostname === snapshot.hostname &&
    s.snapshot_hash === snapshot.snapshot_hash &&
    Date.now() - new Date(s.created_at).getTime() < 3600000
  );
  if (recent) return recent;

  const { sections: _sections, ...withoutSections } = snapshot as ConfigSnapshot;
  const newSnapshot: ConfigSnapshot = {
    ...withoutSections,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  snapshots.push(newSnapshot);
  while (snapshots.length > 100) snapshots.shift();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    while (snapshots.length > 10) snapshots.shift();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots)); } catch { /* quota still exceeded, give up */ }
  }
  return newSnapshot;
}

export function loadConfigSnapshots(hostname?: string): ConfigSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: ConfigSnapshot[] = raw ? JSON.parse(raw) : [];
    if (hostname) return all.filter(s => s.hostname === hostname);
    return all;
  } catch { return []; }
}
