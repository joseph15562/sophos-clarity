"use client";

import { useMemo } from "react";

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

interface RuleRow {
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

function getRules(files: Props["files"]): RuleRow[] {
  const rules: RuleRow[] = [];
  for (const file of files) {
    const extracted = file.extractedData;
    if (!extracted) continue;
    for (const [sectionKey, section] of Object.entries(extracted)) {
      if (!/firewall\s*rules?/i.test(sectionKey)) continue;
      for (const table of section.tables ?? []) {
        table.rows?.forEach((row, i) => {
          rules.push({
            index: rules.length,
            name: extractField(row, "Rule Name", "Name", "Rule") || `Rule ${rules.length + 1}`,
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

interface ConsolidationSet {
  rules: RuleRow[];
  common: { source?: string; destination?: string; service?: string };
  differs: { sources?: string[]; destinations?: string[]; services?: string[] };
}

function findConsolidationOpportunities(rules: RuleRow[]): ConsolidationSet[] {
  const sets: ConsolidationSet[] = [];
  const used = new Set<number>();

  for (let i = 0; i < rules.length; i++) {
    if (used.has(i)) continue;
    const a = rules[i];
    const group: RuleRow[] = [a];
    used.add(i);
    let pattern: "src-dst" | "src-svc" | "dst-svc" | null = null;

    for (let j = i + 1; j < rules.length; j++) {
      if (used.has(j)) continue;
      const b = rules[j];

      const sameSrc = a.source === b.source;
      const sameDst = a.destination === b.destination;
      const sameSvc = a.service === b.service;

      let mergeable = false;
      let p: "src-dst" | "src-svc" | "dst-svc" | null = null;
      if (sameSrc && sameDst && !sameSvc) {
        mergeable = true;
        p = "src-dst";
      } else if (sameSrc && sameSvc && !sameDst) {
        mergeable = true;
        p = "src-svc";
      } else if (sameDst && sameSvc && !sameSrc) {
        mergeable = true;
        p = "dst-svc";
      }

      if (mergeable && (pattern === null || pattern === p)) {
        const allMatch =
          pattern === "src-dst"
            ? group.every((r) => r.source === b.source && r.destination === b.destination)
            : pattern === "src-svc"
              ? group.every((r) => r.source === b.source && r.service === b.service)
              : group.every((r) => r.destination === b.destination && r.service === b.service);
        if (allMatch) {
          pattern = p;
          group.push(b);
          used.add(j);
        }
      }
    }

    if (group.length >= 2) {
      const common: ConsolidationSet["common"] = {};
      const differs: ConsolidationSet["differs"] = {};

      const sources = [...new Set(group.map((r) => r.source))];
      const destinations = [...new Set(group.map((r) => r.destination))];
      const services = [...new Set(group.map((r) => r.service))];

      if (sources.length === 1) common.source = sources[0] || "any";
      else differs.sources = sources;
      if (destinations.length === 1) common.destination = destinations[0] || "any";
      else differs.destinations = destinations;
      if (services.length === 1) common.service = services[0] || "any";
      else differs.services = services;

      sets.push({ rules: group, common, differs });
    }
  }

  return sets;
}

export function RuleConsolidation({ files }: Props) {
  const { opportunities, totalBefore, totalAfter } = useMemo(() => {
    const rules = getRules(files);
    const opportunities = findConsolidationOpportunities(rules);
    const rulesInSets = new Set(opportunities.flatMap((s) => s.rules.map((r) => r.index)));
    const afterCount = rules.length - rulesInSets.size + opportunities.length;
    return {
      opportunities,
      totalBefore: rules.length,
      totalAfter: afterCount,
    };
  }, [files]);

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.14] dark:border-white/[0.1] p-5 sm:p-6 shadow-card backdrop-blur-md transition-all duration-200 hover:border-slate-900/[0.18] dark:hover:border-white/[0.14] hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(0,156,251,0.06), rgba(32,6,247,0.05), rgba(255,255,255,0.02))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,156,251,0.35), rgba(0,237,255,0.2), transparent)",
        }}
      />
      <h3 className="relative text-lg font-display font-black tracking-tight text-foreground mb-4">
        Rule Consolidation
      </h3>

      {opportunities.length === 0 ? (
        <div
          className="relative rounded-xl px-4 py-6 text-center border border-slate-900/[0.12] dark:border-white/[0.08] backdrop-blur-sm"
          style={{
            background: "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <p className="text-sm font-medium text-foreground/55">
            No consolidation opportunities found
          </p>
          <p className="text-xs text-foreground/35 mt-2 max-w-md mx-auto">
            When rules share two dimensions but differ on the third, they will appear here as merge
            candidates.
          </p>
        </div>
      ) : (
        <>
          <p className="relative text-xs font-semibold text-foreground/55 mb-4">
            {opportunities.reduce((s, o) => s + o.rules.length, 0)} rules could be consolidated into{" "}
            <span className="text-[#00F2B3] font-black tabular-nums">{totalAfter}</span>
          </p>

          <div className="relative space-y-3 max-h-72 overflow-y-auto pr-1">
            {opportunities.slice(0, 10).map((set, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-900/[0.14] dark:border-white/[0.1] p-3.5 sm:p-4 text-xs backdrop-blur-sm transition-all hover:border-[#009CFB]/30 hover:bg-slate-950/[0.03] dark:hover:bg-white/[0.02]"
                style={{
                  background:
                    "linear-gradient(105deg, rgba(0,156,251,0.08), rgba(255,255,255,0.02))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 28px rgba(0,0,0,0.12)",
                }}
              >
                <p className="font-display font-bold text-foreground mb-2 leading-snug">
                  Rules {set.rules.map((r) => r.name).join(", ")} could be merged
                </p>
                <div className="space-y-1 text-foreground/55 leading-relaxed">
                  {set.common.source && <span>Same source: {set.common.source}</span>}
                  {set.common.destination && <span> | Same dest: {set.common.destination}</span>}
                  {set.common.service && <span> | Same service: {set.common.service}</span>}
                </div>
                {set.differs.sources?.length ||
                set.differs.destinations?.length ||
                set.differs.services?.length ? (
                  <p className="mt-2 text-foreground/50 text-[11px]">
                    Differs:{" "}
                    {set.differs.services?.length && `Services: ${set.differs.services.join(", ")}`}
                    {set.differs.destinations?.length &&
                      ` Destinations: ${set.differs.destinations.join(", ")}`}
                    {set.differs.sources?.length && ` Sources: ${set.differs.sources.join(", ")}`}
                  </p>
                ) : null}
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[#009CFB]">
                  Before: {set.rules.length} rules → After: 1 rule
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
