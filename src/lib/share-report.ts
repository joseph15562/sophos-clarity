/** Shared report stored in localStorage (client-side scaffold until Supabase migration) */

export interface SharedReport {
  token: string;
  markdown: string;
  customerName: string;
  expiresAt: string;
  createdAt: string;
}

const STORAGE_PREFIX = "sophos-shared-report:";

/** Generates a random share token */
export function generateShareToken(): string {
  return crypto.randomUUID();
}

/** Saves a shared report to localStorage with expiry */
export function saveSharedReport(
  token: string,
  reportMarkdown: string,
  customerName: string,
  expiresInDays = 7
): SharedReport {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const report: SharedReport = {
    token,
    markdown: reportMarkdown,
    customerName,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  };

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${token}`, JSON.stringify(report));
  } catch (e) {
    console.warn("[share-report] localStorage set failed", e);
  }

  return report;
}

/** Loads a shared report from localStorage; returns null if expired or not found */
export function loadSharedReport(token: string): SharedReport | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${token}`);
    if (!raw) return null;

    const report = JSON.parse(raw) as SharedReport;
    const expiresAt = new Date(report.expiresAt);
    if (expiresAt <= new Date()) return null;

    return report;
  } catch {
    return null;
  }
}
