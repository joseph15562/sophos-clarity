import { useMemo } from "react";
import type { AnalysisResult, Severity } from "@/lib/analyse-config";
import { generatePlaybook } from "@/lib/remediation-playbooks";

const HOURS_PER_WEEK = 8;
const MINUTES_PER_WEEK = HOURS_PER_WEEK * 60;

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#EA0022",
  high: "#F29400",
  medium: "#F8E300",
  low: "#00995a",
  info: "#009CFB",
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

interface RoadmapItem {
  findingId: string;
  title: string;
  severity: Severity;
  estimatedMinutes: number;
  weekIndex: number;
  offsetMinutes: number;
}

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

export function RemediationRoadmap({ analysisResults }: Props) {
  const { items, weeks, totalWeeks } = useMemo(() => {
    const playbooks: { findingId: string; title: string; severity: Severity; estimatedMinutes: number }[] = [];
    for (const result of Object.values(analysisResults)) {
      for (const finding of result.findings) {
        const pb = generatePlaybook(finding);
        if (pb) {
          playbooks.push({
            findingId: pb.findingId,
            title: pb.title,
            severity: pb.severity as Severity,
            estimatedMinutes: pb.estimatedMinutes,
          });
        }
      }
    }
    playbooks.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    if (playbooks.length === 0) {
      return { items: [] as RoadmapItem[], weeks: [] as string[], totalWeeks: 0 };
    }

    const items: RoadmapItem[] = [];
    let weekIndex = 0;
    let offsetMinutes = 0;
    let maxEndMinutes = 0;

    for (const pb of playbooks) {
      const startWeek = weekIndex;
      const startOffset = offsetMinutes;
      const startMinutes = weekIndex * MINUTES_PER_WEEK + offsetMinutes;
      const endMinutes = startMinutes + pb.estimatedMinutes;
      maxEndMinutes = Math.max(maxEndMinutes, endMinutes);

      weekIndex = Math.floor(endMinutes / MINUTES_PER_WEEK);
      offsetMinutes = endMinutes % MINUTES_PER_WEEK;

      items.push({
        ...pb,
        weekIndex: startWeek,
        offsetMinutes: startOffset,
      });
    }

    const totalWeeks = Math.max(Math.ceil(maxEndMinutes / MINUTES_PER_WEEK), 1);
    const weeks: string[] = [];
    for (let i = 0; i < totalWeeks; i++) {
      weeks.push(`Week ${i + 1}`);
    }

    return { items, weeks, totalWeeks };
  }, [analysisResults]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">Remediation Roadmap</h3>
        <p className="text-sm text-muted-foreground">No findings to remediate</p>
      </div>
    );
  }

  const totalWeekMinutes = totalWeeks * MINUTES_PER_WEEK;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Remediation Roadmap</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Estimated {totalWeeks} week{totalWeeks !== 1 ? "s" : ""} to resolve all findings
      </p>

      <div className="overflow-x-auto">
        <div className="min-w-[400px]">
          <div className="flex gap-1 mb-2">
            {weeks.map((label, i) => (
              <div
                key={i}
                className="flex-1 min-w-[80px] text-center text-[10px] font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {items.map((item) => {
              const startMinutes = item.weekIndex * MINUTES_PER_WEEK + item.offsetMinutes;
              const leftPct = (startMinutes / totalWeekMinutes) * 100;
              const widthPct = (item.estimatedMinutes / totalWeekMinutes) * 100;

              return (
                <div key={item.findingId} className="flex items-center gap-2" style={{ height: 24 }}>
                  <div className="relative flex-1 h-6 rounded overflow-hidden bg-muted/30">
                    <div
                      className="absolute top-1 bottom-1 rounded px-2 flex items-center overflow-hidden"
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.max(widthPct, 2)}%`,
                        backgroundColor: SEVERITY_COLORS[item.severity],
                        minWidth: 4,
                      }}
                    >
                      <span
                        className="text-[10px] font-medium text-white truncate"
                        style={{ textShadow: "0 0 1px rgba(0,0,0,0.5)" }}
                      >
                        {item.title}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
