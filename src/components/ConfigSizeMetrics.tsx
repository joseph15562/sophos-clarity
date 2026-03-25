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

const SOPHOS_COLORS = ["#2006F7", "#5A00FF", "#009CFB", "#00F2B3", "#F29400", "#EA0022"];

export function ConfigSizeMetrics({ analysisResults, files }: Props) {
  const {
    sections: s,
    rows: r,
    objects: o,
    complexity: c,
    treemapData,
  } = useMemo(() => {
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
    <div
      className="relative rounded-2xl border border-slate-900/[0.12] dark:border-white/[0.08] p-5 sm:p-6 shadow-card backdrop-blur-sm transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(32,6,247,0.07), rgba(90,0,255,0.04), rgba(255,255,255,0.02))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(32,6,247,0.35), rgba(0,156,251,0.2), transparent)",
        }}
      />
      <h3 className="relative text-lg font-display font-black tracking-tight text-foreground mb-5">
        Config Composition
      </h3>

      <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {(
          [
            { label: "Sections", value: s },
            { label: "Rows", value: r },
            { label: "Objects", value: o },
            { label: "Complexity", value: c },
          ] as const
        ).map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-3 sm:p-3.5 backdrop-blur-sm border border-slate-900/[0.12] dark:border-white/[0.08] transition-transform hover:scale-[1.02]"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.15)",
            }}
          >
            <div className="text-[10px] font-bold text-foreground/45 uppercase tracking-[0.12em]">
              {stat.label}
            </div>
            <div className="text-xl sm:text-2xl font-display font-black text-foreground mt-1 tabular-nums">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {treemapData.length > 0 && (
        <div
          className="relative space-y-2.5 rounded-xl p-3 backdrop-blur-sm border border-slate-900/[0.10] dark:border-white/[0.06]"
          style={{
            background: "rgba(255,255,255,0.02)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {treemapData.slice(0, 8).map((d) => {
            const maxVal = treemapData[0]?.value ?? 1;
            const pct = Math.max(4, (d.value / maxVal) * 100);
            return (
              <div key={d.name} className="flex items-center gap-2 sm:gap-3 text-xs">
                <span
                  className="text-foreground/55 w-28 sm:w-32 truncate shrink-0 text-right font-semibold"
                  title={d.name}
                >
                  {d.name.length > 18 ? d.name.slice(0, 16) + "…" : d.name}
                </span>
                <div
                  className="flex-1 h-4 sm:h-4 rounded-full overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.25)",
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${d.color}dd, ${d.color})`,
                      boxShadow: `0 0 12px ${d.color}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
                    }}
                  />
                </div>
                <span className="text-foreground font-black tabular-nums w-8 text-right text-sm">
                  {d.value}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
