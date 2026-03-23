import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { AnalysisResult, Severity } from "@/lib/analyse-config";
import { generatePlaybook } from "@/lib/remediation-playbooks";

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#EA0022",
  high: "#F29400",
  medium: "#F8E300",
  low: "#00F2B3",
  info: "#009CFB",
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

export function FixEffortBreakdown({ analysisResults }: Props) {
  const { data, totalHours, breakdown } = useMemo(() => {
    const bySeverity: Record<Severity, { count: number; minutes: number }> = {
      critical: { count: 0, minutes: 0 },
      high: { count: 0, minutes: 0 },
      medium: { count: 0, minutes: 0 },
      low: { count: 0, minutes: 0 },
      info: { count: 0, minutes: 0 },
    };

    for (const result of Object.values(analysisResults)) {
      for (const finding of result.findings) {
        const pb = generatePlaybook(finding);
        if (pb) {
          const sev = pb.severity as Severity;
          bySeverity[sev].count++;
          bySeverity[sev].minutes += pb.estimatedMinutes;
        }
      }
    }

    const data = SEVERITY_ORDER.filter((sev) => bySeverity[sev].minutes > 0).map((sev) => ({
      name: sev.charAt(0).toUpperCase() + sev.slice(1),
      value: bySeverity[sev].minutes,
      color: SEVERITY_COLORS[sev],
    }));

    const totalMinutes = Object.values(bySeverity).reduce((s, x) => s + x.minutes, 0);
    const totalHours = Math.round(totalMinutes / 60);
    const breakdown = SEVERITY_ORDER.filter((sev) => bySeverity[sev].count > 0).map((sev) => ({
      severity: sev,
      count: bySeverity[sev].count,
      minutes: bySeverity[sev].minutes,
      hours: Math.round((bySeverity[sev].minutes / 60) * 10) / 10,
    }));

    return { data, totalHours, breakdown };
  }, [analysisResults]);

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Fix Effort Breakdown</h3>
      <div className="relative" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
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
            <span className="text-2xl font-bold text-foreground tabular-nums">{totalHours}</span>
            <span className="block text-xs text-muted-foreground">hours</span>
          </div>
        </div>
      </div>
      <table className="w-full mt-4 text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-2 font-medium">Severity</th>
            <th className="text-right py-2 font-medium">Count</th>
            <th className="text-right py-2 font-medium">Minutes</th>
            <th className="text-right py-2 font-medium">Hours</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((row) => (
            <tr key={row.severity} className="border-b border-border/50">
              <td className="py-1.5 flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: SEVERITY_COLORS[row.severity] }}
                />
                {row.severity.charAt(0).toUpperCase() + row.severity.slice(1)}
              </td>
              <td className="text-right py-1.5 tabular-nums">{row.count}</td>
              <td className="text-right py-1.5 tabular-nums">{row.minutes}</td>
              <td className="text-right py-1.5 tabular-nums">{row.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
