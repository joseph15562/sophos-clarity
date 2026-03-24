import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
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
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">
        Score Distribution
      </h3>

      {isSingle && (
        <p className="text-[10px] text-muted-foreground mb-3">
          Upload multiple configs to see fleet distribution
        </p>
      )}

      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 24, left: 24 }}
          >
            <XAxis
              dataKey="range"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              dataKey="count"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-md border border-border/70 bg-card px-2 py-1.5 text-xs shadow-elevated">
                    <span className="font-medium">{d.range}</span>: {d.count}{" "}
                    firewall{d.count !== 1 ? "s" : ""}
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
