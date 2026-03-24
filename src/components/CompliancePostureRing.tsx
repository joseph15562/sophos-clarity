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
    <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 shadow-card">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="text-base font-display font-bold tracking-tight text-foreground">Compliance Posture</h3>
        {mappings.length > 1 && (
          <select
            value={activeFramework ?? ""}
            onChange={(e) => setSelectedFramework(e.target.value || null)}
            className="text-[11px] font-medium rounded-lg border border-border/60 bg-card text-foreground px-3 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30 focus:border-brand-accent/30 transition-colors"
          >
            {mappings.map((m) => (
              <option key={m.framework} value={m.framework}>
                {m.framework}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="relative" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
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
            <span className={`text-3xl font-display font-black tracking-tight tabular-nums ${
              compliantPct >= 75 ? "text-[#00F2B3]" : compliantPct >= 50 ? "text-[#F29400]" : "text-[#EA0022]"
            }`}>{compliantPct}%</span>
            <span className="block text-[11px] font-display font-semibold text-muted-foreground/60 mt-0.5">Compliant</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#00F2B3] shadow-[0_0_6px_rgba(0,242,179,0.4)]" />
          <span className="text-muted-foreground/70 font-medium">Pass</span>
          <span className="font-display font-bold tabular-nums text-foreground">{pass}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#F29400] shadow-[0_0_6px_rgba(242,148,0,0.4)]" />
          <span className="text-muted-foreground/70 font-medium">Partial</span>
          <span className="font-display font-bold tabular-nums text-foreground">{partial}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#EA0022] shadow-[0_0_6px_rgba(234,0,34,0.4)]" />
          <span className="text-muted-foreground/70 font-medium">Fail</span>
          <span className="font-display font-bold tabular-nums text-foreground">{fail}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#6B7280]" />
          <span className="text-muted-foreground/70 font-medium">N/A</span>
          <span className="font-display font-bold tabular-nums text-foreground">{na}</span>
        </div>
      </div>
    </div>
  );
}
