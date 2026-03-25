import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

const BINS = [
  { range: "0-20", min: 0, max: 20, color: "#EA0022" },
  { range: "21-40", min: 21, max: 40, color: "#EA6A00" },
  { range: "41-60", min: 41, max: 60, color: "#F29400" },
  { range: "61-80", min: 61, max: 80, color: "#F8E300" },
  { range: "81-100", min: 81, max: 100, color: "#00F2B3" },
];

export function RiskDistribution({ analysisResults }: Props) {
  const { chartData, isSingle } = useMemo(() => {
    const entries = Object.values(analysisResults);
    const scores = entries.map((ar) => computeRiskScore(ar).overall);

    const counts = BINS.map((b) => ({ ...b, count: 0 }));
    for (const s of scores) {
      const bin = BINS.find((b) => s >= b.min && s <= b.max);
      if (bin) {
        const idx = BINS.indexOf(bin);
        counts[idx].count++;
      }
    }

    const chartData = counts.map((b) => ({
      range: b.range,
      count: b.count,
      color: b.color,
    }));

    return {
      chartData,
      isSingle: entries.length === 1,
    };
  }, [analysisResults]);

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(242,148,0,0.05), rgba(0,242,179,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(242,148,0,0.18), rgba(0,242,179,0.1), transparent)",
        }}
      />
      <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-4">
        Score Distribution
      </h3>

      {isSingle && (
        <p className="text-[11px] text-foreground/45 mb-4 font-medium">
          Upload multiple configs to see fleet distribution
        </p>
      )}

      <div
        className="rounded-xl p-2"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 28, left: 28 }}>
              <XAxis
                dataKey="range"
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                tickLine={{ stroke: "rgba(255,255,255,0.08)" }}
              />
              <YAxis
                dataKey="count"
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.45)" }}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                tickLine={{ stroke: "rgba(255,255,255,0.08)" }}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div
                      className="rounded-xl px-3 py-2 text-xs font-medium"
                      style={{
                        background:
                          "linear-gradient(145deg, rgba(14,18,34,0.95), rgba(10,14,28,0.98))",
                        border: "1px solid rgba(255,255,255,0.1)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                        backdropFilter: "blur(16px)",
                      }}
                    >
                      <span className="font-bold">{d.range}</span>: {d.count} firewall
                      {d.count !== 1 ? "s" : ""}
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
