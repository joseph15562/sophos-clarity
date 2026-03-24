import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const ASSESSMENT_STORAGE_KEY = "sophos-assessment-schedule";

interface ScheduleEntry {
  hostname: string;
  nextDate: string;
  intervalDays: number;
  lastRun?: string;
}

interface LicenceEvent {
  product: string;
  endDate: string;
  label?: string;
}

interface ParsedFile {
  centralEnrichment?: {
    licences?: Array<{ product: string; endDate: string; type?: string }>;
  };
  label?: string;
}

interface Props {
  files?: ParsedFile[];
}

function parseAssessmentSchedule(): ScheduleEntry[] {
  try {
    const raw = localStorage.getItem(ASSESSMENT_STORAGE_KEY);
    if (!raw) return [];
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

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ComplianceCalendar({ files = [] }: Props) {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const load = () => setSchedules(parseAssessmentSchedule());
    const onStorage = () => load();
    load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const licenceEvents = useMemo<LicenceEvent[]>(() => {
    const out: LicenceEvent[] = [];
    for (const f of files) {
      const licences = f.centralEnrichment?.licences ?? [];
      const label = f.label;
      for (const l of licences) {
        if (l.endDate && !l.endDate.toLowerCase().includes("perpetual")) {
          out.push({
            product: l.product ?? l.type ?? "Licence",
            endDate: l.endDate,
            label,
          });
        }
      }
    }
    return out;
  }, [files]);

  const assessmentEvents = useMemo(() => {
    return schedules.map((s) => ({
      type: "assessment" as const,
      date: s.nextDate,
      label: s.hostname,
      detail: `Assessment due`,
    }));
  }, [schedules]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Array<{ type: string; label: string; detail?: string }>>();

    for (const e of assessmentEvents) {
      const key = e.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push({ type: "assessment", label: e.label, detail: e.detail });
      map.set(key, list);
    }

    for (const l of licenceEvents) {
      const key = l.endDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push({ type: "licence", label: l.product, detail: `Licence expiry${l.label ? ` (${l.label})` : ""}` });
      map.set(key, list);
    }

    return map;
  }, [assessmentEvents, licenceEvents]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1));
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1));

  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 shadow-card space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-brand-accent/10 dark:bg-[#00EDFF]/10">
          <Calendar className="h-5 w-5 text-brand-accent" />
        </div>
        <h3 className="text-base font-display font-bold tracking-tight text-foreground">Compliance Calendar</h3>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground/50 hover:text-foreground transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-display font-semibold text-foreground">
          {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-muted/40 text-muted-foreground/50 hover:text-foreground transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center font-display font-semibold text-muted-foreground/50 uppercase tracking-wider py-1.5">
            {d}
          </div>
        ))}
        {days.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} />;
          const date = new Date(year, month, d);
          const key = toDateKey(date);
          const events = eventsByDate.get(key) ?? [];
          const hasEvents = events.length > 0;
          const isSelected = selectedDate === key;
          const isToday = toDateKey(new Date()) === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(key)}
              className={`min-h-[2.25rem] rounded-lg flex flex-col items-center justify-center text-[11px] font-medium transition-all ${
                isSelected
                  ? "bg-[#2006F7] dark:bg-[#00EDFF] text-white dark:text-[#0a0a14] shadow-sm font-bold"
                  : hasEvents
                    ? "bg-brand-accent/10 dark:bg-[#00EDFF]/10 text-foreground hover:bg-brand-accent/20 dark:hover:bg-[#00EDFF]/20"
                    : isToday
                      ? "ring-1 ring-[#2006F7]/30 dark:ring-[#00EDFF]/30 text-foreground font-semibold"
                      : "text-foreground/70 hover:bg-muted/30"
              }`}
            >
              <span>{d}</span>
              {hasEvents && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? "bg-white dark:bg-[#0a0a14]" : "bg-[#2006F7] dark:bg-[#00EDFF]"}`} />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="pt-4 border-t border-border/40 space-y-2">
          <h4 className="text-[12px] font-display font-semibold tracking-tight text-foreground">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" })}
          </h4>
          {selectedEvents.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50">No events on this day</p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((e, i) => (
                <li key={i} className="flex items-center gap-2.5 text-[11px] rounded-lg bg-muted/10 dark:bg-muted/5 border border-border/30 px-3 py-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${
                      e.type === "assessment" ? "bg-[#F29400] shadow-[0_0_6px_rgba(242,148,0,0.4)]" : "bg-[#00F2B3] shadow-[0_0_6px_rgba(0,242,179,0.4)]"
                    }`}
                  />
                  <span className="font-display font-semibold text-foreground">{e.label}</span>
                  {e.detail && <span className="text-muted-foreground/60">— {e.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
