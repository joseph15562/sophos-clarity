/**
 * SE Health Check guest Central firewall rows — group HA like MSP `FirewallLinker`
 * (same hostname, primary from cluster.status === "primary").
 */
export type GuestFirewallRow = {
  id?: string;
  hostname?: string;
  name?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  model?: string;
  cluster?: { id?: string; mode?: string; status?: string } | null;
};

export type GuestHaGroup = {
  primary: GuestFirewallRow;
  peers: GuestFirewallRow[];
  isHA: boolean;
};

export function buildGuestCentralHaGroups(fws: GuestFirewallRow[]): GuestHaGroup[] {
  const byHostname = new Map<string, GuestFirewallRow[]>();
  const noHostKey: GuestFirewallRow[] = [];
  for (const fw of fws) {
    const key = (fw.hostname || fw.id || "").trim().toLowerCase();
    if (!key) {
      noHostKey.push(fw);
      continue;
    }
    if (!byHostname.has(key)) byHostname.set(key, []);
    byHostname.get(key)!.push(fw);
  }

  const groups = Array.from(byHostname.values()).map((group) => {
    const primary =
      group.find((f) => {
        const st = (f.cluster as { status?: string } | null | undefined)?.status;
        return st?.toLowerCase() === "primary";
      }) ?? group[0];
    const pKey = (primary.id ?? primary.serialNumber ?? "").trim();
    const peers = group.filter((f) => (f.id ?? f.serialNumber ?? "").trim() !== pKey);
    const isHA = group.length > 1 || !!primary.cluster;
    return { primary, peers, isHA };
  });

  for (const fw of noHostKey) {
    groups.push({ primary: fw, peers: [], isHA: !!fw.cluster });
  }

  groups.sort((a, b) => {
    const na = (a.primary.hostname || a.primary.name || "").toLowerCase();
    const nb = (b.primary.hostname || b.primary.name || "").toLowerCase();
    return na.localeCompare(nb);
  });
  return groups;
}

export function guestHaGroupSelectValue(g: GuestHaGroup): string {
  const p = g.primary;
  if (p.id?.trim()) return `id:${p.id.trim()}`;
  if (p.serialNumber?.trim()) return `sn:${p.serialNumber.trim()}`;
  return `ha:${(p.hostname || p.name || "fw").toLowerCase().replace(/\s+/g, "_")}`;
}

export function findGuestHaGroupBySelectValue(groups: GuestHaGroup[], value: string): GuestHaGroup | undefined {
  if (!value) return undefined;
  return groups.find((hg) => guestHaGroupSelectValue(hg) === value);
}
