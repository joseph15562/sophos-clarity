import { useEffect, useState, useMemo, useCallback } from "react";
import { Calendar, AlertCircle, Clock } from "lucide-react";
import { loadHistory } from "@/lib/assessment-history";
import { loadHistoryCloud } from "@/lib/assessment-cloud";
import {
  loadSchedules,
  saveSchedules,
  getOverdueSchedules,
  type AssessmentSchedule,
} from "@/lib/assessment-schedule";
import { useAuth } from "@/hooks/use-auth";

const FREQUENCY_OPTIONS = [30, 60, 90] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysSince(date: string | null): number | null {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function addDays(iso: string | null, days: number): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function AssessmentScheduler() {
  const { isGuest, org } = useAuth();
  const useCloud = !isGuest && !!org;

  const [schedules, setSchedules] = useState<AssessmentSchedule[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [customersFromHistory, setCustomersFromHistory] = useState<
    { customerId: string; customerName: string; lastAssessedAt: string }[]
  >([]);

  useEffect(() => {
    setSchedules(loadSchedules());
  }, []);

  useEffect(() => {
    (useCloud ? loadHistoryCloud() : loadHistory()).then((snaps) => {
      const byCustomer = new Map<
        string,
        { customerName: string; lastAssessedAt: string }
      >();
      for (const snap of snaps) {
        const key = `${snap.customerName}||${snap.environment}`;
        const existing = byCustomer.get(key);
        const iso = new Date(snap.timestamp).toISOString();
        if (
          !existing ||
          new Date(iso) > new Date(existing.lastAssessedAt)
        ) {
          byCustomer.set(key, {
            customerName: snap.customerName,
            lastAssessedAt: iso,
          });
        }
      }
      setCustomersFromHistory(
        [...byCustomer.entries()].map(([customerId, { customerName, lastAssessedAt }]) => ({
          customerId,
          customerName,
          lastAssessedAt,
        }))
      );
      setHistoryLoaded(true);
    });
  }, [useCloud]);

  const mergedSchedules = useMemo(() => {
    const byId = new Map<string, AssessmentSchedule>();
    for (const s of schedules) {
      byId.set(s.customerId, { ...s });
    }
    for (const c of customersFromHistory) {
      const existing = byId.get(c.customerId);
      if (existing) {
        existing.lastAssessedAt = c.lastAssessedAt;
        existing.dueAt = addDays(
          c.lastAssessedAt,
          existing.frequencyDays
        );
      } else {
        const dueAt = addDays(c.lastAssessedAt, 60);
        byId.set(c.customerId, {
          customerId: c.customerId,
          customerName: c.customerName,
          frequencyDays: 60,
          lastAssessedAt: c.lastAssessedAt,
          dueAt,
        });
      }
    }
    return [...byId.values()];
  }, [schedules, customersFromHistory]);

  const overdue = useMemo(
    () => getOverdueSchedules(mergedSchedules),
    [mergedSchedules]
  );

  const updateFrequency = useCallback(
    (customerId: string, frequencyDays: number) => {
      const entry = mergedSchedules.find((s) => s.customerId === customerId);
      if (!entry) return;
      const updated: AssessmentSchedule = {
        ...entry,
        frequencyDays,
        dueAt: addDays(entry.lastAssessedAt, frequencyDays),
      };
      const next = schedules.some((s) => s.customerId === customerId)
        ? schedules.map((s) => (s.customerId === customerId ? updated : s))
        : [...schedules, updated];
      setSchedules(next);
      saveSchedules(next);
    },
    [mergedSchedules, schedules]
  );

  if (!historyLoaded) return null;

  if (mergedSchedules.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-2">
          <Calendar className="h-3.5 w-3.5 text-[#2006F7]" />
          Scheduled Assessments
        </div>
        <p className="text-[11px] text-muted-foreground">
          Save an assessment to see customers here and set reassessment frequency.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-border bg-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Calendar className="h-3.5 w-3.5 text-[#2006F7]" />
          Scheduled Assessments
        </div>
        {overdue.length > 0 && (
          <span className="text-[10px] font-medium text-[#EA0022] bg-[#EA0022]/10 px-2 py-0.5 rounded">
            {overdue.length} overdue
          </span>
        )}
      </div>

      <div className="space-y-2">
        {mergedSchedules.map((s) => {
          const isOverdue = s.dueAt !== null && s.dueAt < new Date().toISOString();
          const daysOverdue = isOverdue && s.lastAssessedAt
            ? daysSince(s.lastAssessedAt)! - s.frequencyDays
            : 0;

          return (
            <div
              key={s.customerId}
              className={`rounded-lg border px-3 py-2.5 ${
                isOverdue
                  ? "border-[#EA0022]/40 bg-[#EA0022]/5"
                  : "border-border bg-muted/20"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">
                    {s.customerName}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5 shrink-0" />
                    Last: {formatDate(s.lastAssessedAt)}
                  </div>
                  {isOverdue && s.lastAssessedAt && (
                    <p className="flex items-center gap-1 mt-1 text-[10px] font-medium text-[#EA0022]">
                      <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                      It&apos;s been {daysSince(s.lastAssessedAt)} days since last
                      assessment
                      {daysOverdue > 0 && ` (${daysOverdue} days overdue)`}
                    </p>
                  )}
                  {!isOverdue && s.dueAt && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Due: {formatDate(s.dueAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {FREQUENCY_OPTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => updateFrequency(s.customerId, d)}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                        s.frequencyDays === d
                          ? "bg-[#2006F7] text-white dark:bg-[#6B5BFF]"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
