import type { FleetFirewall } from "@/lib/fleet-command-data";
import { fleetEffectiveComplianceCountry } from "@/lib/fleet-command-data";

export type FleetMapFirewallPin = {
  hostname: string;
  model: string;
  status: FleetFirewall["status"];
  grade: string;
};

/** One pin on the fleet map (one firewall per site). */
export type FleetMapSite = {
  id: string;
  /** FireComply / MSP customer label for this firewall. */
  customer: string;
  /** Sophos Central tenant display name when known (may match customer). */
  tenantName?: string;
  lat: number;
  lng: number;
  countryLabel: string;
  firewallCount: number;
  firewalls: FleetMapFirewallPin[];
};

/** Centroids for countries from workspace compliance picker + common aliases (approximate). */
const CENTROID_BY_KEY: Record<string, { lat: number; lng: number }> = {
  "united kingdom": { lat: 54.0, lng: -2.5 },
  uk: { lat: 54.0, lng: -2.5 },
  gb: { lat: 54.0, lng: -2.5 },
  "great britain": { lat: 54.0, lng: -2.5 },
  england: { lat: 52.5, lng: -1.5 },
  scotland: { lat: 56.5, lng: -4.0 },
  wales: { lat: 52.3, lng: -3.8 },
  "northern ireland": { lat: 54.6, lng: -6.7 },
  "united states": { lat: 39.8, lng: -98.5 },
  usa: { lat: 39.8, lng: -98.5 },
  us: { lat: 39.8, lng: -98.5 },
  america: { lat: 39.8, lng: -98.5 },
  australia: { lat: -25.3, lng: 133.8 },
  canada: { lat: 56.1, lng: -106.3 },
  germany: { lat: 51.2, lng: 10.4 },
  france: { lat: 46.2, lng: 2.2 },
  netherlands: { lat: 52.1, lng: 5.3 },
  holland: { lat: 52.1, lng: 5.3 },
  ireland: { lat: 53.4, lng: -8.0 },
  "new zealand": { lat: -40.9, lng: 174.9 },
  "south africa": { lat: -30.6, lng: 22.9 },
  "united arab emirates": { lat: 23.4, lng: 53.8 },
  uae: { lat: 23.4, lng: 53.8 },
  singapore: { lat: 1.35, lng: 103.8 },
  india: { lat: 20.6, lng: 78.9 },
  japan: { lat: 36.2, lng: 138.3 },
  sweden: { lat: 62.2, lng: 17.6 },
  italy: { lat: 42.6, lng: 12.6 },
  spain: { lat: 40.5, lng: -3.7 },
  brazil: { lat: -14.2, lng: -51.9 },
  "saudi arabia": { lat: 24.0, lng: 45.0 },
  switzerland: { lat: 46.8, lng: 8.2 },
};

function countryKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Small deterministic offset so multiple firewalls in the same country separate slightly. */
function siteOffsetDegrees(seed: string, index: number): { dLat: number; dLng: number } {
  let h = 2166136261;
  const s = `${seed}:${index}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 0xffffffff;
  const v = (Math.imul(h, 1103515245) >>> 0) / 0xffffffff;
  return {
    dLat: (u - 0.5) * 4,
    dLng: (v - 0.5) * 6,
  };
}

function fallbackLatLng(seed: string): { lat: number; lng: number } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const lng = ((h >>> 0) % 360) - 180;
  let lat = ((((h >>> 16) % 140) - 70) * 0.85) as number;
  lat = Math.max(-55, Math.min(72, lat));
  return { lat, lng };
}

function centroidForCountry(raw: string): { lat: number; lng: number; label: string } {
  const key = countryKey(raw);
  if (!key) {
    const f = fallbackLatLng("unknown");
    return { ...f, label: "Unknown region" };
  }
  const c = CENTROID_BY_KEY[key];
  if (c) return { lat: c.lat, lng: c.lng, label: raw.trim() };
  const f = fallbackLatLng(key);
  return { ...f, label: raw.trim() || "Unknown region" };
}

function resolveFirewallMapPosition(
  fw: FleetFirewall,
  index: number,
): { lat: number; lng: number; label: string } {
  const mLat = fw.mapLatitude;
  const mLng = fw.mapLongitude;
  if (
    mLat != null &&
    mLng != null &&
    Number.isFinite(mLat) &&
    Number.isFinite(mLng) &&
    mLat >= -90 &&
    mLat <= 90 &&
    mLng >= -180 &&
    mLng <= 180
  ) {
    return {
      lat: mLat,
      lng: mLng,
      label: `Map pin (${mLat.toFixed(4)}, ${mLng.toFixed(4)})`,
    };
  }

  const cLat = fw.centralGeoLatitude;
  const cLng = fw.centralGeoLongitude;
  if (
    cLat != null &&
    cLng != null &&
    Number.isFinite(cLat) &&
    Number.isFinite(cLng) &&
    cLat >= -90 &&
    cLat <= 90 &&
    cLng >= -180 &&
    cLng <= 180
  ) {
    return { lat: cLat, lng: cLng, label: "Sophos Central geo" };
  }

  const countryRaw =
    fleetEffectiveComplianceCountry(fw).trim() || (fw.customerComplianceCountry ?? "").trim();
  const { lat: baseLat, lng: baseLng, label: countryLabel } = centroidForCountry(countryRaw);
  const seed = `${fw.hostname || fw.id}:${index}`;
  const { dLat, dLng } = siteOffsetDegrees(seed, index);
  return {
    lat: baseLat + dLat * 0.4,
    lng: baseLng + dLng * 0.4,
    label: countryRaw ? countryLabel : "Unknown region",
  };
}

/**
 * One map site per firewall. Position: MSP map pin → Central geo → compliance country centroid.
 */
export function buildFleetMapSites(firewalls: FleetFirewall[]): FleetMapSite[] {
  const sites = firewalls.map((fw, index) => {
    const { lat, lng, label } = resolveFirewallMapPosition(fw, index);
    const customer = (fw.customer ?? "").trim() || "Unassigned";
    const tenantRaw = (fw.tenantName ?? "").trim();
    return {
      id: fw.id,
      customer,
      ...(tenantRaw ? { tenantName: tenantRaw } : {}),
      lat,
      lng,
      countryLabel: label,
      firewallCount: 1,
      firewalls: [
        {
          hostname: (fw.hostname ?? "").trim() || "—",
          model: (fw.model ?? "").trim() || "—",
          status: fw.status,
          grade: fw.grade,
        },
      ],
    };
  });
  return sites.sort((a, b) => {
    const c = a.customer.localeCompare(b.customer);
    if (c !== 0) return c;
    return a.firewalls[0].hostname.localeCompare(b.firewalls[0].hostname);
  });
}
