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
    load();
    window.addEventListener("storage", () => load());
    return () => window.removeEventListener("storage", load);
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
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
        <Calendar className="h-4 w-4" />
        Compliance Calendar
      </h3>

      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-foreground">
          {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-[10px] mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center font-medium text-muted-foreground py-1">
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
              className={`min-h-[2rem] rounded flex flex-col items-center justify-center ${
                isSelected
                  ? "bg-[#2006F7] dark:bg-[#00EDFF] text-white"
                  : hasEvents
                    ? "bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 text-foreground"
                    : isToday
                      ? "ring-1 ring-border text-foreground"
                      : "text-foreground hover:bg-muted/50"
              }`}
            >
              <span>{d}</span>
              {hasEvents && (
                <span className="w-1 h-1 rounded-full bg-current opacity-70 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-xs font-semibold text-foreground mb-2">
            {new Date(selectedDate).toLocaleDateString(undefined, { weekday: "long", dateStyle: "medium" })}
          </h4>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events on this day</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedEvents.map((e, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      e.type === "assessment" ? "bg-[#F29400]" : "bg-[#00995a] dark:bg-[#00F2B3]"
                    }`}
                  />
                  <span className="font-medium text-foreground">{e.label}</span>
                  {e.detail && <span className="text-muted-foreground">— {e.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
