"use client";

import { useMemo, useState } from "react";

type ExtractedSection = {
  tables: Array<{ headers: string[]; rows: Record<string, string>[] }>;
  text: string;
  details: unknown[];
};

interface Props {
  files: Array<{
    label: string;
    extractedData: Record<string, ExtractedSection>;
  }>;
}

function isNetworkSection(key: string): boolean {
  return /network|hosts|ip.?host/i.test(key);
}

function isServiceSection(key: string): boolean {
  return /service/i.test(key) && !/local service acl/i.test(key);
}

function isHostGroupSection(key: string): boolean {
  return /group|host.?group/i.test(key);
}

function getNameFromRow(row: Record<string, string>, headers: string[]): string {
  for (const h of ["Name", "Host Name", "Object Name", "Service Name", "Group Name"]) {
    if (row[h]) return row[h].trim();
  }
  const firstCol = headers[0];
  if (firstCol && row[firstCol]) return row[firstCol].trim();
  return Object.values(row)[0]?.trim() ?? "";
}

function extractReferencedObjects(files: Props["files"]): Set<string> {
  const refs = new Set<string>();
  for (const file of files) {
    const extracted = file.extractedData;
    if (!extracted) continue;
    for (const [sectionKey, section] of Object.entries(extracted)) {
      if (!/firewall\s*rules?/i.test(sectionKey)) continue;
      for (const table of section.tables ?? []) {
        for (const row of table.rows ?? []) {
          const src = (row["Source Networks"] ?? row["Source"] ?? row["Src Networks"] ?? "").trim();
          const dst = (
            row["Destination Networks"] ??
            row["Destination"] ??
            row["Dest Networks"] ??
            ""
          ).trim();
          const svc = (row["Service"] ?? row["Services"] ?? row["Services/Ports"] ?? "").trim();
          for (const v of [src, dst, svc].flatMap((s) => s.split(/[,;]/).map((x) => x.trim()))) {
            if (v) refs.add(v.toLowerCase());
          }
        }
      }
    }
  }
  return refs;
}

export function UnusedObjects({ files }: Props) {
  const [showAll, setShowAll] = useState(false);

  const { objects, unusedCount } = useMemo(() => {
    const refs = extractReferencedObjects(files);
    const objects: Array<{ name: string; type: string; referenced: boolean }> = [];

    for (const file of files) {
      const extracted = file.extractedData;
      if (!extracted) continue;

      for (const [sectionKey, section] of Object.entries(extracted)) {
        let type = "Object";
        if (isNetworkSection(sectionKey)) type = "Network";
        else if (isServiceSection(sectionKey)) type = "Service";
        else if (isHostGroupSection(sectionKey)) type = "Group";
        else continue;

        for (const table of section.tables ?? []) {
          const headers = table.headers ?? [];
          for (const row of table.rows ?? []) {
            const name = getNameFromRow(row, headers);
            if (!name) continue;
            const referenced = refs.has(name.toLowerCase());
            objects.push({ name, type, referenced });
          }
        }
      }
    }

    const unique = new Map<string, { name: string; type: string; referenced: boolean }>();
    for (const o of objects) {
      const key = `${o.name.toLowerCase()}|${o.type}`;
      if (!unique.has(key)) unique.set(key, o);
    }
    const list = Array.from(unique.values());
    const unusedCount = list.filter((o) => !o.referenced).length;

    return { objects: list, unusedCount };
  }, [files]);

  const displayObjects = showAll ? objects : objects.filter((o) => !o.referenced);

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">
        Unused Objects
      </h3>

      {unusedCount > 0 ? (
        <p className="text-[10px] text-muted-foreground mb-3">
          {unusedCount} unused object{unusedCount !== 1 ? "s" : ""} found
        </p>
      ) : objects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No objects found in config.</p>
      ) : (
        <p className="text-[10px] text-muted-foreground mb-3">All objects are in use</p>
      )}

      {objects.length > 0 && (
        <>
          <label className="flex items-center gap-2 mb-3 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded border-border"
            />
            Show all objects
          </label>

          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-semibold text-foreground">Name</th>
                  <th className="text-left py-2 font-semibold text-foreground">Type</th>
                  <th className="text-left py-2 font-semibold text-foreground">Referenced</th>
                </tr>
              </thead>
              <tbody>
                {displayObjects.map((o, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 text-foreground font-mono">{o.name}</td>
                    <td className="py-1.5 text-muted-foreground">{o.type}</td>
                    <td className="py-1.5">{o.referenced ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
