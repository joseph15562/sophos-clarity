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
    const fws =
      selectedFrameworks.length > 0
        ? selectedFrameworks
        : ["NCSC Guidelines", "Cyber Essentials / CE+"];
    return mapToAllFrameworks(fws, firstResult);
  }, [firstResult, selectedFrameworks]);

  const { data, compliantPct, pass, partial, fail, na } = useMemo(() => {
    const activeFramework = selectedFramework ?? mappings[0]?.framework ?? null;
    const mapping = mappings.find((m) => m.framework === activeFramework);
    if (!mapping) return { data: [], compliantPct: 0, pass: 0, partial: 0, fail: 0, na: 0 };

    const { summary } = mapping;
    const totalApplicable = summary.pass + summary.partial + summary.fail;
    const compliantPct =
      totalApplicable > 0 ? Math.round((summary.pass / totalApplicable) * 100) : 0;

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

  const pctColor = compliantPct >= 75 ? "#00F2B3" : compliantPct >= 50 ? "#F29400" : "#EA0022";

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-8 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(0,242,179,0.05), rgba(242,148,0,0.03), rgba(234,0,34,0.02), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,242,179,0.2), rgba(242,148,0,0.12), transparent)",
        }}
      />
      <div className="flex items-center justify-between gap-3 mb-6">
        <h3 className="text-lg font-display font-black tracking-tight text-foreground">
          Compliance Posture
        </h3>
        {mappings.length > 1 && (
          <select
            value={activeFramework ?? ""}
            onChange={(e) => setSelectedFramework(e.target.value || null)}
            className="text-xs font-bold rounded-xl backdrop-blur-sm text-foreground px-3.5 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00F2B3]/25 transition-all"
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {mappings.map((m) => (
              <option key={m.framework} value={m.framework}>
                {m.framework}
              </option>
            ))}
          </select>
        )}
      </div>
      <div
        className="relative rounded-xl mx-auto max-w-sm"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="relative" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={88}
                outerRadius={128}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    style={{ filter: "drop-shadow(0 0 4px rgba(0,0,0,0.3))" }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <div className="text-center px-2">
              <span
                className="text-4xl sm:text-5xl font-display font-black tracking-tight tabular-nums block"
                style={{ color: pctColor, filter: `drop-shadow(0 0 12px ${pctColor}35)` }}
              >
                {compliantPct}%
              </span>
              <span className="block text-sm font-display font-bold text-foreground/45 mt-1">
                Compliant
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#00F2B3] shadow-[0_0_6px_rgba(0,242,179,0.4)]" />
          <span className="text-foreground/45 font-semibold">Pass</span>
          <span className="font-display font-bold tabular-nums text-foreground">{pass}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#F29400] shadow-[0_0_6px_rgba(242,148,0,0.4)]" />
          <span className="text-foreground/45 font-semibold">Partial</span>
          <span className="font-display font-bold tabular-nums text-foreground">{partial}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#EA0022] shadow-[0_0_6px_rgba(234,0,34,0.4)]" />
          <span className="text-foreground/45 font-semibold">Fail</span>
          <span className="font-display font-bold tabular-nums text-foreground">{fail}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#6B7280] shadow-[0_0_6px_rgba(107,114,128,0.35)]" />
          <span className="text-foreground/45 font-semibold">N/A</span>
          <span className="font-display font-bold tabular-nums text-foreground">{na}</span>
        </div>
      </div>
    </div>
  );
}
