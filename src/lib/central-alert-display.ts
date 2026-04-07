import type { CentralAlert } from "@/lib/sophos-central";

function trimStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

function managedAgentAsRecord(a: CentralAlert): Record<string, unknown> | null {
  const ma = a.managedAgent;
  if (!ma || typeof ma !== "object") return null;
  return ma as Record<string, unknown>;
}

/** True when `managedAgent.type` refers to an endpoint / computer (not a firewall). */
export function isEndpointManagedAgentType(type: string | undefined): boolean {
  const t = (type ?? "").toLowerCase();
  if (!t) return false;
  if (t === "computer" || t === "server" || t === "user") return true;
  return (
    t.includes("computer") ||
    t.includes("endpoint") ||
    t.includes("workstation") ||
    t.includes("laptop")
  );
}

function endpointNameFromDescription(description: string): string | undefined {
  const d = description.trim();
  const patterns = [
    /\bmanaged\s+endpoint\s+([A-Za-z0-9][A-Za-z0-9._-]*)/i,
    /\bon\s+endpoint\s+([A-Za-z0-9][A-Za-z0-9._-]*)/i,
    /\bendpoint\s+['"“”]([A-Za-z0-9._-]+)['"“”]/i,
    /\b(?:on|for)\s+computer\s+([A-Za-z0-9][A-Za-z0-9._-]*)/i,
  ];
  for (const re of patterns) {
    const m = d.match(re);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

function truncateDisplay(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

/** Best-effort: some Central alert shapes nest hostname under `source`, `asset`, etc. */
function endpointNameFromNestedObjects(raw: Record<string, unknown>): string | undefined {
  for (const key of ["source", "primarySource", "asset", "entity", "device"]) {
    const v = raw[key];
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const n =
      trimStr(o.name) ??
      trimStr(o.hostname) ??
      trimStr(o.computerName) ??
      trimStr(o.computer_name) ??
      trimStr(o.showAs);
    if (n) return n;
  }
  return undefined;
}

/**
 * Friendly device name fields Central may send for computers / generic alerts
 * (without falling back to managedAgent.id).
 */
function resolveEndpointStyleDeviceName(a: CentralAlert): string | undefined {
  const ma = managedAgentAsRecord(a);
  const fromMa = ma
    ? (trimStr(ma.name) ??
      trimStr(ma.hostname) ??
      trimStr(ma.computerName) ??
      trimStr(ma.computer_name) ??
      trimStr(ma.showAs) ??
      trimStr(ma.displayName))
    : undefined;
  if (fromMa) return fromMa;

  const raw = a as Record<string, unknown>;
  const topLevel =
    trimStr(raw.managedAgentName) ??
    trimStr(raw.managed_agent_name) ??
    trimStr(raw.computerName) ??
    trimStr(raw.computer_name) ??
    trimStr(raw.hostname) ??
    trimStr(raw.sourceName) ??
    trimStr(raw.source_name) ??
    trimStr(raw.primarySourceName) ??
    trimStr(raw.primary_source_name);
  if (topLevel) return topLevel;

  const nested = endpointNameFromNestedObjects(raw);
  if (nested) return nested;

  return endpointNameFromDescription(a.description ?? "");
}

/**
 * Device column for Central-backed alerts: firewall hostnames from cached inventory;
 * endpoints prefer API-provided names, then nested objects / description, then id.
 */
export function displayDeviceLabelForCentralAlert(
  a: CentralAlert,
  firewallHostnameById: Map<string, string>,
): string {
  const id = trimStr(a.managedAgent?.id) ?? "";
  const type = a.managedAgent?.type;

  if (isEndpointManagedAgentType(type)) {
    const name = resolveEndpointStyleDeviceName(a);
    if (name) return truncateDisplay(name, 72);
    if (id) return truncateDisplay(id, 40);
    return "—";
  }

  if (id) {
    const host = firewallHostnameById.get(id);
    if (host) return truncateDisplay(host, 72);
  }

  const orphan = resolveEndpointStyleDeviceName(a);
  if (orphan) return truncateDisplay(orphan, 72);

  if (id) return truncateDisplay(id, 40);
  return "—";
}
