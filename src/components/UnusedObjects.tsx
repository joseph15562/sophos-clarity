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

  const typeStyle = (type: string) => {
    if (type === "Network") return "border-[#009CFB]/35 text-[#009CFB] bg-[#009CFB]/12";
    if (type === "Group") return "border-[#5A00FF]/35 text-[#B47AFF] bg-[#5A00FF]/12";
    if (type === "Service")
      return "border-[#00F2B3]/35 text-[#00F2B3] bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10";
    return "border-white/15 text-foreground/70 bg-white/75 dark:bg-white/[0.04]";
  };

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.12] dark:border-white/[0.08] p-5 sm:p-6 shadow-card backdrop-blur-sm transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(234,0,34,0.04), rgba(32,6,247,0.04), rgba(255,255,255,0.02))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(234,0,34,0.2), rgba(0,237,255,0.15), transparent)",
        }}
      />
      <h3 className="relative text-lg font-display font-black tracking-tight text-foreground mb-2">
        Unused Objects
      </h3>

      {unusedCount > 0 ? (
        <p className="relative text-sm text-foreground/50 font-medium mb-4">
          {unusedCount} unused object{unusedCount !== 1 ? "s" : ""} found
        </p>
      ) : objects.length === 0 ? (
        <p className="relative text-sm text-foreground/50">No objects found in config.</p>
      ) : (
        <p className="relative text-sm text-foreground/50 font-medium mb-4">
          All objects are in use
        </p>
      )}

      {objects.length > 0 && (
        <>
          <label className="relative flex items-center gap-3 mb-4 cursor-pointer group">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="h-4 w-4 rounded-md border-white/20 bg-white/75 dark:bg-white/[0.04] text-[#2006F7] focus:ring-2 focus:ring-[#00EDFF]/30 accent-[#00EDFF]"
            />
            <span className="text-sm font-semibold text-foreground/70 group-hover:text-foreground transition-colors">
              Show all objects
            </span>
          </label>

          <div
            className="relative overflow-x-auto max-h-56 overflow-y-auto rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm"
            style={{
              background: "rgba(255,255,255,0.02)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr
                  className="border-b border-slate-900/[0.12] dark:border-white/[0.08]"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <th className="text-left py-3 px-3 font-display font-bold text-foreground/50 uppercase tracking-wider text-[10px]">
                    Name
                  </th>
                  <th className="text-left py-3 px-3 font-display font-bold text-foreground/50 uppercase tracking-wider text-[10px]">
                    Type
                  </th>
                  <th className="text-left py-3 px-3 font-display font-bold text-foreground/50 uppercase tracking-wider text-[10px]">
                    Referenced
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayObjects.map((o, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-900/[0.08] dark:border-white/[0.04] last:border-b-0 transition-colors hover:bg-slate-950/[0.05] dark:hover:bg-white/[0.04]"
                  >
                    <td className="py-2.5 px-3 text-foreground font-mono font-medium">{o.name}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border backdrop-blur-sm ${typeStyle(o.type)}`}
                        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
                      >
                        {o.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {o.referenced ? (
                        <span
                          className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black border border-emerald-500/35 text-emerald-300 bg-emerald-500/10"
                          style={{ boxShadow: "0 0 10px rgba(52,211,153,0.15)" }}
                        >
                          Yes
                        </span>
                      ) : (
                        <span
                          className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black border border-red-500/35 text-red-300 bg-red-500/10"
                          style={{ boxShadow: "0 0 10px rgba(248,113,113,0.12)" }}
                        >
                          No
                        </span>
                      )}
                    </td>
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
