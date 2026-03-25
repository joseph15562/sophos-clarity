/**
 * Shared helpers for config analysis. Used by analyse-config and domain modules.
 */

import type { ExtractedSections, SectionData } from "../extract-sections";

export function findSection(sections: ExtractedSections, pattern: RegExp): SectionData | null {
  for (const key of Object.keys(sections)) {
    if (pattern.test(key)) return sections[key];
  }
  return null;
}

export function sectionToBlob(section: SectionData): string {
  const chunks: string[] = [];
  for (const d of section.details ?? []) {
    for (const [k, v] of Object.entries(d.fields ?? {})) chunks.push(`${k}=${v}`);
  }
  for (const t of section.tables) {
    for (const r of t.rows) chunks.push(JSON.stringify(r));
  }
  if (section.text) chunks.push(section.text);
  return chunks.join(" ");
}

export function extractSectionEnabled(section: SectionData): boolean | null {
  for (const t of section.tables) {
    for (const row of t.rows) {
      const status = (row["Status"] ?? row["Enable"] ?? row["Enabled"] ?? "").trim();
      if (status) return /enable|on|yes|true/i.test(status);
    }
  }
  for (const detail of section.details ?? []) {
    const fields = detail.fields ?? {};
    const s = (fields["Status"] ?? fields["Enable"] ?? fields["Enabled"] ?? "").trim();
    if (s) return /enable|on|yes|true/i.test(s);
  }
  const blob = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");
  if (/disable/i.test(blob) && !/enable/i.test(blob)) return false;
  if (/enable/i.test(blob) && !/disable/i.test(blob)) return true;
  return null;
}
