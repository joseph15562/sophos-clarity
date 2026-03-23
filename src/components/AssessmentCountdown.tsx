import { useState, useEffect } from "react";
import { Calendar, Clock, AlertCircle, CheckCircle } from "lucide-react";

const STORAGE_KEY = "sophos-assessment-schedule";

interface ScheduleEntry {
  hostname: string;
  nextDate: string;
  intervalDays: number;
  lastRun?: string;
}

function parseSchedule(raw: string | null): ScheduleEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is ScheduleEntry =>
        s &&
        typeof s === "object" &&
        typeof s.hostname === "string" &&
        typeof s.nextDate === "string" &&
        typeof s.intervalDays === "number"
    );
  } catch {
    return [];
  }
}

function daysUntil(dateStr: string): number {
  const next = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  next.setHours(0, 0, 0, 0);
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatLastRun(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { dateStyle: "short" });
  } catch {
    return dateStr;
  }
}

export function AssessmentCountdown() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);

  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem(STORAGE_KEY);
      setSchedules(parseSchedule(raw));
    };
    load();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const display = schedules.slice(0, 10);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
        <Calendar className="h-4 w-4" aria-hidden />
        Assessment Schedule
      </h3>

      {display.length === 0 ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          No assessments scheduled. Set up automated assessment schedules in Settings.
        </p>
      ) : (
        <div className="space-y-2">
          {display.map((entry) => {
            const days = daysUntil(entry.nextDate);
            const overdue = days < 0;
            const isGreen = days > 7;
            const isAmber = days >= 3 && days <= 7;
            const isRed = days < 3 || overdue;

            let Icon = CheckCircle;
            let statusClass = "text-[#00F2B3] dark:text-[#00F2B3]";
            if (isRed) {
              Icon = AlertCircle;
              statusClass = "text-[#EA0022]";
            } else if (isAmber) {
              Icon = Clock;
              statusClass = "text-[#F29400]";
            }

            const statusText = overdue
              ? `Overdue by ${Math.abs(days)} days`
              : `${days} days`;

            return (
              <div
                key={`${entry.hostname}-${entry.nextDate}`}
                className="flex flex-col gap-0.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">
                    {entry.hostname}
                  </span>
                  <span
                    className={`flex items-center gap-1 shrink-0 text-xs font-medium ${statusClass}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {statusText}
                  </span>
                </div>
                {entry.lastRun && (
                  <span className="text-[10px] text-muted-foreground">
                    Last run: {formatLastRun(entry.lastRun)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
