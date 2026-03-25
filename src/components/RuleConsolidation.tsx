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
      let p: typeof pattern = null;
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
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">
        Rule Consolidation
      </h3>

      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No consolidation opportunities found</p>
      ) : (
        <>
          <p className="text-[10px] text-muted-foreground mb-4">
            {opportunities.reduce((s, o) => s + o.rules.length, 0)} rules could be consolidated into{" "}
            {totalAfter}
          </p>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {opportunities.slice(0, 10).map((set, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border bg-muted/20 p-3 text-[10px]"
              >
                <p className="font-semibold text-foreground mb-1.5">
                  Rules {set.rules.map((r) => r.name).join(", ")} could be merged
                </p>
                <div className="space-y-1 text-muted-foreground">
                  {set.common.source && <span>Same source: {set.common.source}</span>}
                  {set.common.destination && <span> | Same dest: {set.common.destination}</span>}
                  {set.common.service && <span> | Same service: {set.common.service}</span>}
                </div>
                {set.differs.sources?.length ||
                set.differs.destinations?.length ||
                set.differs.services?.length ? (
                  <p className="mt-1.5 text-muted-foreground">
                    Differs:{" "}
                    {set.differs.services?.length && `Services: ${set.differs.services.join(", ")}`}
                    {set.differs.destinations?.length &&
                      ` Destinations: ${set.differs.destinations.join(", ")}`}
                    {set.differs.sources?.length && ` Sources: ${set.differs.sources.join(", ")}`}
                  </p>
                ) : null}
                <p className="mt-1 text-[9px] text-muted-foreground">
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
