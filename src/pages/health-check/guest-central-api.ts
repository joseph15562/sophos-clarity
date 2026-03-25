import type { ParsedFile } from "@/hooks/use-report-generation";
import type { GuestHaGroup } from "@/lib/guest-central-ha-groups";
import { guestHaGroupSelectValue } from "@/lib/guest-central-ha-groups";
import { getSupabasePublicEdgeAuth } from "@/integrations/supabase/client";
import { readJwtPayloadClaim } from "@/lib/jwt-payload";
import type { GuestFirewallLicenseApiRow } from "./types";

export const CENTRAL_MATCH_NONE = "__none__";

export function mapGuestFirewallLicencesToBpRows(
  rows: GuestFirewallLicenseApiRow[],
): Array<{ product: string; endDate: string; type: string }> {
  const out: Array<{ product: string; endDate: string; type: string }> = [];
  for (const row of rows) {
    for (const lic of row.licenses ?? []) {
      const product = lic.product?.name ?? lic.product?.code ?? lic.licenseIdentifier ?? "";
      out.push({
        product,
        endDate: typeof lic.endDate === "string" ? lic.endDate : "",
        type: typeof lic.type === "string" ? lic.type : "",
      });
    }
  }
  return out;
}

/** Match file serial to any node in an HA group (same as MSP serial search across HA). */
export function guestFirewallMatchValueForFile(file: ParsedFile, groups: GuestHaGroup[]): string {
  const sn = file.serialNumber?.trim();
  if (!sn) return CENTRAL_MATCH_NONE;
  for (const g of groups) {
    const all = [g.primary, ...g.peers];
    if (all.some((fw) => (fw.serialNumber || "").trim().toLowerCase() === sn.toLowerCase())) {
      return guestHaGroupSelectValue(g);
    }
  }
  return CENTRAL_MATCH_NONE;
}

export async function callGuestCentral<T extends Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const resolved = getSupabasePublicEdgeAuth();
  const url = `${resolved.url.replace(/\/$/, "")}/functions/v1/sophos-central`;
  const key = resolved.anonKey.trim();
  const jwtRole = readJwtPayloadClaim(key, "role");
  if (jwtRole === "service_role") {
    throw new Error(
      "Wrong Supabase key: use the anon (publishable) key in VITE_SUPABASE_PUBLISHABLE_KEY, not the service_role secret.",
    );
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { error?: string } & T;
  if (!res.ok || data.error) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
  }
  return data as T;
}
