import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { AnalysisResult } from "@/lib/analyse-config";
import { mapToAllFrameworks } from "@/lib/compliance-map";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  selectedFrameworks: string[];
}

const STATUS_COLORS = {
  pass: "#00F2B3",
  partial: "#F29400",
  fail: "#EA0022",
  na: "#6B7280",
} as const;

export function CompliancePostureRing({ analysisResults, selectedFrameworks }: Props) {
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);

  const firstResult = Object.values(analysisResults)[0];
  const mappings = useMemo(() => {
    if (!firstResult) return [];
    const fws = selectedFrameworks.length > 0 ? selectedFrameworks : ["NCSC Guidelines", "Cyber Essentials / CE+"];
    return mapToAllFrameworks(fws, firstResult);
  }, [firstResult, selectedFrameworks]);

  const { data, compliantPct, pass, partial, fail, na } = useMemo(() => {
    const activeFramework = selectedFramework ?? mappings[0]?.framework ?? null;
    const mapping = mappings.find((m) => m.framework === activeFramework);
    if (!mapping) return { data: [], compliantPct: 0, pass: 0, partial: 0, fail: 0, na: 0 };

    const { summary } = mapping;
    const totalApplicable = summary.pass + summary.partial + summary.fail;
    const compliantPct = totalApplicable > 0 ? Math.round((summary.pass / totalApplicable) * 100) : 0;

    const data = [
      { name: "Pass", value: summary.pass, color: STATUS_COLORS.pass },
      { name: "Partial", value: summary.partial, color: STATUS_COLORS.partial },
      { name: "Fail", value: summary.fail, color: STATUS_COLORS.fail },
      { name: "N/A", value: summary.na, color: STATUS_COLORS.na },
    ].filter((d) => d.value > 0);

    return {
      data,
      compliantPct,
      pass: summary.pass,
      partial: summary.partial,
      fail: summary.fail,
      na: summary.na,
    };
  }, [mappings, selectedFramework]);

  const activeFramework = selectedFramework ?? mappings[0]?.framework ?? null;

  if (mappings.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-foreground">Compliance Posture</h3>
        {mappings.length > 1 && (
          <select
            value={activeFramework ?? ""}
            onChange={(e) => setSelectedFramework(e.target.value || null)}
            className="text-[10px] font-medium rounded-md border border-border bg-muted/30 text-foreground px-2 py-1"
          >
            {mappings.map((m) => (
              <option key={m.framework} value={m.framework}>
                {m.framework}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="relative" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="text-center">
            <span className="text-2xl font-bold text-foreground tabular-nums">{compliantPct}%</span>
            <span className="block text-xs text-muted-foreground">Compliant</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0 bg-[#00F2B3]" />
          <span className="text-muted-foreground">Pass</span>
          <span className="font-bold tabular-nums text-foreground">{pass}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0 bg-[#F29400]" />
          <span className="text-muted-foreground">Partial</span>
          <span className="font-bold tabular-nums text-foreground">{partial}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0 bg-[#EA0022]" />
          <span className="text-muted-foreground">Fail</span>
          <span className="font-bold tabular-nums text-foreground">{fail}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0 bg-[#6B7280]" />
          <span className="text-muted-foreground">N/A</span>
          <span className="font-bold tabular-nums text-foreground">{na}</span>
        </div>
      </div>
    </div>
  );
}
