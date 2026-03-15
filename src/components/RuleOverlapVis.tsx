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

interface RuleInfo {
  index: number;
  name: string;
  source: string;
  destination: string;
  service: string;
}

function extractField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k].trim().toLowerCase();
  }
  return "";
}

function getRules(files: Props["files"]): RuleInfo[] {
  const rules: RuleInfo[] = [];
  for (const file of files) {
    const extracted = file.extractedData;
    if (!extracted) continue;
    for (const [sectionKey, section] of Object.entries(extracted)) {
      if (!/firewall\s*rules?/i.test(sectionKey)) continue;
      for (const table of section.tables ?? []) {
        table.rows?.forEach((row) => {
          rules.push({
            index: rules.length,
            name: extractField(row, "Rule Name", "Name", "Rule") || `R${rules.length + 1}`,
            source: extractField(row, "Source Networks", "Source", "Source Zone", "Src Networks"),
            destination: extractField(row, "Destination Networks", "Destination", "Destination Zone", "Dest Networks"),
            service: extractField(row, "Service", "Services", "Services/Ports"),
          });
        });
      }
    }
  }
  return rules;
}

function overlapScore(a: RuleInfo, b: RuleInfo): { score: number; reasons: string[] } {
  if (a.index === b.index) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;
  const srcA = a.source || "any";
  const srcB = b.source || "any";
  const dstA = a.destination || "any";
  const dstB = b.destination || "any";
  const svcA = a.service || "any";
  const svcB = b.service || "any";

  if (srcA === srcB || srcA === "any" || srcB === "any") {
    score++;
    reasons.push("source overlap");
  }
  if (dstA === dstB || dstA === "any" || dstB === "any") {
    score++;
    reasons.push("destination overlap");
  }
  if (svcA === svcB || svcA === "any" || svcB === "any") {
    score++;
    reasons.push("service overlap");
  }

  return { score, reasons };
}

export function RuleOverlapVis({ files }: Props) {
  const [hovered, setHovered] = useState<{ i: number; j: number } | null>(null);

  const { rules, matrix, maxRules } = useMemo(() => {
    const allRules = getRules(files);
    const rules = allRules.slice(0, 20);
    const matrix: number[][] = [];
    for (let i = 0; i < rules.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < rules.length; j++) {
        const { score } = overlapScore(rules[i], rules[j]);
        row.push(score);
      }
      matrix.push(row);
    }
    return { rules, matrix, maxRules: allRules.length };
  }, [files]);

  if (rules.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Rule Overlap Matrix</h3>
        <p className="text-sm text-muted-foreground">No firewall rules found</p>
      </div>
    );
  }

  const tooltip =
    hovered !== null
      ? (() => {
          const { score, reasons } = overlapScore(rules[hovered.i], rules[hovered.j]);
          if (hovered.i === hovered.j) return `Rule ${rules[hovered.i].name} (self)`;
          return `Rule ${rules[hovered.i].name} and Rule ${rules[hovered.j].name}: ${reasons.join(", ") || "no overlap"}`;
        })()
      : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Rule Overlap Matrix</h3>

      {maxRules > 20 && (
        <p className="text-[10px] text-muted-foreground mb-3">
          Showing first 20 of {maxRules} rules
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="inline-block min-w-0">
          <table className="border-collapse" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className="w-4 h-4 p-0" />
                {rules.map((r, j) => (
                  <th
                    key={j}
                    className="w-4 h-4 p-0 text-[8px] font-mono text-muted-foreground truncate max-w-[16px]"
                    title={r.name}
                  >
                    {r.name.length > 3 ? r.name.slice(0, 2) + "…" : r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={i}>
                  <td className="w-4 h-4 p-0 text-[8px] font-mono text-muted-foreground truncate align-middle">
                    {rules[i].name.length > 3 ? rules[i].name.slice(0, 2) + "…" : rules[i].name}
                  </td>
                  {row.map((score, j) => {
                    const isSelf = i === j;
                    const isHovered = hovered?.i === i && hovered?.j === j;
                    let bg = "bg-transparent";
                    if (isSelf) bg = "bg-muted";
                    else if (score === 3) bg = "bg-red-500/80";
                    else if (score === 2) bg = "bg-amber-500/60";
                    else if (score === 1) bg = "bg-amber-400/30";
                    return (
                      <td
                        key={j}
                        className={`w-4 h-4 p-0 border border-border/50 ${bg} ${isHovered ? "ring-1 ring-foreground" : ""}`}
                        style={{ width: 16, height: 16, minWidth: 16, minHeight: 16 }}
                        onMouseEnter={() => setHovered({ i, j })}
                        onMouseLeave={() => setHovered(null)}
                        title={
                          i === j
                            ? `Rule ${rules[i].name} (self)`
                            : `Rule ${rules[i].name} and Rule ${rules[j].name}: ${overlapScore(rules[i], rules[j]).reasons.join(", ") || "no overlap"}`
                        }
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {tooltip && (
        <p className="mt-3 text-[10px] text-muted-foreground">{tooltip}</p>
      )}

      <div className="flex gap-4 mt-3 text-[9px] text-muted-foreground">
        <span><span className="inline-block w-3 h-3 bg-amber-400/30 rounded-sm align-middle mr-1" /> 1 overlap</span>
        <span><span className="inline-block w-3 h-3 bg-amber-500/60 rounded-sm align-middle mr-1" /> 2 overlaps</span>
        <span><span className="inline-block w-3 h-3 bg-red-500/80 rounded-sm align-middle mr-1" /> 3 overlaps</span>
      </div>
    </div>
  );
}
