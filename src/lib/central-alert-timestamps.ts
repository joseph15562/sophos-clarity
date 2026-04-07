/** Fields Sophos may send for alert timing (snake_case + camelCase). */
const CENTRAL_ALERT_TIME_FIELDS = [
  "lastModifiedAt",
  "last_modified_at",
  "updatedAt",
  "updated_at",
  "when",
  "whenAt",
  "when_at",
  "occurredAt",
  "occurred_at",
  "eventAt",
  "event_at",
  "firstDetectedAt",
  "first_detected_at",
  "lastDetectedAt",
  "last_detected_at",
  "detectedAt",
  "detected_at",
  "raisedAt",
  "raised_at",
  "reportedAt",
  "reported_at",
  "createdAt",
  "created_at",
] as const;

function instantMsFromString(t: string): number | null {
  const s = t.trim();
  if (s.length < 4) return null;
  /** Epoch seconds or ms as digits — `Date.parse("1738…")` is NaN in browsers. */
  if (/^\d{10,16}$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    if (s.length === 10) return n * 1000;
    if (s.length >= 13) return n;
    /** 11–12 digits: treat as ms only if in a plausible unix-ms range (~2001+). */
    if (n >= 1_000_000_000_000) return n;
    return n * 1000;
  }
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : ms;
}

function centralAlertFieldInstantMs(r: Record<string, unknown>, key: string): number | null {
  const v = r[key];
  if (typeof v === "number" && Number.isFinite(v)) {
    return v > 1e12 ? v : v * 1000;
  }
  if (typeof v === "string") {
    return instantMsFromString(v);
  }
  return null;
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/**
 * Max instant from known time keys on the root and **one nested object level** (e.g. `managedAgent`,
 * `threat`, `details`). Deeper structures are ignored to avoid accidental matches.
 */
function centralAlertBestInstantMs(alert: Record<string, unknown>): number | null {
  let bestMs: number | null = null;
  const consider = (ms: number | null) => {
    if (ms == null) return;
    if (bestMs === null || ms > bestMs) bestMs = ms;
  };
  for (const key of CENTRAL_ALERT_TIME_FIELDS) {
    consider(centralAlertFieldInstantMs(alert, key));
  }
  for (const v of Object.values(alert)) {
    if (!isPlainRecord(v)) continue;
    for (const key of CENTRAL_ALERT_TIME_FIELDS) {
      consider(centralAlertFieldInstantMs(v, key));
    }
  }
  return bestMs;
}

/**
 * Best ISO instant for sort, charts, filters, and “time ago”. Central’s portal “recent” often tracks
 * last activity; the API may expose `lastModifiedAt` / `updatedAt` newer than original `raisedAt`.
 * We use the **latest** parseable value among known timestamp fields (and numeric epoch seconds/ms).
 */
export function centralAlertRaisedAt(alert: Record<string, unknown>): string {
  const bestMs = centralAlertBestInstantMs(alert);
  if (bestMs === null) return "";
  return new Date(bestMs).toISOString();
}
