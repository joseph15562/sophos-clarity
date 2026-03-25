"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

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
            destination: extractField(
              row,
              "Destination Networks",
              "Destination",
              "Destination Zone",
              "Dest Networks",
            ),
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

const CELL = 20;

function cellStyle(
  score: number,
  isSelf: boolean,
  isHovered: boolean,
  isRowOrCol: boolean,
): CSSProperties {
  if (isSelf) {
    return {
      background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
      borderColor: "rgba(255,255,255,0.12)",
      boxShadow: isHovered
        ? "0 0 0 2px rgba(0,237,255,0.5), 0 0 16px rgba(0,237,255,0.2)"
        : "inset 0 1px 0 rgba(255,255,255,0.06)",
    };
  }
  if (score === 3) {
    return {
      background: "linear-gradient(145deg, #FF3355, #EA0022)",
      borderColor: "rgba(255,255,255,0.15)",
      boxShadow: isHovered
        ? "0 0 14px rgba(234,0,34,0.75), inset 0 1px 0 rgba(255,255,255,0.25)"
        : "0 0 8px rgba(234,0,34,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
    };
  }
  if (score === 2) {
    return {
      background: "linear-gradient(145deg, #FFB020, #F29400)",
      borderColor: "rgba(255,255,255,0.12)",
      boxShadow: isHovered
        ? "0 0 14px rgba(242,148,0,0.65), inset 0 1px 0 rgba(255,255,255,0.25)"
        : "0 0 8px rgba(242,148,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
    };
  }
  if (score === 1) {
    return {
      background: "linear-gradient(145deg, #00F2B3, #00C4A3)",
      borderColor: "rgba(255,255,255,0.12)",
      boxShadow: isHovered
        ? "0 0 14px rgba(0,242,179,0.55), inset 0 1px 0 rgba(255,255,255,0.3)"
        : "0 0 8px rgba(0,242,179,0.25), inset 0 1px 0 rgba(255,255,255,0.2)",
    };
  }
  return {
    background: "rgba(255,255,255,0.02)",
    borderColor: "rgba(255,255,255,0.06)",
    boxShadow: isRowOrCol ? "inset 0 0 0 1px rgba(0,237,255,0.15)" : "none",
    filter: isRowOrCol ? "brightness(1.15)" : undefined,
  };
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

  const shell = (children: ReactNode) => (
    <div
      className="relative rounded-2xl border border-slate-900/[0.14] dark:border-white/[0.1] p-5 sm:p-6 shadow-card backdrop-blur-md transition-all duration-200 hover:border-slate-900/[0.18] dark:hover:border-white/[0.14] hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(234,0,34,0.05), rgba(242,148,0,0.04), rgba(0,242,179,0.03), rgba(255,255,255,0.02))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,242,179,0.25), rgba(242,148,0,0.2), rgba(234,0,34,0.15), transparent)",
        }}
      />
      {children}
    </div>
  );

  if (rules.length === 0) {
    return shell(
      <>
        <h3 className="relative text-lg font-display font-black tracking-tight text-foreground mb-3">
          Rule Overlap Matrix
        </h3>
        <p className="relative text-sm text-foreground/50">No firewall rules found</p>
      </>,
    );
  }

  const headerH = rules.length > 10 ? 76 : 60;

  return shell(
    <>
      <h3 className="relative text-lg font-display font-black tracking-tight text-foreground mb-1">
        Rule Overlap Matrix
      </h3>
      <p className="relative text-xs text-foreground/45 mb-4">
        Source, destination, and service dimensions — brighter cells mean stronger overlap.
      </p>

      {maxRules > 20 && (
        <p className="relative text-[11px] font-semibold text-[#F29400] mb-3">
          Showing first 20 of {maxRules} rules
        </p>
      )}

      <div className="relative flex flex-col lg:flex-row lg:items-start gap-5 lg:gap-6">
        <div
          className="overflow-x-auto min-w-0 flex-1 rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-3 backdrop-blur-sm"
          style={{
            background: "rgba(255,255,255,0.02)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="inline-block min-w-0">
            <div className="flex">
              <div className="shrink-0" style={{ paddingTop: headerH }}>
                {rules.map((r, i) => (
                  <div
                    key={i}
                    className={`text-[9px] font-mono truncate pr-2 flex items-center transition-all duration-150 ${
                      hovered?.i === i || hovered?.j === i
                        ? "text-[#00EDFF] font-bold drop-shadow-[0_0_8px_rgba(0,237,255,0.35)]"
                        : "text-foreground/50"
                    }`}
                    style={{ height: CELL, maxWidth: 88 }}
                    title={r.name}
                  >
                    {r.name.length > 13 ? r.name.slice(0, 12) + "…" : r.name}
                  </div>
                ))}
              </div>

              <div>
                <div className="flex" style={{ height: headerH }}>
                  {rules.map((r, j) => (
                    <div
                      key={j}
                      className="relative flex justify-center"
                      style={{ width: CELL, height: "100%" }}
                    >
                      <span
                        className="absolute text-[9px] font-mono text-foreground/45 whitespace-nowrap origin-bottom-left leading-none"
                        style={{
                          bottom: 4,
                          left: CELL * 0.55,
                          transform: "rotate(-52deg)",
                          maxWidth: rules.length > 10 ? 72 : 56,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={r.name}
                      >
                        {r.name.length > 13 ? r.name.slice(0, 12) + "…" : r.name}
                      </span>
                    </div>
                  ))}
                </div>

                {matrix.map((row, i) => (
                  <div key={i} className="flex">
                    {row.map((score, j) => {
                      const isSelf = i === j;
                      const isHovered = hovered?.i === i && hovered?.j === j;
                      const isRowOrCol =
                        hovered !== null && !isHovered && (hovered.i === i || hovered.j === j);
                      return (
                        <div
                          key={j}
                          role="presentation"
                          className="shrink-0 rounded-[4px] border cursor-pointer transition-all duration-100 hover:z-[2] hover:scale-110"
                          style={{
                            width: CELL,
                            height: CELL,
                            ...cellStyle(score, isSelf, isHovered, isRowOrCol),
                          }}
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

        <div className="w-full lg:w-[min(100%,280px)] shrink-0 flex flex-col gap-4">
          <div
            className="rounded-xl border border-slate-900/[0.12] dark:border-white/[0.08] p-4 min-h-[160px] backdrop-blur-sm flex flex-col justify-center"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {hovered === null ? (
              <p className="text-sm text-foreground/40 text-center leading-relaxed">
                Hover a cell to see{" "}
                <span className="text-foreground/60 font-semibold">rule pair details</span> and
                overlap reasons.
              </p>
            ) : hovered.i === hovered.j ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                  Diagonal
                </p>
                <p className="text-sm text-foreground/70">
                  <span className="font-display font-bold text-foreground">
                    {rules[hovered.i].name}
                  </span>
                  <span className="text-foreground/45"> — same rule (no overlap)</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                  Overlap
                </p>
                <p className="text-sm leading-snug">
                  <span className="font-display font-bold text-[#00EDFF]">
                    {rules[hovered.i].name}
                  </span>
                  <span className="text-foreground/35 mx-1">↔</span>
                  <span className="font-display font-bold text-[#00EDFF]">
                    {rules[hovered.j].name}
                  </span>
                </p>
                <p className="text-xs text-foreground/55">
                  {(() => {
                    const { score, reasons } = overlapScore(rules[hovered.i], rules[hovered.j]);
                    if (score === 0) return "No overlap on source, destination, or service.";
                    return reasons.join(" · ");
                  })()}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                {
                  n: 1,
                  label: "1 overlap",
                  swatch: "linear-gradient(145deg, #00F2B3, #00C4A3)",
                  glow: "0 0 10px rgba(0,242,179,0.5)",
                },
                {
                  n: 2,
                  label: "2 overlaps",
                  swatch: "linear-gradient(145deg, #FFB020, #F29400)",
                  glow: "0 0 10px rgba(242,148,0,0.45)",
                },
                {
                  n: 3,
                  label: "3 overlaps",
                  swatch: "linear-gradient(145deg, #FF3355, #EA0022)",
                  glow: "0 0 10px rgba(234,0,34,0.5)",
                },
              ] as const
            ).map((leg) => (
              <span
                key={leg.n}
                className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg text-[11px] font-bold text-foreground/70 border border-slate-900/[0.14] dark:border-white/[0.1] backdrop-blur-sm"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                <span
                  className="h-3.5 w-3.5 rounded-md shrink-0 border border-white/20"
                  style={{ background: leg.swatch, boxShadow: leg.glow }}
                />
                {leg.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>,
  );
}
