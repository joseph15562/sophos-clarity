import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Mail, Plus, Trash2, Send, Clock, ToggleLeft, ToggleRight, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScheduledReport {
  id: string;
  org_id: string;
  name: string;
  schedule: "weekly" | "monthly" | "quarterly";
  recipients: string[];
  report_type: "one-pager" | "executive" | "compliance";
  customer_name: string | null;
  include_sections: Record<string, boolean>;
  enabled: boolean;
  last_sent_at: string | null;
  next_due_at: string;
  created_at: string;
}

const SCHEDULE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
] as const;

const REPORT_TYPES = [
  { value: "one-pager", label: "Executive One-Pager", desc: "Fast, no AI" },
  { value: "executive", label: "Executive Summary", desc: "AI-generated" },
  { value: "compliance", label: "Compliance Report", desc: "AI-generated" },
] as const;

const DEFAULT_SECTIONS = {
  scoreOverview: true,
  findingsSummary: true,
  complianceStatus: true,
  remediationPlan: true,
};

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeDate(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

type EmailPreview = { subject: string; markdown: string; html: string; recipients: string[] };

export function ScheduledReportSettings() {
  const { org } = useAuth();
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<EmailPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSchedule, setFormSchedule] = useState<string>("monthly");
  const [formRecipients, setFormRecipients] = useState("");
  const [formReportType, setFormReportType] = useState<string>("one-pager");
  const [formCustomer, setFormCustomer] = useState("");
  const [formSections, setFormSections] = useState(DEFAULT_SECTIONS);

  const loadReports = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    const { data } = await supabase
      .from("scheduled_reports" as string)
      .select("*")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false });
    setReports((data as unknown as ScheduledReport[]) ?? []);
    setLoading(false);
  }, [org]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const resetForm = () => {
    setFormName("");
    setFormSchedule("monthly");
    setFormRecipients("");
    setFormReportType("one-pager");
    setFormCustomer("");
    setFormSections(DEFAULT_SECTIONS);
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!org || !formName.trim() || !formRecipients.trim()) return;

    const recipients = formRecipients
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    if (recipients.length === 0) return;

    const scheduleDays = { weekly: 7, monthly: 30, quarterly: 90 }[formSchedule] ?? 30;
    const nextDue = new Date(Date.now() + scheduleDays * 86_400_000).toISOString();

    const { error } = await supabase.from("scheduled_reports" as string).insert({
      org_id: org.id,
      name: formName.trim(),
      schedule: formSchedule,
      recipients,
      report_type: formReportType,
      customer_name: formCustomer.trim() || null,
      include_sections: formSections,
      enabled: true,
      next_due_at: nextDue,
    });

    if (!error) {
      resetForm();
      loadReports();
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await supabase
      .from("scheduled_reports" as string)
      .update({ enabled: !enabled })
      .eq("id", id);
    loadReports();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("scheduled_reports" as string).delete().eq("id", id);
    loadReports();
  };

  const handleSendNow = async (report: ScheduledReport) => {
    setSending(report.id);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-scheduled-reports`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ report_id: report.id }),
        }
      );
      if (resp.ok) {
        loadReports();
      }
    } finally {
      setSending(null);
    }
  };

  const handlePreview = async (report: ScheduledReport) => {
    setPreviewError(null);
    setPreviewData(null);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-scheduled-reports`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ report_id: report.id, preview: true }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setPreviewError((err as { error?: string }).error ?? `Request failed (${resp.status})`);
        return;
      }
      const data = await resp.json() as EmailPreview;
      setPreviewData(data);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  if (!org) {
    return (
      <p className="text-xs text-muted-foreground">
        Sign in and create an organisation to set up scheduled reports.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Automatically email compliance reports to clients on a schedule.
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#2006F7] text-white hover:bg-[#2006F7]/90 transition-colors"
        >
          <Plus className="h-3 w-3" />
          New Schedule
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                Schedule Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Monthly Report — Acme Corp"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={formCustomer}
                onChange={(e) => setFormCustomer(e.target.value)}
                placeholder="Acme Corp"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1">
              Recipients (comma-separated emails)
            </label>
            <input
              type="text"
              value={formRecipients}
              onChange={(e) => setFormRecipients(e.target.value)}
              placeholder="client@example.com, manager@example.com"
              className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                Frequency
              </label>
              <select
                value={formSchedule}
                onChange={(e) => setFormSchedule(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
              >
                {SCHEDULE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                Report Type
              </label>
              <select
                value={formReportType}
                onChange={(e) => setFormReportType(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} ({t.desc})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1.5">
              Include Sections
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(formSections).map(([key, val]) => (
                <label key={key} className="flex items-center gap-1.5 text-[10px] text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={() =>
                      setFormSections((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
                    }
                    className="rounded border-input"
                  />
                  {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={!formName.trim() || !formRecipients.trim()}
              className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md bg-[#00995a] text-white hover:bg-[#00995a]/90 transition-colors disabled:opacity-50"
            >
              <Calendar className="h-3 w-3" />
              Create Schedule
            </button>
            <button
              onClick={resetForm}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reports list */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-lg" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <Mail className="h-8 w-8 mx-auto text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">
            No scheduled reports yet. Create one to start auto-sending compliance reports.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`rounded-lg border px-3 py-2.5 transition-colors ${
                report.enabled
                  ? "border-border bg-card"
                  : "border-border/50 bg-muted/10 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground truncate">
                      {report.name}
                    </p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {report.schedule}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF] shrink-0">
                      {REPORT_TYPES.find((t) => t.value === report.report_type)?.label ?? report.report_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {report.recipients.length} recipient{report.recipients.length !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Next: {relativeDate(report.next_due_at)}
                    </span>
                    {report.last_sent_at && (
                      <span>Last sent: {formatDate(report.last_sent_at)}</span>
                    )}
                  </div>
                  {report.customer_name && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      Customer: {report.customer_name}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handlePreview(report)}
                    disabled={previewLoading}
                    className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    title="Preview email"
                  >
                    <Eye className={`h-3.5 w-3.5 ${previewLoading ? "animate-pulse" : ""}`} />
                  </button>
                  <button
                    onClick={() => handleSendNow(report)}
                    disabled={sending === report.id}
                    className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    title="Send now"
                  >
                    <Send className={`h-3.5 w-3.5 ${sending === report.id ? "animate-pulse" : ""}`} />
                  </button>
                  <button
                    onClick={() => handleToggle(report.id, report.enabled)}
                    className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    title={report.enabled ? "Disable" : "Enable"}
                  >
                    {report.enabled ? (
                      <ToggleRight className="h-3.5 w-3.5 text-[#00995a]" />
                    ) : (
                      <ToggleLeft className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(report.id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Email preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Email preview
            </DialogTitle>
            <DialogDescription>
              This is how the scheduled report email will look when sent. No email is sent when previewing.
            </DialogDescription>
          </DialogHeader>
          {previewLoading && (
            <div className="flex items-center justify-center py-12">
              <span className="animate-spin h-8 w-8 border-2 border-[#2006F7]/30 border-t-[#2006F7] rounded-full" />
            </div>
          )}
          {previewError && (
            <p className="text-sm text-destructive py-2">{previewError}</p>
          )}
          {!previewLoading && previewData && (
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">To</p>
                <p className="text-xs text-foreground">{previewData.recipients.join(", ")}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Subject</p>
                <p className="text-sm text-foreground font-medium">{previewData.subject}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Body</p>
                <div
                  className="rounded-lg border border-border bg-muted/20 p-4 text-xs prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: previewData.html }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
