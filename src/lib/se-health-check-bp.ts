import type { ParsedFile } from "@/hooks/use-report-generation";
import type { GuestHaGroup } from "@/lib/guest-central-ha-groups";

/** SE Health Check Sophos BP manual overrides — keep in sync with `SophosBestPractice` on this page. */
export const SE_HEALTH_CHECK_BP_OVERRIDES_KEY = "se-health-check-bp-manual-overrides";

/** BP checks where SE Health Check hides "Mark as Compliant" (DPI exclusions, or judgement calls on rule hygiene). */
export const SE_HEALTH_CHECK_BP_NO_MANUAL_COMPLY_IDS = new Set<string>([
  "bp-ssl-tls",
  "bp-any-service",
  "bp-broad-rules",
  "bp-mdr-feeds",
  "bp-ndr",
  "bp-dns-protection",
  "bp-heartbeat",
]);

/** When set, `computeSophosBPScore` treats matching checks as pass if they are verify (export gap) only. */
export function buildSeThreatResponseAckSet(mdrAck: boolean, ndrAck: boolean, dnsAck = false): Set<string> | undefined {
  if (!mdrAck && !ndrAck && !dnsAck) return undefined;
  const s = new Set<string>();
  if (mdrAck) s.add("bp-mdr-feeds");
  if (ndrAck) s.add("bp-ndr");
  if (dnsAck) s.add("bp-dns-protection");
  return s;
}

/** Omit Security Heartbeat from BP scoring when the customer has no managed Sophos endpoints. */
export function buildSeHeartbeatExclusionSet(excludeHeartbeat: boolean): Set<string> | undefined {
  if (!excludeHeartbeat) return undefined;
  return new Set<string>(["bp-heartbeat"]);
}

/** Same key as `analysisResults` / dashboard tabs. */
export function healthCheckFirewallLabel(f: { label?: string; fileName: string }): string {
  return f.label || f.fileName.replace(/\.(html|htm|xml)$/i, "");
}

/**
 * Firewall labels whose upload serial matches a Central HA group (merged hostname row / cluster).
 * Drives `bp-ha-configured` auto-pass when the XML export has no HA section.
 */
export function buildSeCentralHaLabels(files: ParsedFile[], groups: GuestHaGroup[]): Set<string> {
  const out = new Set<string>();
  for (const f of files) {
    const sn = f.serialNumber?.trim().toLowerCase();
    if (!sn) continue;
    const linkedToHa = groups.some(
      (g) =>
        g.isHA &&
        [g.primary, ...g.peers].some((fw) => (fw.serialNumber || "").trim().toLowerCase() === sn),
    );
    if (linkedToHa) out.add(healthCheckFirewallLabel(f));
  }
  return out;
}

/** Per-firewall BP scoring on SE page (JSON, PDF, dashboard tab). */
export function seCentralAutoForLabel(
  centralSession: boolean,
  label: string,
  haLabels: Set<string>,
): Set<string> | undefined {
  const s = new Set<string>();
  if (centralSession) s.add("bp-central-mgmt");
  if (centralSession && haLabels.has(label)) s.add("bp-ha-configured");
  return s.size ? s : undefined;
}

/** Merged “overall” BP score when multiple XMLs: HA passes if any upload is linked to an HA Central group. */
export function seCentralAutoForOverall(
  centralSession: boolean,
  haLabels: Set<string>,
): Set<string> | undefined {
  const s = new Set<string>();
  if (centralSession) s.add("bp-central-mgmt");
  if (centralSession && haLabels.size > 0) s.add("bp-ha-configured");
  return s.size ? s : undefined;
}

export function loadSeHealthCheckBpOverrides(): Set<string> {
  try {
    const raw = localStorage.getItem(SE_HEALTH_CHECK_BP_OVERRIDES_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}
