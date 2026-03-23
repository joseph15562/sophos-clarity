import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import type { AnalysisResult, Severity } from "@/lib/analyse-config";
import { generatePlaybook } from "@/lib/remediation-playbooks";

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#EA0022",
  high: "#F29400",
  medium: "#F8E300",
  low: "#00F2B3",
  info: "#009CFB",
};

const SEVERITY_SCORE: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

const BUBBLE_SIZE: Record<Severity, number> = {
  critical: 12,
  high: 10,
  medium: 8,
  low: 6,
  info: 4,
};

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

interface ScatterPoint {
  findingId: string;
  title: string;
  severity: Severity;
  impact: number;
  effort: number;
  size: number;
  color: string;
}

export function ImpactEffortBubble({ analysisResults }: Props) {
  const { data, midEffort, midImpact } = useMemo(() => {
    const points: ScatterPoint[] = [];
    for (const result of Object.values(analysisResults)) {
      for (const finding of result.findings) {
        const pb = generatePlaybook(finding);
        if (pb) {
          const sev = pb.severity as Severity;
          points.push({
            findingId: pb.findingId,
            title: pb.title,
            severity: sev,
            impact: SEVERITY_SCORE[sev],
            effort: pb.estimatedMinutes,
            size: BUBBLE_SIZE[sev],
            color: SEVERITY_COLORS[sev],
          });
        }
      }
    }

    if (points.length === 0) {
      return { data: [], midEffort: 0, midImpact: 3 };
    }

    const maxEffort = Math.max(...points.map((p) => p.effort), 1);
    const midEffort = maxEffort / 2;
    const midImpact = 3;

    return { data: points, midEffort, midImpact };
  }, [analysisResults]);

  if (data.length === 0) return null;

  const maxEffort = Math.max(...data.map((p) => p.effort), 1);
  const padding = maxEffort * 0.1;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Impact vs Effort</h3>
      <div className="relative" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <defs>
              <linearGradient id="quadQuick" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00F2B3" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#00F2B3" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="quadStrategic" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#F29400" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#F29400" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="quadLow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6B7280" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#6B7280" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="quadReconsider" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#EA0022" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#EA0022" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              type="number"
              dataKey="effort"
              name="Effort"
              unit=" min"
              domain={[0, maxEffort + padding]}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              type="number"
              dataKey="impact"
              name="Impact"
              domain={[0.5, 5.5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => ["", "Info", "Low", "Med", "High", "Crit"][v] ?? ""}
            />
            <ZAxis type="number" dataKey="size" range={[50, 400]} />
            <ReferenceLine x={midEffort} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
            <ReferenceLine y={midImpact} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
            <ReferenceArea
              x1={0}
              x2={midEffort}
              y1={midImpact}
              y2={5.5}
              fill="url(#quadQuick)"
            />
            <ReferenceArea
              x1={midEffort}
              x2={maxEffort + padding}
              y1={midImpact}
              y2={5.5}
              fill="url(#quadStrategic)"
            />
            <ReferenceArea
              x1={0}
              x2={midEffort}
              y1={0.5}
              y2={midImpact}
              fill="url(#quadLow)"
            />
            <ReferenceArea
              x1={midEffort}
              x2={maxEffort + padding}
              y1={0.5}
              y2={midImpact}
              fill="url(#quadReconsider)"
            />
            <Scatter data={data} fillOpacity={0.9}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Scatter>
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as ScatterPoint;
                return (
                  <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold text-foreground">{p.title}</p>
                    <p className="text-muted-foreground mt-0.5">
                      Severity: {p.severity} · ~{p.effort} min
                    </p>
                  </div>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="absolute top-6 left-4 text-[9px] font-medium text-[#00F2B3]">
          Quick Wins
        </div>
        <div className="absolute top-6 right-4 text-[9px] font-medium text-[#F29400]">
          Strategic
        </div>
        <div className="absolute bottom-8 left-4 text-[9px] font-medium text-muted-foreground">
          Low Priority
        </div>
        <div className="absolute bottom-8 right-4 text-[9px] font-medium text-[#EA0022]">
          Reconsider
        </div>
      </div>
    </div>
  );
}
