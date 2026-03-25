import { useMemo } from "react";
import type { AnalysisResult, Severity } from "@/lib/analyse-config";
import { SEVERITY_COLORS, SEVERITY_ORDER } from "@/lib/design-tokens";
import { generatePlaybook } from "@/lib/remediation-playbooks";

const HOURS_PER_WEEK = 8;
const MINUTES_PER_WEEK = HOURS_PER_WEEK * 60;

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
    const playbooks: {
      findingId: string;
      title: string;
      severity: Severity;
      estimatedMinutes: number;
    }[] = [];
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
      <div
        className="rounded-xl border border-border/50 bg-card p-5 shadow-card"
        data-tour="remediation-roadmap"
      >
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-2">
          Remediation Roadmap
        </h3>
        <p className="text-sm text-muted-foreground">No findings to remediate</p>
      </div>
    );
  }

  const totalWeekMinutes = totalWeeks * MINUTES_PER_WEEK;

  return (
    <div
      className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] p-5 sm:p-6 shadow-[0_18px_50px_rgba(32,6,247,0.08)] space-y-4"
      data-tour="remediation-roadmap"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2 min-w-[220px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
            Remediation planning
          </div>
          <div>
            <h3 className="text-lg font-display font-black text-foreground tracking-tight">
              Remediation Roadmap
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
              Estimated {totalWeeks} week{totalWeeks !== 1 ? "s" : ""} to resolve all findings based
              on an eight-hour weekly remediation allocation.
            </p>
          </div>
        </div>
        <div className="info-pill text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
            Planned horizon
          </p>
          <p className="text-3xl font-black text-foreground mt-1">{totalWeeks}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            week{totalWeeks !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/70 p-4 sm:p-5 overflow-x-auto">
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
                <div
                  key={item.findingId}
                  className="flex items-center gap-2"
                  style={{ height: 28 }}
                >
                  <div className="relative flex-1 h-7 rounded-xl overflow-hidden bg-muted/30 border border-border/60">
                    <div
                      className="absolute top-1 bottom-1 rounded-lg px-2 flex items-center overflow-hidden shadow-sm"
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
