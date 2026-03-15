"use client";

import { useMemo } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
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
  "#00995a",
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
      if (!extracted) continue;
      for (const [sectionKey, section] of Object.entries(extracted)) {
        let rowsInSection = 0;
        for (const table of section.tables ?? []) {
          const count = table.rows?.length ?? 0;
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
            const ip = ar.inspectionPosture;
            const s = ar.stats;
            let raw = 0;
            if (s.totalRules > 100) raw += 30;
            else if (s.totalRules > 50) raw += 20;
            const wanTotal = ip.totalWanRules || 1;
            if (ip.totalDisabledRules / wanTotal > 0.2) raw += 15;
            const anyCount = ar.findings.filter((f) => /ANY|any service/i.test(f.title)).length;
            raw += Math.min(anyCount * 10, 20);
            if (ar.findings.some((f) => /overlapping/i.test(f.title))) raw += 10;
            if (ar.findings.some((f) => /broad source/i.test(f.title))) raw += 10;
            return Math.min(100, Math.round(raw * 1.2));
          })()
        : 0;

    return {
      sections: stats.totalSections,
      populatedSections: stats.populatedSections,
      rows: totalRows,
      objects: totalObjects,
      complexity,
      treemapData: {
        name: "root",
        children: sectionRows.sort((a, b) => b.value - a.value),
      },
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

      {treemapData.children.length > 0 && (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapData}
              dataKey="value"
              stroke="hsl(var(--border))"
              content={({ x, y, width, height, name, value, color }) => {
                if (name === "root" || width < 40 || height < 24) return null;
                return (
                  <g>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={color}
                      fillOpacity={0.7}
                      stroke="hsl(var(--border))"
                      strokeWidth={1}
                    />
                    <text
                      x={x + width / 2}
                      y={y + height / 2 - 5}
                      textAnchor="middle"
                      fill="hsl(var(--card))"
                      fontSize={9}
                      fontWeight={600}
                    >
                      {name.length > 20 ? name.slice(0, 18) + "…" : name}
                    </text>
                    <text
                      x={x + width / 2}
                      y={y + height / 2 + 6}
                      textAnchor="middle"
                      fill="hsl(var(--card))"
                      fontSize={8}
                      fillOpacity={0.9}
                    >
                      {value} rows
                    </text>
                  </g>
                );
              }}
            >
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-md border border-border bg-card px-2 py-1.5 text-xs shadow-md">
                      <span className="font-medium">{d.name}</span>: {d.value} rows
                    </div>
                  );
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
