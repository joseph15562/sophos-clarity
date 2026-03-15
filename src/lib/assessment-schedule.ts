/**
 * Assessment schedules for tracking when customers are due for reassessment.
 * Client-side scaffold — stored in localStorage until backend infrastructure exists.
 * TODO: Cloud persistence — when authenticated, persist to Supabase. Requires a
 * migration for an `assessment_schedules` table. For now, localStorage only.
 * Pattern: try Supabase first when authenticated, fall back to localStorage for guests.
 */

export interface AssessmentSchedule {
  customerId: string;
  customerName: string;
  frequencyDays: number;
  lastAssessedAt: string | null;
  dueAt: string | null;
}

const STORAGE_KEY = "firecomply_assessment_schedules";

export function saveSchedules(schedules: AssessmentSchedule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  } catch (e) {
    console.warn("[assessment-schedule] saveSchedules failed:", e);
  }
}

export function loadSchedules(): AssessmentSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is AssessmentSchedule =>
        s &&
        typeof s === "object" &&
        typeof s.customerId === "string" &&
        typeof s.customerName === "string" &&
        typeof s.frequencyDays === "number" &&
        (s.lastAssessedAt === null || typeof s.lastAssessedAt === "string") &&
        (s.dueAt === null || typeof s.dueAt === "string")
    );
  } catch {
    return [];
  }
}

export function getOverdueSchedules(schedules: AssessmentSchedule[]): AssessmentSchedule[] {
  const now = new Date().toISOString();
  return schedules.filter((s) => s.dueAt !== null && s.dueAt < now);
}
