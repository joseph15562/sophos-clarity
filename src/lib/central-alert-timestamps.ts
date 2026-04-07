/** Fields Sophos may send for alert timing (snake_case + camelCase). */
const CENTRAL_ALERT_TIME_FIELDS = [
  "lastModifiedAt",
  "last_modified_at",
  "updatedAt",
  "updated_at",
  "raisedAt",
  "raised_at",
  "reportedAt",
  "reported_at",
  "createdAt",
  "created_at",
] as const;

function centralAlertFieldInstantMs(r: Record<string, unknown>, key: string): number | null {
  const v = r[key];
  if (typeof v === "number" && Number.isFinite(v)) {
    return v > 1e12 ? v : v * 1000;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (t.length < 4) return null;
    const ms = Date.parse(t);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/**
 * Best ISO instant for sort, charts, filters, and “time ago”. Central’s portal “recent” often tracks
 * last activity; the API may expose `lastModifiedAt` / `updatedAt` newer than original `raisedAt`.
 * We use the **latest** parseable value among known timestamp fields (and numeric epoch seconds/ms).
 */
export function centralAlertRaisedAt(alert: Record<string, unknown>): string {
  let bestMs = -Infinity;
  for (const key of CENTRAL_ALERT_TIME_FIELDS) {
    const ms = centralAlertFieldInstantMs(alert, key);
    if (ms != null && ms > bestMs) bestMs = ms;
  }
  if (bestMs === -Infinity) return "";
  return new Date(bestMs).toISOString();
}
