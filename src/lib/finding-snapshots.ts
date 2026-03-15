/**
 * Finding snapshots for history and regression detection.
 * Uses Supabase when authenticated, falls back to localStorage for guests.
 */

import { supabase } from "@/integrations/supabase/client";

export interface FindingSnapshot {
  hostname: string;
  titles: string[];
  score: number;
  timestamp: string;
}

const STORAGE_KEY_PREFIX = "firecomply-finding-snapshots:";
const MAX_SNAPSHOTS_PER_HOST = 20;

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}

export async function saveFindingSnapshot(
  hostname: string,
  findings: { title: string }[],
  score: number
): Promise<void> {
  const titles = findings.map((f) => f.title);
  const orgId = await getOrgId();

  if (orgId) {
    const { error } = await supabase.from("finding_snapshots").insert({
      org_id: orgId,
      hostname,
      titles,
      score,
    });
    if (error) console.warn("[finding-snapshots] Supabase insert failed, falling back to localStorage", error.message);
    else return;
  }

  // localStorage fallback for guests
  const snapshot: FindingSnapshot = { hostname, titles, score, timestamp: new Date().toISOString() };
  const key = `${STORAGE_KEY_PREFIX}${hostname}`;
  try {
    let history: FindingSnapshot[] = [];
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as FindingSnapshot[];
      if (Array.isArray(parsed)) history = parsed;
    }
    history = [snapshot, ...history].slice(0, MAX_SNAPSHOTS_PER_HOST);
    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    console.warn("[finding-snapshots] localStorage set failed", e);
  }
}

export async function loadPreviousSnapshot(hostname: string): Promise<FindingSnapshot | null> {
  const orgId = await getOrgId();

  if (orgId) {
    const { data } = await supabase
      .from("finding_snapshots")
      .select("hostname, titles, score, created_at")
      .eq("org_id", orgId)
      .eq("hostname", hostname)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      return { hostname: data[0].hostname, titles: data[0].titles, score: data[0].score, timestamp: data[0].created_at };
    }
  }

  // localStorage fallback
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${hostname}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FindingSnapshot[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
  } catch { return null; }
}

export async function loadSnapshotBeforePrevious(hostname: string): Promise<FindingSnapshot | null> {
  const orgId = await getOrgId();

  if (orgId) {
    const { data } = await supabase
      .from("finding_snapshots")
      .select("hostname, titles, score, created_at")
      .eq("org_id", orgId)
      .eq("hostname", hostname)
      .order("created_at", { ascending: false })
      .limit(2);
    if (data && data.length >= 2) {
      return { hostname: data[1].hostname, titles: data[1].titles, score: data[1].score, timestamp: data[1].created_at };
    }
  }

  // localStorage fallback
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${hostname}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FindingSnapshot[];
    return Array.isArray(parsed) && parsed.length >= 2 ? parsed[1] : null;
  } catch { return null; }
}

export interface FindingDiff {
  newFindings: string[];
  fixedFindings: string[];
  regressed: string[];
}

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
