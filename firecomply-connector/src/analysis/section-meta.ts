/**
 * Section discovery and metadata extraction from parsed config sections.
 */

import type { ExtractedSections, SectionData, TableData } from "./types";
import { findSection } from "./helpers";

export function findFirewallRulesTable(sections: ExtractedSections): TableData | null {
  for (const key of Object.keys(sections)) {
    if (/firewall\s*rules?/i.test(key)) {
      const tables = sections[key].tables;
      if (tables.length > 0) return tables[0];
    }
  }
  return null;
}

export function findOtpSection(sections: ExtractedSections): SectionData | null {
  for (const key of Object.keys(sections)) {
    if (/otp|authentication/i.test(key)) return sections[key];
  }
  return null;
}

export function countRows(sections: ExtractedSections, pattern: RegExp, exclude?: RegExp): number {
  let count = 0;
  for (const key of Object.keys(sections)) {
    if (pattern.test(key) && (!exclude || !exclude.test(key))) {
      for (const t of sections[key].tables) count += t.rows.length;
    }
  }
  return count;
}

export function countInterfaceRows(sections: ExtractedSections): number {
  for (const key of Object.keys(sections)) {
    if (!/interface|port|vlan/i.test(key)) continue;
    for (const t of sections[key].tables) {
      if (t.headers.includes("Interface / VLAN")) return t.rows.length;
    }
  }

  const parentPorts = new Set<string>();
  let vlanCount = 0;
  for (const key of Object.keys(sections)) {
    if (!/^vlans?$/i.test(key)) continue;
    for (const t of sections[key].tables) {
      for (const row of t.rows) {
        vlanCount++;
        for (const field of [
          "Interface",
          "Hardware",
          "HardwareInterface",
          "HardwareName",
          "Member",
          "Port",
        ]) {
          const val = (row[field] ?? "").trim();
          if (val) parentPorts.add(val);
        }
        const vlanName = (row["Name"] ?? "").trim();
        const dotIdx = vlanName.indexOf(".");
        if (dotIdx > 0) parentPorts.add(vlanName.substring(0, dotIdx));
      }
    }
  }

  let portCount = 0;
  for (const key of Object.keys(sections)) {
    if (!/interface|port/i.test(key)) continue;
    if (/alias|xfrm|vlan/i.test(key)) continue;
    for (const t of sections[key].tables) {
      const isSettingsGrid =
        t.headers.length === 2 && t.headers.includes("Setting") && t.headers.includes("Value");
      if (isSettingsGrid) continue;
      for (const row of t.rows) {
        const name = (row["Name"] ?? "").trim();
        const hw = (row["HardwareName"] ?? "").trim();
        if (!parentPorts.has(name) && !parentPorts.has(hw)) portCount++;
      }
    }
  }

  return portCount + vlanCount;
}

export function extractHostname(sections: ExtractedSections): string | undefined {
  const section =
    findSection(sections, /^AdminSettings$/i) ?? findSection(sections, /admin.?settings/i);
  if (!section) return undefined;
  const text =
    section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") +
    " " +
    (section.text ?? "");
  const m = text.match(/Host\s*Name["\s:]+([^\s",}]+)/i);
  return m?.[1] || undefined;
}

export function extractManagementIp(sections: ExtractedSections): string | undefined {
  for (const key of Object.keys(sections)) {
    if (!/interface|port|vlan/i.test(key)) continue;
    for (const t of sections[key].tables) {
      const ipIdx = t.headers.findIndex((h) => /ip\s*address/i.test(h));
      const zoneIdx = t.headers.findIndex((h) => /zone|network\s*zone/i.test(h));
      if (ipIdx < 0) continue;
      for (const row of t.rows) {
        const vals = Object.values(row);
        const ip = typeof vals[ipIdx] === "string" ? vals[ipIdx] : undefined;
        const zone = zoneIdx >= 0 && typeof vals[zoneIdx] === "string" ? vals[zoneIdx] : "";
        if (ip && ip !== "N/A" && /^\d+\.\d+\.\d+\.\d+/.test(ip) && /lan/i.test(zone)) {
          return ip.split("/")[0];
        }
      }
      for (const row of t.rows) {
        const vals = Object.values(row);
        const ip = typeof vals[ipIdx] === "string" ? vals[ipIdx] : undefined;
        if (ip && ip !== "N/A" && /^\d+\.\d+\.\d+\.\d+/.test(ip)) {
          return ip.split("/")[0];
        }
      }
    }
  }
  for (const key of Object.keys(sections)) {
    if (!/interface|port/i.test(key)) continue;
    for (const t of sections[key].tables) {
      for (const row of t.rows) {
        const ip =
          (row as Record<string, string>)["IPAddress"] ??
          (row as Record<string, string>)["IPv4Address"] ??
          (row as Record<string, string>)["IP"];
        const zone =
          (row as Record<string, string>)["Zone"] ??
          (row as Record<string, string>)["NetworkZone"] ??
          "";
        if (ip && ip !== "N/A" && /^\d+\.\d+\.\d+\.\d+/.test(ip) && /lan/i.test(zone)) {
          return ip.split("/")[0];
        }
      }
      for (const row of t.rows) {
        const ip =
          (row as Record<string, string>)["IPAddress"] ??
          (row as Record<string, string>)["IPv4Address"] ??
          (row as Record<string, string>)["IP"];
        if (ip && ip !== "N/A" && /^\d+\.\d+\.\d+\.\d+/.test(ip)) {
          return ip.split("/")[0];
        }
      }
    }
  }
  return undefined;
}
