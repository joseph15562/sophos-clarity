import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  loadSavedReportsCloud,
  describeSavedReportRowType,
  formatFirewallSummaryFromPackage,
} from "@/lib/saved-reports";
import { loadScheduledReports as loadScheduledReportsFromStorage } from "@/lib/scheduled-reports";
import { Button } from "@/components/ui/button";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import {
  FileText,
  Plus,
  ArrowLeft,
  Download,
  Send,
  Eye,
  Clock,
  Calendar,
  LayoutDashboard,
  ClipboardCheck,
  TrendingUp,
  Shield,
  Mail,
  ToggleLeft,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Trash2,
} from "lucide-react";
import { deleteSavedReportCloud } from "@/lib/saved-reports";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

const PLACEHOLDER_NAMES = /^\s*(\(this tenant\)|unnamed|unknown|customer)\s*$/i;

/* ── Demo Data ── */

const DEMO_REPORTS = [
  {
    id: "r1",
    customer: "Acme Corp",
    type: "Board Summary",
    firewalls: "fw-london-01",
    date: "2026-03-25",
    format: "PDF" as const,
    status: "Final" as const,
  },
  {
    id: "r2",
    customer: "Globex Industries",
    type: "Technical Assessment",
    firewalls: "3 firewalls",
    date: "2026-03-24",
    format: "DOCX" as const,
    status: "Sent" as const,
  },
  {
    id: "r3",
    customer: "Initech",
    type: "Compliance Evidence Pack",
    firewalls: "edge-fw01",
    date: "2026-03-22",
    format: "PDF" as const,
    status: "Draft" as const,
  },
  {
    id: "r4",
    customer: "Soylent Corp",
    type: "Quarterly Business Review",
    firewalls: "2 firewalls",
    date: "2026-03-20",
    format: "PDF" as const,
    status: "Final" as const,
  },
  {
    id: "r5",
    customer: "Umbrella Corp",
    type: "Insurance Submission",
    firewalls: "hq-gw.soylent.local",
    date: "2026-03-18",
    format: "PDF" as const,
    status: "Sent" as const,
  },
  {
    id: "r6",
    customer: "Wayne Enterprises",
    type: "Board Summary",
    firewalls: "—",
    date: "2026-03-15",
    format: "DOCX" as const,
    status: "Draft" as const,
  },
  {
    id: "r7",
    customer: "Stark Industries",
    type: "Technical Assessment",
    firewalls: "malibu-core, ny-dr",
    date: "2026-03-12",
    format: "PDF" as const,
    status: "Final" as const,
  },
  {
    id: "r8",
    customer: "Cyberdyne Systems",
    type: "Insurance Submission",
    firewalls: "skynet-edge",
    date: "2026-03-10",
    format: "DOCX" as const,
    status: "Sent" as const,
  },
];

type ReportCentreSchedule = {
  id: string;
  customer: string;
  template: string;
  frequency: "Weekly" | "Monthly" | "Quarterly";
  nextRun: string;
  active: boolean;
};

const DEMO_SCHEDULES: ReportCentreSchedule[] = [
  {
    id: "s1",
    customer: "Acme Corp",
    template: "Board Summary",
    frequency: "Monthly",
    nextRun: "2026-04-01",
    active: true,
  },
  {
    id: "s2",
    customer: "Globex Industries",
    template: "Technical Assessment",
    frequency: "Quarterly",
    nextRun: "2026-06-01",
    active: true,
  },
  {
    id: "s3",
    customer: "Initech",
    template: "Compliance Evidence Pack",
    frequency: "Monthly",
    nextRun: "2026-04-15",
    active: false,
  },
];

const TEMPLATES = [
  {
    slug: "board-summary",
    title: "Board Summary",
    desc: "2-page executive overview with key metrics and strategic recommendations.",
    pages: 2,
    icon: LayoutDashboard,
    accent: "from-[#2006F7]/20 to-[#2006F7]/5",
    border: "border-[#2006F7]/20",
    tag: "bg-[#2006F7]/10 text-[#2006F7]",
  },
  {
    slug: "technical",
    title: "Technical Assessment",
    desc: "Full findings with rule-by-rule analysis and remediation steps.",
    pages: 12,
    icon: FileText,
    accent: "from-[#00EDFF]/20 to-[#00EDFF]/5",
    border: "border-[#00EDFF]/20",
    tag: "bg-[#00EDFF]/10 text-[#0077A8] dark:text-[#00EDFF]",
  },
  {
    slug: "compliance",
    title: "Compliance Evidence Pack",
    desc: "Per-framework evidence pack mapped to controls (CIS, NIST, ISO).",
    pages: 18,
    icon: ClipboardCheck,
    accent: "from-[#00F2B3]/20 to-[#00F2B3]/5",
    border: "border-[#00F2B3]/20",
    tag: "bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]",
  },
  {
    slug: "qbr",
    title: "Quarterly Business Review",
    desc: "Trend analysis, score deltas, and ROI metrics for stakeholders.",
    pages: 8,
    icon: TrendingUp,
    accent: "from-[#F29400]/20 to-[#F29400]/5",
    border: "border-[#F29400]/20",
    tag: "bg-[#F29400]/10 text-[#F29400]",
  },
  {
    slug: "insurance",
    title: "Insurance Submission",
    desc: "Risk summary and posture attestation for cyber-insurance carriers.",
    pages: 4,
    icon: Shield,
    accent: "from-[#EA0022]/20 to-[#EA0022]/5",
    border: "border-[#EA0022]/20",
    tag: "bg-[#EA0022]/10 text-[#EA0022]",
  },
] as const;

const STATUS_STYLE: Record<string, string> = {
  Draft: "bg-[#F29400]/10 text-[#F29400] border-[#F29400]/20",
  Final: "bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3] border-[#00F2B3]/20",
  Sent: "bg-[#2006F7]/10 text-[#2006F7] border-[#2006F7]/20",
};

const FORMAT_STYLE: Record<string, string> = {
  PDF: "bg-[#EA0022]/10 text-[#EA0022] border-[#EA0022]/20",
  DOCX: "bg-[#00EDFF]/10 text-[#0077A8] dark:text-[#00EDFF] border-[#00EDFF]/20",
};

/** Real saved rows use Postgres UUIDs; demo sample rows use ids like `r1`. */
const SAVED_REPORT_ROW_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ── Component ── */

function ReportCentreInner() {
  const { user, org } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState(DEMO_REPORTS);
  const [schedules, setSchedules] = useState<ReportCentreSchedule[]>(DEMO_SCHEDULES);

  useEffect(() => {
    if (!org?.id) {
      setReports(DEMO_REPORTS);
      setSchedules(DEMO_SCHEDULES);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [savedReports, storedSchedules] = await Promise.all([
          loadSavedReportsCloud(),
          Promise.resolve(loadScheduledReportsFromStorage()),
        ]);
        if (cancelled) return;

        if (savedReports.length > 0) {
          const orgName = org.name || "My Organisation";
          const mapped = savedReports.map((r, i) => ({
            id: r.id || `r${i}`,
            customer:
              !r.customerName || PLACEHOLDER_NAMES.test(r.customerName) ? orgName : r.customerName,
            type: describeSavedReportRowType(r),
            firewalls: formatFirewallSummaryFromPackage(r),
            date: new Date(r.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            format: "PDF" as const,
            status: "Final" as const,
          }));
          setReports(mapped);
        } else {
          setReports([]);
        }

        if (storedSchedules.length > 0) {
          const mappedSchedules: ReportCentreSchedule[] = storedSchedules.map((s) => {
            const sched = s.schedule as "weekly" | "monthly" | "quarterly";
            const frequency: ReportCentreSchedule["frequency"] =
              sched === "weekly" ? "Weekly" : sched === "quarterly" ? "Quarterly" : "Monthly";
            return {
              id: s.id,
              customer: s.name,
              template:
                s.report_type === "executive"
                  ? "Board Summary"
                  : s.report_type === "compliance"
                    ? "Compliance Evidence Pack"
                    : "Technical Assessment",
              frequency,
              nextRun: s.last_sent_at
                ? new Date(
                    new Date(s.last_sent_at).getTime() +
                      (sched === "weekly" ? 7 : sched === "quarterly" ? 90 : 30) * 86_400_000,
                  ).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                : "Pending",
              active: s.enabled,
            };
          });
          setSchedules(mappedSchedules);
        } else {
          setSchedules([]);
        }
      } catch (err) {
        console.warn("[ReportCentre] load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id, org?.name]);

  const totalReports = reports.length;
  const thisMonth = reports.filter((r) => r.date >= "2026-03-01").length;
  const scheduledCount = schedules.filter((s) => s.active).length;
  const deliveryRate =
    totalReports > 0
      ? Math.round((reports.filter((r) => r.status === "Sent").length / totalReports) * 100)
      : 0;

  function toggleSchedule(id: string) {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  }

  const hasReports = reports.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-gradient-to-r from-[#001A47] to-[#00102e] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 h-14">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <span className="text-white/20">/</span>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <FileSpreadsheet className="h-4.5 w-4.5 text-[#00EDFF]" />
              Report Centre
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Generate Report
            </Button>
          </div>
        </div>
      </header>

      <WorkspacePrimaryNav />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-[#00EDFF]" />
        </div>
      )}

      <main className={`mx-auto max-w-7xl px-6 py-8 space-y-8 ${loading ? "hidden" : ""}`}>
        {/* ── Stats Strip ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Reports", value: totalReports, icon: FileText, colour: "#2006F7" },
            { label: "This Month", value: thisMonth, icon: Calendar, colour: "#00EDFF" },
            { label: "Scheduled", value: scheduledCount, icon: Clock, colour: "#00F2B3" },
            { label: "Delivery Rate", value: `${deliveryRate}%`, icon: Mail, colour: "#F29400" },
          ].map((s) => (
            <div
              key={s.label}
              className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-md p-4 shadow-sm"
            >
              <div
                className="absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-10"
                style={{ background: s.colour }}
              />
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${s.colour}15` }}
                >
                  <s.icon className="h-4 w-4" style={{ color: s.colour }} />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold tracking-tight">{s.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Template Gallery ── */}
        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-tight">Report Templates</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {TEMPLATES.map((t) => (
              <div
                key={t.title}
                className={`group relative min-w-[220px] max-w-[240px] shrink-0 snap-start rounded-2xl border ${t.border} bg-gradient-to-br ${t.accent} backdrop-blur-md p-5 transition-all hover:shadow-lg hover:scale-[1.02]`}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-card/80 border border-white/[0.06]">
                  <t.icon className="h-5 w-5 text-foreground/80" />
                </div>
                <h3 className="text-sm font-bold">{t.title}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  {t.desc}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${t.tag}`}
                  >
                    ~{t.pages} pages
                  </span>
                  <Link to={`/?reportTemplate=${encodeURIComponent(t.slug)}`}>
                    <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[11px]">
                      Use Template
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Recent Reports ── */}
        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-tight">Recent Reports</h2>

          {!hasReports ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-card/30 backdrop-blur-md">
              <EmptyState
                className="py-12"
                icon={<FileText className="h-6 w-6 text-muted-foreground/50" />}
                title="No reports generated yet"
                description="Run an assessment and generate your first report."
                action={
                  <Button asChild size="sm" className="rounded-lg">
                    <Link to="/">Go to workspace</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header row */}
              <div className="hidden lg:grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.35fr)_minmax(0,1fr)_0.75fr_0.55fr_0.55fr_auto] gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                <span>Customer</span>
                <span>Contents</span>
                <span>Firewalls</span>
                <span>Date</span>
                <span>Format</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>

              {reports.map((r) => (
                <div
                  key={r.id}
                  className="group grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.35fr)_minmax(0,1fr)_0.75fr_0.55fr_0.55fr_auto] gap-2 lg:gap-3 items-center rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-md px-4 py-3 transition-colors hover:bg-card/70"
                >
                  <span className="text-sm font-medium">{r.customer}</span>
                  <span className="text-xs text-muted-foreground line-clamp-2" title={r.type}>
                    <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mr-1">
                      Contents{" "}
                    </span>
                    {r.type}
                  </span>
                  <span
                    className="text-xs text-muted-foreground line-clamp-2 min-w-0"
                    title={r.firewalls}
                  >
                    <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mr-1">
                      Firewalls{" "}
                    </span>
                    {r.firewalls}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.date}</span>
                  <span>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${FORMAT_STYLE[r.format]}`}
                    >
                      {r.format}
                    </span>
                  </span>
                  <span>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </span>
                  <div className="flex items-center justify-end gap-1">
                    {SAVED_REPORT_ROW_ID_RE.test(r.id) ? (
                      <>
                        <Link to={`/reports/saved/${r.id}`} target="_blank" rel="noreferrer">
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                            title="View saved report (opens in new tab)"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </Link>
                        <Link to={`/reports/saved/${r.id}`} target="_blank" rel="noreferrer">
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                            title="Open for export (Word/PDF on the next page)"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </Link>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled
                          className="rounded-lg p-1.5 text-muted-foreground/40 cursor-not-allowed"
                          title="Sample row — sign in and save a report to open real library entries"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled
                          className="rounded-lg p-1.5 text-muted-foreground/40 cursor-not-allowed"
                          title="Sample row — sign in and save a report to open real library entries"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={!SAVED_REPORT_ROW_ID_RE.test(r.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-[#EA0022] hover:bg-[#EA0022]/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      title={
                        SAVED_REPORT_ROW_ID_RE.test(r.id)
                          ? "Delete report"
                          : "Sample row — cannot delete"
                      }
                      onClick={async () => {
                        if (!SAVED_REPORT_ROW_ID_RE.test(r.id)) return;
                        try {
                          await deleteSavedReportCloud(r.id);
                          setReports((prev) => prev.filter((rpt) => rpt.id !== r.id));
                          toast.success("Report deleted");
                        } catch {
                          toast.error("Failed to delete report");
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Scheduled Reports (collapsible) ── */}
        <section>
          <button
            onClick={() => setScheduleOpen(!scheduleOpen)}
            className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-md px-4 py-3 text-left transition-colors hover:bg-card/70"
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#00F2B3]" />
              <span className="text-sm font-semibold">Scheduled Reports</span>
              <span className="ml-1 inline-flex items-center rounded-md border border-white/[0.06] bg-card/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                {schedules.length}
              </span>
            </div>
            {scheduleOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {scheduleOpen && (
            <div className="mt-2 space-y-2">
              {/* Header row */}
              <div className="hidden sm:grid grid-cols-[1.5fr_1.2fr_0.8fr_0.8fr_auto] gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                <span>Customer</span>
                <span>Template</span>
                <span>Frequency</span>
                <span>Next Run</span>
                <span className="text-right">Active</span>
              </div>

              {schedules.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-1 sm:grid-cols-[1.5fr_1.2fr_0.8fr_0.8fr_auto] gap-2 sm:gap-4 items-center rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-md px-4 py-3"
                >
                  <span className="text-sm font-medium">{s.customer}</span>
                  <span className="text-xs text-muted-foreground">{s.template}</span>
                  <span>
                    <span className="inline-flex items-center rounded-md border border-white/[0.06] bg-card/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {s.frequency}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{s.nextRun}</span>
                  <div className="flex justify-end">
                    <button
                      onClick={() => toggleSchedule(s.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
                        s.active
                          ? "border-[#00F2B3]/30 bg-[#00F2B3]/20"
                          : "border-white/[0.08] bg-card/60"
                      }`}
                      title={s.active ? "Deactivate" : "Activate"}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full transition-transform shadow-sm ${
                          s.active
                            ? "translate-x-[22px] bg-[#00F2B3]"
                            : "translate-x-[3px] bg-muted-foreground/40"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ReportCentre() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <ReportCentreInner />
    </AuthProvider>
  );
}
