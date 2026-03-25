/**
 * SSL/TLS inspection (DPI) parsing and coverage analysis.
 */

import type { ExtractedSections, SslTlsRule } from "./types";

export function parseSslTlsRules(sections: ExtractedSections): SslTlsRule[] {
  const rules: SslTlsRule[] = [];
  for (const key of Object.keys(sections)) {
    if (!/ssl.*tls.*inspection|tls.*inspection/i.test(key)) continue;
    for (const t of sections[key].tables) {
      if (t.headers.length === 2 && t.headers.includes("Setting") && t.headers.includes("Value"))
        continue;
      for (const row of t.rows) {
        const hasRuleColumns =
          row["Decrypt Action"] ||
          row["Action"] ||
          row["Decrypt action"] ||
          row["Source Zone"] ||
          row["Dest Zone"] ||
          row["Source Zones"] ||
          row["Destination Zones"];
        if (!hasRuleColumns) continue;

        const name = row["Rule Name"] ?? row["Name"] ?? row["Rule"] ?? "Unnamed";
        const actionRaw = (row["Decrypt Action"] ?? row["Action"] ?? row["Decrypt action"] ?? "")
          .toLowerCase()
          .trim();
        const source = (
          row["Source"] ??
          row["Source Zones"] ??
          row["Source Zone"] ??
          row["Src Zone"] ??
          row["Src Zones"] ??
          ""
        ).trim();
        const dest = (
          row["Destination"] ??
          row["Destination Zones"] ??
          row["Destination Zone"] ??
          row["Dest Zone"] ??
          row["Dest Zones"] ??
          ""
        ).trim();
        const status = (row["Status"] ?? "").toLowerCase().trim();

        const srcNetworks = (row["Source Networks"] ?? row["Src Networks"] ?? "").trim();
        const dstNetworks = (row["Destination Networks"] ?? row["Dest Networks"] ?? "").trim();

        const isExclude =
          actionRaw.includes("do not") ||
          actionRaw.includes("donot") ||
          actionRaw.includes("don't") ||
          actionRaw.includes("bypass");
        const splitValues = (z: string) =>
          z.toLowerCase() === "any"
            ? ["any"]
            : z
                .split(/[,;]/)
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);

        rules.push({
          name,
          action: isExclude ? "exclude" : "decrypt",
          sourceZones: splitValues(source),
          destZones: splitValues(dest),
          sourceNetworks: splitValues(srcNetworks),
          destNetworks: splitValues(dstNetworks),
          enabled:
            !status.includes("off") &&
            !status.includes("disable") &&
            !status.includes("inactive") &&
            status !== "0",
        });
      }
    }
  }
  return rules;
}

const DPI_EXEMPT_ZONE = /guest|iot|byod|printer|camera|cctv|voip|phone|sip|dmz|server|red/i;

export function findUncoveredZones(
  wanRules: Array<{ name: string; row: Record<string, string>; enabled: boolean }>,
  sslRules: SslTlsRule[],
  customExemptZones?: string[],
): { uncovered: string[]; allWanSourceZones: string[] } {
  const customSet = new Set((customExemptZones ?? []).map((z) => z.toLowerCase().trim()));

  const fwSourceZones = new Set<string>();
  for (const { row, enabled } of wanRules) {
    if (!enabled) continue;
    const sz = (row["Source Zones"] ?? row["Source Zone"] ?? row["Src Zone"] ?? row["Source"] ?? "")
      .toLowerCase()
      .trim();
    if (sz && sz !== "any") {
      sz.split(/[,;]/).forEach((z) => {
        const trimmed = z.trim();
        if (trimmed) fwSourceZones.add(trimmed);
      });
    }
  }

  const allWanSourceZones = [...fwSourceZones];

  const decryptRules = sslRules.filter((r) => r.action === "decrypt" && r.enabled);
  if (decryptRules.length === 0 || fwSourceZones.size === 0) {
    return { uncovered: [], allWanSourceZones };
  }

  const uncovered: string[] = [];
  for (const zone of fwSourceZones) {
    if (DPI_EXEMPT_ZONE.test(zone)) continue;
    if (customSet.has(zone)) continue;

    const isCovered = decryptRules.some((r) => {
      const srcMatch = r.sourceZones.includes("any") || r.sourceZones.includes(zone);
      const dstMatch = r.destZones.includes("any") || r.destZones.some((d) => d.includes("wan"));
      return srcMatch && dstMatch;
    });
    if (!isCovered) uncovered.push(zone);
  }
  return { uncovered, allWanSourceZones };
}

const DPI_EXEMPT_NETWORK = /printer|camera|cctv|voip|phone|sip|iot|guest|byod/i;

export function findUncoveredNetworks(
  wanRules: Array<{ name: string; row: Record<string, string>; enabled: boolean }>,
  sslRules: SslTlsRule[],
  customExemptNetworks?: string[],
): { uncoveredNetworks: string[]; allWanSourceNetworks: string[] } {
  const customSet = new Set((customExemptNetworks ?? []).map((n) => n.toLowerCase().trim()));

  const fwSourceNetworks = new Set<string>();
  for (const { row, enabled } of wanRules) {
    if (!enabled) continue;
    const sn = (row["Source Networks"] ?? row["Source"] ?? row["Src Networks"] ?? "")
      .toLowerCase()
      .trim();
    if (sn && sn !== "any") {
      sn.split(/[,;]/).forEach((n) => {
        const trimmed = n.trim();
        if (trimmed) fwSourceNetworks.add(trimmed);
      });
    }
  }

  const allWanSourceNetworks = [...fwSourceNetworks];

  const decryptRules = sslRules.filter((r) => r.action === "decrypt" && r.enabled);
  if (decryptRules.length === 0 || fwSourceNetworks.size === 0) {
    return { uncoveredNetworks: [], allWanSourceNetworks };
  }

  const allDecryptCoverAnyNetwork = decryptRules.every(
    (r) => r.sourceNetworks.length === 0 || r.sourceNetworks.includes("any"),
  );
  if (allDecryptCoverAnyNetwork) {
    return { uncoveredNetworks: [], allWanSourceNetworks };
  }

  const uncoveredNetworks: string[] = [];
  for (const net of fwSourceNetworks) {
    if (DPI_EXEMPT_NETWORK.test(net)) continue;
    if (customSet.has(net)) continue;

    const isCovered = decryptRules.some((r) => {
      const netMatch =
        r.sourceNetworks.includes("any") ||
        r.sourceNetworks.length === 0 ||
        r.sourceNetworks.includes(net);
      const dstMatch = r.destZones.includes("any") || r.destZones.some((d) => d.includes("wan"));
      return netMatch && dstMatch;
    });
    if (!isCovered) uncoveredNetworks.push(net);
  }
  return { uncoveredNetworks, allWanSourceNetworks };
}
