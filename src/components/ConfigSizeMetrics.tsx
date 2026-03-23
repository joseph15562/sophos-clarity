"use client";

import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";

type ExtractedSection = {
  tables: Array<{ headers: string[]; rows: Record<string, string>[] }>;
  text: string;
  details: unknown[];
};

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  files: Array<{
    extractedData: Record<string, ExtractedSection>;
  }>;
}

const SOPHOS_COLORS = [
  "#2006F7",
  "#5A00FF",
  "#009CFB",
  "#00F2B3",
  "#F29400",
  "#EA0022",
];

export function ConfigSizeMetrics({ analysisResults, files }: Props) {
  const { sections: s, rows: r, objects: o, complexity: c, treemapData } = useMemo(() => {
    const results = Object.values(analysisResults);
    const ar = results[0];
    const stats = ar?.stats ?? { totalSections: 0, populatedSections: 0 };
    let totalRows = 0;
    let totalObjects = 0;
    const sectionRows: Array<{ name: string; value: number; color: string }> = [];

    for (const file of files) {
      const extracted = file.extractedData;
      if (!extracted || typeof extracted !== "object") continue;
      for (const [sectionKey, section] of Object.entries(extracted)) {
        if (!section || typeof section !== "object") continue;
        let rowsInSection = 0;
        for (const table of (section as { tables?: { rows?: unknown[] }[] }).tables ?? []) {
          const count = table?.rows?.length ?? 0;
          rowsInSection += count;
          totalRows += count;
        }
        if (rowsInSection > 0) {
          const isObjectSection = /network|hosts?|service|group/i.test(sectionKey);
          if (isObjectSection) totalObjects += rowsInSection;
          sectionRows.push({
            name: sectionKey,
            value: rowsInSection,
            color: SOPHOS_COLORS[sectionRows.length % SOPHOS_COLORS.length],
          });
        }
      }
    }

    const complexity =
      results.length > 0 && ar
        ? (() => {
            const ip = ar.inspectionPosture ?? { totalWanRules: 0, totalDisabledRules: 0 };
            const st = ar.stats ?? { totalRules: 0 };
            const findings = ar.findings ?? [];
            let raw = 0;
            if (st.totalRules > 100) raw += 30;
            else if (st.totalRules > 50) raw += 20;
            const wanTotal = ip.totalWanRules || 1;
            if (ip.totalDisabledRules / wanTotal > 0.2) raw += 15;
            const anyCount = findings.filter((f) => /ANY|any service/i.test(f.title)).length;
            raw += Math.min(anyCount * 10, 20);
            if (findings.some((f) => /overlapping/i.test(f.title))) raw += 10;
            if (findings.some((f) => /broad source/i.test(f.title))) raw += 10;
            return Math.min(100, Math.round(raw * 1.2));
          })()
        : 0;

    return {
      sections: stats.totalSections,
      populatedSections: stats.populatedSections,
      rows: totalRows,
      objects: totalObjects,
      complexity,
      treemapData: sectionRows.sort((a, b) => b.value - a.value),
    };
  }, [analysisResults, files]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Config Composition</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sections</div>
          <div className="text-lg font-bold text-foreground mt-0.5">{s}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rows</div>
          <div className="text-lg font-bold text-foreground mt-0.5">{r}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Objects</div>
          <div className="text-lg font-bold text-foreground mt-0.5">{o}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Complexity</div>
          <div className="text-lg font-bold text-foreground mt-0.5">{c}</div>
        </div>
      </div>

      {treemapData.length > 0 && (
        <div className="space-y-1.5">
          {treemapData.slice(0, 8).map((d) => {
            const maxVal = treemapData[0]?.value ?? 1;
            const pct = Math.max(4, (d.value / maxVal) * 100);
            return (
              <div key={d.name} className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground w-28 truncate shrink-0 text-right" title={d.name}>
                  {d.name.length > 18 ? d.name.slice(0, 16) + "…" : d.name}
                </span>
                <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${pct}%`, backgroundColor: d.color, opacity: 0.8 }}
                  />
                </div>
                <span className="text-foreground font-medium tabular-nums w-8 text-right">{d.value}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
