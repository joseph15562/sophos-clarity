import type { MissionAlertsBundle } from "@/lib/sophos-central";

const LS_PREFIX = "fc.mc.mission_alerts.";

function storageKey(orgId: string): string {
  return `${LS_PREFIX}${orgId}`;
}

type StoredPayload = MissionAlertsBundle & { updatedAt: number };

/**
 * Last successful mission-alerts bundle per org (browser localStorage).
 * Lets Mission Control / Central Alerts paint immediately on return visits while TanStack refetches.
 */
export function readMissionAlertsBundleCache(orgId: string): {
  bundle: MissionAlertsBundle;
  updatedAt: number;
} | null {
  if (typeof window === "undefined" || !orgId) return null;
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.tenants)) return null;
    const { items, tenants, updatedAt } = parsed;
    return {
      bundle: {
        items: items as MissionAlertsBundle["items"],
        tenants: tenants as MissionAlertsBundle["tenants"],
      },
      updatedAt: typeof updatedAt === "number" ? updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function writeMissionAlertsBundleCache(orgId: string, bundle: MissionAlertsBundle): void {
  if (typeof window === "undefined" || !orgId) return;
  try {
    const payload: StoredPayload = {
      ...bundle,
      updatedAt: Date.now(),
    };
    localStorage.setItem(storageKey(orgId), JSON.stringify(payload));
  } catch (err) {
    console.warn("[mission-alerts-bundle-cache] write failed", err);
  }
}
