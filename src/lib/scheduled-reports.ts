import { supabase } from "@/integrations/supabase/client";

export interface ScheduledReport {
  id: string;
  org_id: string;
  name: string;
  schedule: "weekly" | "monthly";
  recipients: string[];
  report_type: "executive" | "compliance" | "individual";
  enabled: boolean;
  last_sent_at: string | null;
  created_at: string;
}

// TODO: Requires a scheduled_reports table migration and a pg_cron + Edge Function for email delivery
// For now, these use localStorage as a placeholder

const STORAGE_KEY = "sophos-scheduled-reports";

export function loadScheduledReports(): ScheduledReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveScheduledReport(report: Omit<ScheduledReport, "id" | "created_at" | "last_sent_at">): ScheduledReport {
  const reports = loadScheduledReports();
  const newReport: ScheduledReport = {
    ...report,
    id: crypto.randomUUID(),
    last_sent_at: null,
    created_at: new Date().toISOString(),
  };
  reports.push(newReport);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  return newReport;
}

export function deleteScheduledReport(id: string): void {
  const reports = loadScheduledReports().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function toggleScheduledReport(id: string): void {
  const reports = loadScheduledReports();
  const idx = reports.findIndex(r => r.id === id);
  if (idx >= 0) reports[idx].enabled = !reports[idx].enabled;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}
