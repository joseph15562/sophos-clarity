/**
 * Accepted/suppressed findings — findings the user has explicitly acknowledged as acceptable risk.
 * Uses Supabase when authenticated, falls back to localStorage for guests.
 */

import { supabase } from "@/integrations/supabase/client";
import { warnOptionalError } from "@/lib/client-error-feedback";

const STORAGE_KEY = "sophos-accepted-findings";

export interface AcceptedFinding {
  findingTitle: string;
  acceptedAt: string;
  acceptedBy?: string;
  reason?: string;
}

function loadFromStorage(): AcceptedFinding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    warnOptionalError("accepted-findings.load", e);
    return [];
  }
}

function saveToStorage(items: AcceptedFinding[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("accepted-findings-changed"));
  } catch (e) {
    warnOptionalError("accepted-findings.save", e);
  }
}

export async function loadAcceptedFindings(): Promise<AcceptedFinding[]> {
  return loadFromStorage();
}

export async function acceptFinding(title: string, reason?: string): Promise<void> {
  const items = loadFromStorage();
  if (items.some((i) => i.findingTitle === title)) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  items.push({
    findingTitle: title,
    acceptedAt: new Date().toISOString(),
    acceptedBy: user?.email ?? undefined,
    reason,
  });
  saveToStorage(items);
}

export async function unacceptFinding(title: string): Promise<void> {
  const items = loadFromStorage().filter((i) => i.findingTitle !== title);
  saveToStorage(items);
}

export function isAccepted(acceptedList: AcceptedFinding[], findingTitle: string): boolean {
  return acceptedList.some((a) => a.findingTitle === findingTitle);
}
