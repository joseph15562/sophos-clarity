import type { FleetFirewall } from "@/lib/fleet-command-data";
import { fleetEffectiveComplianceCountry } from "@/lib/fleet-command-data";

export type FleetMapFirewallPin = {
  hostname: string;
  model: string;
  status: FleetFirewall["status"];
  grade: string;
};

/** One customer site on the fleet map (approximate geo from compliance country). */
export type FleetMapSite = {
  id: string;
  customer: string;
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

/** Small deterministic offset so multiple customers in the same country do not stack exactly. */
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
    dLat: (u - 0.5) * 5,
    dLng: (v - 0.5) * 8,
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

function slugCustomerId(name: string, i: number): string {
  const base = name
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .slice(0, 48)
    .toLowerCase();
  return `${base || "site"}-${i}`;
}

/**
 * Group fleet rows by customer; place each group using compliance country (effective per row).
 */
export function buildFleetMapSites(firewalls: FleetFirewall[]): FleetMapSite[] {
  const byCustomer = new Map<string, FleetFirewall[]>();
  for (const fw of firewalls) {
    const name = (fw.customer ?? "").trim() || "Unassigned";
    const arr = byCustomer.get(name) ?? [];
    arr.push(fw);
    byCustomer.set(name, arr);
  }

  const sites: FleetMapSite[] = [];
  let idx = 0;
  for (const [customer, rows] of byCustomer) {
    const countryRaw =
      rows.map((r) => fleetEffectiveComplianceCountry(r)).find((c) => c.trim().length > 0) ?? "";
    const { lat: baseLat, lng: baseLng, label: countryLabel } = centroidForCountry(countryRaw);
    const { dLat, dLng } = siteOffsetDegrees(customer, idx);
    const firewallsPins: FleetMapFirewallPin[] = rows.map((r) => ({
      hostname: (r.hostname ?? "").trim() || "—",
      model: (r.model ?? "").trim() || "—",
      status: r.status,
      grade: r.grade,
    }));
    sites.push({
      id: slugCustomerId(customer, idx),
      customer,
      lat: baseLat + dLat,
      lng: baseLng + dLng,
      countryLabel: countryRaw.trim() ? countryLabel : "Unknown region",
      firewallCount: rows.length,
      firewalls: firewallsPins,
    });
    idx++;
  }

  return sites.sort((a, b) => a.customer.localeCompare(b.customer));
}
