import type { ExtractedSections, TableData } from "./extract-sections";

export type ChangeType = "added" | "removed" | "modified" | "unchanged";

export interface SectionDiff {
  name: string;
  status: ChangeType;
  tableDiffs: TableDiff[];
}

export interface TableDiff {
  headers: string[];
  rows: RowDiff[];
  summary: { added: number; removed: number; modified: number; unchanged: number };
}

export interface RowDiff {
  status: ChangeType;
  key: string;
  before?: Record<string, string>;
  after?: Record<string, string>;
  changedFields?: string[];
}

export interface ConfigDiffResult {
  sections: SectionDiff[];
  summary: {
    sectionsAdded: number;
    sectionsRemoved: number;
    sectionsModified: number;
    sectionsUnchanged: number;
    totalRowsAdded: number;
    totalRowsRemoved: number;
    totalRowsModified: number;
  };
}

function rowKey(row: Record<string, string>, headers: string[]): string {
  const nameFields = ["Rule Name", "Name", "Rule", "#", "Policy Name", "Zone", "Interface / VLAN"];
  for (const field of nameFields) {
    if (row[field]) return row[field];
  }
  return headers.map((h) => row[h] ?? "").join("|");
}

function diffTable(before: TableData, after: TableData): TableDiff {
  const headers = after.headers.length >= before.headers.length ? after.headers : before.headers;

  const beforeMap = new Map<string, Record<string, string>>();
  const afterMap = new Map<string, Record<string, string>>();

  for (const row of before.rows) {
    const key = rowKey(row, before.headers);
    beforeMap.set(key, row);
  }
  for (const row of after.rows) {
    const key = rowKey(row, after.headers);
    afterMap.set(key, row);
  }

  const rows: RowDiff[] = [];
  const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const orderedKeys = [
    ...before.rows.map((r) => rowKey(r, before.headers)),
    ...after.rows.map((r) => rowKey(r, after.headers)).filter((k) => !beforeMap.has(k)),
  ];
  const seen = new Set<string>();

  for (const key of orderedKeys) {
    if (seen.has(key)) continue;
    seen.add(key);

    const bRow = beforeMap.get(key);
    const aRow = afterMap.get(key);

    if (bRow && !aRow) {
      rows.push({ status: "removed", key, before: bRow });
    } else if (!bRow && aRow) {
      rows.push({ status: "added", key, after: aRow });
    } else if (bRow && aRow) {
      const changedFields: string[] = [];
      for (const h of headers) {
        if ((bRow[h] ?? "") !== (aRow[h] ?? "")) changedFields.push(h);
      }
      rows.push({
        status: changedFields.length > 0 ? "modified" : "unchanged",
        key,
        before: bRow,
        after: aRow,
        changedFields: changedFields.length > 0 ? changedFields : undefined,
      });
    }
  }

  return {
    headers,
    rows,
    summary: {
      added: rows.filter((r) => r.status === "added").length,
      removed: rows.filter((r) => r.status === "removed").length,
      modified: rows.filter((r) => r.status === "modified").length,
      unchanged: rows.filter((r) => r.status === "unchanged").length,
    },
  };
}

export function diffConfigs(before: ExtractedSections, after: ExtractedSections): ConfigDiffResult {
  const allSectionNames = new Set([...Object.keys(before), ...Object.keys(after)]);
  const sections: SectionDiff[] = [];

  let sectionsAdded = 0, sectionsRemoved = 0, sectionsModified = 0, sectionsUnchanged = 0;
  let totalRowsAdded = 0, totalRowsRemoved = 0, totalRowsModified = 0;

  for (const name of allSectionNames) {
    const bSection = before[name];
    const aSection = after[name];

    if (!bSection && aSection) {
      sectionsAdded++;
      const tableDiffs = aSection.tables.map((t) => diffTable({ headers: t.headers, rows: [] }, t));
      tableDiffs.forEach((td) => { totalRowsAdded += td.summary.added; });
      sections.push({ name, status: "added", tableDiffs });
    } else if (bSection && !aSection) {
      sectionsRemoved++;
      const tableDiffs = bSection.tables.map((t) => diffTable(t, { headers: t.headers, rows: [] }));
      tableDiffs.forEach((td) => { totalRowsRemoved += td.summary.removed; });
      sections.push({ name, status: "removed", tableDiffs });
    } else if (bSection && aSection) {
      const maxTables = Math.max(bSection.tables.length, aSection.tables.length);
      const tableDiffs: TableDiff[] = [];

      for (let i = 0; i < maxTables; i++) {
        const bTable = bSection.tables[i] ?? { headers: [], rows: [] };
        const aTable = aSection.tables[i] ?? { headers: [], rows: [] };
        tableDiffs.push(diffTable(bTable, aTable));
      }

      const hasChanges = tableDiffs.some(
        (td) => td.summary.added > 0 || td.summary.removed > 0 || td.summary.modified > 0
      );

      if (hasChanges) {
        sectionsModified++;
      } else {
        sectionsUnchanged++;
      }

      tableDiffs.forEach((td) => {
        totalRowsAdded += td.summary.added;
        totalRowsRemoved += td.summary.removed;
        totalRowsModified += td.summary.modified;
      });

      sections.push({ name, status: hasChanges ? "modified" : "unchanged", tableDiffs });
    }
  }

  sections.sort((a, b) => {
    const order: Record<ChangeType, number> = { modified: 0, added: 1, removed: 2, unchanged: 3 };
    return order[a.status] - order[b.status];
  });

  return {
    sections,
    summary: { sectionsAdded, sectionsRemoved, sectionsModified, sectionsUnchanged, totalRowsAdded, totalRowsRemoved, totalRowsModified },
  };
}
