/** Best-effort read of `central_firewalls.status_json` from Sophos inventory sync. */
export function centralFirewallConnectionState(status: unknown): {
  connected: boolean | null;
  suspended: boolean | null;
} {
  if (!status || typeof status !== "object") return { connected: null, suspended: null };
  const s = status as Record<string, unknown>;
  const c = s.connected;
  const sus = s.suspended;
  return {
    connected: typeof c === "boolean" ? c : null,
    suspended: typeof sus === "boolean" ? sus : null,
  };
}

export function formatExternalIps(raw: unknown): string {
  if (raw == null) return "—";
  if (Array.isArray(raw)) {
    const parts = raw.map((x) => String(x).trim()).filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "—";
}

export function centralGroupLabel(group: unknown): string {
  if (!group || typeof group !== "object") return "—";
  const g = group as { name?: string; id?: string };
  const n = (g.name ?? "").trim();
  if (n) return n;
  const id = (g.id ?? "").trim();
  return id || "—";
}

export function centralClusterSummary(cluster: unknown): string {
  if (!cluster || typeof cluster !== "object") return "—";
  const c = cluster as { mode?: string; status?: string; id?: string };
  const mode = (c.mode ?? "").trim();
  const st = (c.status ?? "").trim();
  if (mode && st) return `${mode} · ${st}`;
  return mode || st || "—";
}
