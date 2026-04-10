import type { ExtractedSections, TableData } from "@/lib/extract-sections";
import { findFirewallRulesTable } from "@/lib/analysis/section-meta";

/**
 * Canonical columns for the PDF appendix, in display order.
 * Keeps the table within landscape A4 bounds (~12 cols max).
 */
const PDF_APPENDIX_COLUMNS = [
  "#",
  "Rule Name",
  "Status",
  "Action",
  "Source Zone",
  "Destination Zone",
  "Source Networks",
  "Destination Networks",
  "Service",
  "Web Filter",
  "IPS",
  "Application Control",
  "Log",
];

/**
 * Alternate header names that map to the canonical column.
 * The raw config table emits duplicates for SFOS version compat.
 */
const COLUMN_ALIASES: Record<string, string> = {
  "Source Zones": "Source Zone",
  "Destination Zones": "Destination Zone",
  "IPS Policy": "IPS",
  "Intrusion Prevention": "IPS",
  "Log Traffic": "Log",
};

/**
 * Prune the raw 23-column firewall rules table down to the essential
 * columns that fit on a landscape A4 page. If the table doesn't contain
 * any of the canonical columns (e.g. already a compact or custom table),
 * it is returned unchanged.
 */
function trimTableForPdf(table: TableData): TableData {
  const canonicalHeaders: string[] = [];
  const seen = new Set<string>();
  for (const h of table.headers) {
    const canonical = COLUMN_ALIASES[h] ?? h;
    if (!PDF_APPENDIX_COLUMNS.includes(canonical)) continue;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    canonicalHeaders.push(canonical);
  }

  if (canonicalHeaders.length === 0) return table;

  const rows = table.rows.map((row) => {
    const out: Record<string, string> = {};
    for (const h of canonicalHeaders) {
      out[h] = row[h] ?? "";
      if (!out[h]) {
        const alias = Object.entries(COLUMN_ALIASES).find(([, v]) => v === h);
        if (alias) out[h] = row[alias[0]] ?? "";
      }
    }
    return out;
  });

  return { headers: canonicalHeaders, rows };
}

function isSeparatorRow(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith("|")) return false;
  const withoutEdges = t.replace(/^\|/, "").replace(/\|\s*$/, "");
  if (!withoutEdges.includes("-")) return false;
  return /^[\s\-:|]+$/.test(withoutEdges);
}

/**
 * Counts GFM data rows in the first `## Firewall Rules` table (after header + optional `|---|` row).
 * Returns -1 if that heading is missing.
 */
export function countFirewallRulesSectionTableDataRows(markdown: string): number {
  const idx = markdown.search(/^##\s+Firewall\s+Rules\b/im);
  if (idx < 0) return -1;
  const rest = markdown.slice(idx);
  const lines = rest.split("\n");
  const tableLines: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("## ") && !/^##\s+Firewall\s+Rules\b/i.test(t)) break;
    if (t.startsWith("|")) tableLines.push(t);
  }
  if (tableLines.length < 2) return 0;
  let dataStart = 1;
  if (tableLines.length > 1 && isSeparatorRow(tableLines[1])) dataStart = 2;
  let n = 0;
  for (let j = dataStart; j < tableLines.length; j++) {
    if (!isSeparatorRow(tableLines[j])) n++;
  }
  return n;
}

function escapeMdCell(s: string): string {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

export function markdownTableFromFirewallRulesTable(table: TableData): string {
  const headers = table.headers;
  if (headers.length === 0) return "";
  const head = "| " + headers.map((h) => escapeMdCell(h)).join(" | ") + " |";
  const sep = "| " + headers.map(() => "---").join(" | ") + " |";
  const rows = table.rows.map(
    (row) => "| " + headers.map((h) => escapeMdCell(row[h] ?? "")).join(" | ") + " |",
  );
  return [head, sep, ...rows].join("\n");
}

export type FirewallRulesAppendixOpts = {
  executive?: boolean;
  firewallLabels?: string[];
};

/**
 * If the AI narrative table has fewer rows than the parsed export (and the export is not huge),
 * append a deterministic full rule table so the document stays audit-useful when streaming stops early.
 */
export function maybeAppendFirewallRulesExportAppendix(
  markdown: string,
  sections: ExtractedSections,
  opts: FirewallRulesAppendixOpts,
): string {
  if (opts.executive) return markdown;
  if (opts.firewallLabels && opts.firewallLabels.length !== 1) return markdown;

  const table = findFirewallRulesTable(sections);
  const expected = table?.rows.length ?? 0;
  if (expected === 0 || expected > 150) return markdown;

  const marker = "## Complete firewall rules (from configuration export)";
  if (markdown.includes(marker)) return markdown;

  const got = countFirewallRulesSectionTableDataRows(markdown);
  if (got < 0 || got >= expected) return markdown;

  const tableMd = markdownTableFromFirewallRulesTable(trimTableForPdf(table!));
  if (!tableMd) return markdown;

  const appendix = [
    "",
    "---",
    "",
    marker,
    "",
    `*The narrative **Firewall Rules** table above lists **${got}** row(s); this export has **${expected}**. When the count is lower, generation often stopped early (model output or time limits). The table below is the full rule list from your uploaded configuration (parsed data, not AI).*`,
    "",
    tableMd,
    "",
  ].join("\n");

  return markdown.trimEnd() + appendix;
}
