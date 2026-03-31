import type { ExtractedSections } from "@/lib/extract-sections";
import { findSection } from "@/lib/analysis/helpers";

export type VpnTopologySummary = {
  ipsecConnectionNames: string[];
  sslVpnPolicyCount: number;
};

/** Lightweight counts/names for VPN topology UI (no new parsing rules vs analyseVpnSecurity). */
export function buildVpnTopologySummary(sections: ExtractedSections): VpnTopologySummary {
  const ipsec = findSection(sections, /vpn\s*ipsec\s*connection/i);
  const names: string[] = [];
  if (ipsec) {
    for (const t of ipsec.tables) {
      for (const row of t.rows) {
        const n = String(row["Name"] ?? row["Connection Name"] ?? "").trim();
        if (n) names.push(n);
      }
    }
  }
  const ssl = findSection(sections, /ssl\s*vpn\s*polic/i);
  let sslCount = 0;
  if (ssl) {
    for (const t of ssl.tables) sslCount += t.rows.length;
    if (sslCount === 0) sslCount = (ssl.details ?? []).length;
  }
  return { ipsecConnectionNames: names, sslVpnPolicyCount: sslCount };
}
