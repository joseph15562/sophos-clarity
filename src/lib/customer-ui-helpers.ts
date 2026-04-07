import type { CustomerDirectoryEntry } from "@/lib/customer-directory";

export type CrmLifecycleStatus = "Active" | "Onboarding" | "Churned";

/** Hash name to stable hue for avatar background (HSL). */
export function avatarHueFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Synthetic open-alert count for CRM-style stats row. */
export function customerOpenAlerts(c: CustomerDirectoryEntry): number {
  return (
    c.unassessedCount * 2 +
    (c.health === "Critical" ? 10 : c.health === "At Risk" ? 5 : c.health === "Overdue" ? 3 : 0)
  );
}

export function customerCrmStatus(c: CustomerDirectoryEntry): CrmLifecycleStatus {
  if (c.daysAgo > 120 && c.score < 45) return "Churned";
  if (c.health === "Overdue" || c.unassessedCount > 0 || c.health === "Critical")
    return "Onboarding";
  return "Active";
}

/** Security score 0–100 (higher is better). “Risk” for spec glow = 100 - score. */
export function customerRiskScore(c: CustomerDirectoryEntry): number {
  return Math.max(0, Math.min(100, 100 - c.score));
}

export function customerCardGlowClass(c: CustomerDirectoryEntry): string {
  const risk = customerRiskScore(c);
  if (risk > 70) return "ring-2 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.25)]";
  if (risk > 50) return "ring-2 ring-amber-500/40 shadow-[0_0_16px_rgba(245,158,11,0.2)]";
  return "";
}
