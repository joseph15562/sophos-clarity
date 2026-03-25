import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { generatePlaybook } from "@/lib/remediation-playbooks";
import type { AnalysisResult, Severity } from "@/lib/analyse-config";

const SEVERITY_RISK_MIDPOINT: Record<Severity, number> = {
  critical: 27_500,
  high: 10_000,
  medium: 3_000,
  low: 600,
  info: 0,
};

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

export function SecurityRoiCalculator({ analysisResults }: Props) {
  const [hourlyRate, setHourlyRate] = useState(100);
  const [breachCost, setBreachCost] = useState(50_000);

  const { totalHours, totalCost, riskReduction, roi, chartData } = useMemo(() => {
    let totalMinutes = 0;
    let riskReductionValue = 0;
    for (const result of Object.values(analysisResults)) {
      for (const finding of result.findings) {
        const pb = generatePlaybook(finding);
        if (pb) totalMinutes += pb.estimatedMinutes;
        riskReductionValue += SEVERITY_RISK_MIDPOINT[finding.severity] ?? 0;
      }
    }
    const hours = totalMinutes / 60;
    const investment = hours * hourlyRate;
    const roiMultiplier = investment > 0 ? riskReductionValue / investment : 0;
    return {
      totalHours: Math.round(hours * 10) / 10,
      totalCost: Math.round(investment),
      riskReduction: Math.round(riskReductionValue),
      roi: roiMultiplier,
      chartData: [
        { name: "Investment", value: investment, fill: "#F29400" },
        { name: "Risk Reduction", value: riskReductionValue, fill: "#00F2B3" },
      ],
    };
  }, [analysisResults, hourlyRate]);

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
        Security Investment ROI
      </h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Hourly rate ($)
          </label>
          <input
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
            min={0}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Potential breach cost ($)
          </label>
          <input
            type="number"
            value={breachCost}
            onChange={(e) => setBreachCost(Number(e.target.value) || 0)}
            min={0}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">Total Hours</p>
          <p className="font-semibold">{totalHours}</p>
        </div>
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">Investment</p>
          <p className="font-semibold">${totalCost.toLocaleString()}</p>
        </div>
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">Risk Reduction</p>
          <p className="font-semibold text-green-600 dark:text-green-400">
            ${riskReduction.toLocaleString()}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">ROI</p>
          <p
            className={`font-semibold ${
              roi >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {roi > 0 ? `${roi.toFixed(1)}x` : "—"}
          </p>
        </div>
      </div>
      <div className="mt-4" style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" width={100} />
            <Bar dataKey="value" radius={4}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
