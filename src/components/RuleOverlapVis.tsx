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
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">Rule Overlap Matrix</h3>
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
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">Rule Overlap Matrix</h3>

      {maxRules > 20 && (
        <p className="text-[10px] text-muted-foreground mb-3">
          Showing first 20 of {maxRules} rules
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="inline-block min-w-0">
          <div className="flex">
            {/* Row labels column */}
            <div className="shrink-0" style={{ paddingTop: rules.length > 10 ? 72 : 56 }}>
              {rules.map((r, i) => (
                <div
                  key={i}
                  className={`text-[8px] font-mono truncate pr-1.5 flex items-center transition-colors ${
                    hovered?.i === i || hovered?.j === i
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                  }`}
                  style={{ height: 18, maxWidth: 80 }}
                  title={r.name}
                >
                  {r.name.length > 12 ? r.name.slice(0, 11) + "…" : r.name}
                </div>
              ))}
            </div>

            {/* Matrix with rotated column headers */}
            <div>
              {/* Column headers */}
              <div className="flex" style={{ height: rules.length > 10 ? 72 : 56 }}>
                {rules.map((r, j) => (
                  <div
                    key={j}
                    className="relative"
                    style={{ width: 18, height: "100%" }}
                  >
                    <span
                      className="absolute text-[8px] font-mono text-muted-foreground whitespace-nowrap origin-bottom-left"
                      style={{
                        bottom: 2,
                        left: 10,
                        transform: "rotate(-55deg)",
                        maxWidth: rules.length > 10 ? 68 : 52,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={r.name}
                    >
                      {r.name.length > 12 ? r.name.slice(0, 11) + "…" : r.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid cells */}
              {matrix.map((row, i) => (
                <div key={i} className="flex">
                  {row.map((score, j) => {
                    const isSelf = i === j;
                    const isHovered = hovered?.i === i && hovered?.j === j;
                    const isRowOrCol =
                      hovered !== null &&
                      !isHovered &&
                      (hovered.i === i || hovered.j === j);
                    let bg = "bg-transparent";
                    if (isSelf) bg = "bg-muted/60";
                    else if (score === 3) bg = "bg-red-500/80";
                    else if (score === 2) bg = "bg-amber-500/60";
                    else if (score === 1) bg = "bg-amber-400/30";
                    return (
                      <div
                        key={j}
                        className={`border border-border/40 ${bg} transition-all duration-75 ${
                          isHovered
                            ? "ring-1 ring-foreground z-10"
                            : isRowOrCol
                              ? "brightness-125"
                              : ""
                        }`}
                        style={{ width: 18, height: 18 }}
                        onMouseEnter={() => setHovered({ i, j })}
                        onMouseLeave={() => setHovered(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {hovered !== null && (
        <div className="mt-3 rounded-md bg-muted/20 border border-border/50 px-2.5 py-1.5">
          {hovered.i === hovered.j ? (
            <p className="text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground">{rules[hovered.i].name}</span> (self)
            </p>
          ) : (
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <p>
                <span className="font-medium text-foreground">{rules[hovered.i].name}</span>
                {" ↔ "}
                <span className="font-medium text-foreground">{rules[hovered.j].name}</span>
              </p>
              <p>
                {(() => {
                  const { score, reasons } = overlapScore(rules[hovered.i], rules[hovered.j]);
                  if (score === 0) return "No overlap";
                  return reasons.join(", ");
                })()}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4 mt-3 text-[9px] text-muted-foreground">
        <span><span className="inline-block w-3 h-3 bg-amber-400/30 rounded-sm align-middle mr-1" /> 1 overlap</span>
        <span><span className="inline-block w-3 h-3 bg-amber-500/60 rounded-sm align-middle mr-1" /> 2 overlaps</span>
        <span><span className="inline-block w-3 h-3 bg-red-500/80 rounded-sm align-middle mr-1" /> 3 overlaps</span>
      </div>
    </div>
  );
}
