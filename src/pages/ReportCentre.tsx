import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import {
  loadSavedReportsCloud,
  loadSavedReportPackageById,
  describeSavedReportRowType,
  formatFirewallSummaryFromPackage,
  savedPackageToMarkdown,
  setSavedReportArchivedCloud,
} from "@/lib/saved-reports";
import { buildReportHtml } from "@/lib/report-html";
import { displayCustomerNameForUi } from "@/lib/sophos-central";
import { supabase } from "@/integrations/supabase/client";
import { loadScheduledReports as loadScheduledReportsFromStorage } from "@/lib/scheduled-reports";
import { Button } from "@/components/ui/button";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import {
  FileText,
  Plus,
  Download,
  Send,
  Eye,
  Clock,
  Calendar,
  Mail,
  ChevronDown,
  ChevronUp,
  Trash2,
  Printer,
  Share2,
  Archive,
  ArchiveRestore,
  X,
} from "lucide-react";
import { deleteSavedReportCloud } from "@/lib/saved-reports";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { mergeManagePanelIntoCurrentSearch } from "@/lib/workspace-deeplink";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import JSZip from "jszip";

const PLACEHOLDER_NAMES = /^\s*(\(this tenant\)|unnamed|unknown|customer)\s*$/i;

type ReportLibraryType = "Full Handover" | "Executive Summary" | "Audit Checklist";
type ReportLibraryStatus = "Draft" | "Ready" | "Delivered" | "Archived";

export type ReportLibraryRow = {
  id: string;
  customer: string;
  environment: string;
  type: ReportLibraryType;
  pages: number;
  riskScore: number;
  generatedIso: string;
  dateDisplay: string;
  status: ReportLibraryStatus;
  format: "PDF" | "DOCX";
  firewalls: string;
  previewMd: string;
  /** Cloud rows: set when archived in Supabase (`archived_at`). */
  archivedAt?: number | null;
};

function hashToRisk(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 52) + 18;
}

function libraryTypeFromLegacyTitle(title: string): ReportLibraryType {
  const t = title.toLowerCase();
  if (t.includes("compliance") || t.includes("evidence")) return "Audit Checklist";
  if (
    t.includes("board") ||
    t.includes("quarterly") ||
    t.includes("insurance") ||
    t.includes("summary")
  )
    return "Executive Summary";
  return "Full Handover";
}

function libraryTypeFromDescription(desc: string): ReportLibraryType {
  const d = desc.toLowerCase();
  if (d.includes("compliance") || d.includes("evidence")) return "Audit Checklist";
  if (d.includes("board") || d.includes("executive")) return "Executive Summary";
  return "Full Handover";
}

function pagesForType(t: ReportLibraryType): number {
  if (t === "Executive Summary") return 10;
  if (t === "Audit Checklist") return 20;
  return 16;
}

const DEMO_REPORTS: ReportLibraryRow[] = [
  {
    id: "r1",
    customer: "Acme Corp",
    environment: "Production",
    type: libraryTypeFromLegacyTitle("Board Summary"),
    pages: 10,
    riskScore: 28,
    generatedIso: "2026-03-25",
    dateDisplay: "25 Mar 2026",
    status: "Delivered",
    format: "PDF",
    firewalls: "fw-london-01",
    previewMd:
      "# Executive Summary — Acme Corp\n\nPosture stable with minor hardening opportunities on VPN profiles.\n\n## Key metrics\n- Critical findings: 2\n- Target remediation: 14 days",
  },
  {
    id: "r2",
    customer: "Globex Industries",
    environment: "Staging",
    type: "Full Handover",
    pages: 16,
    riskScore: 44,
    generatedIso: "2026-03-24",
    dateDisplay: "24 Mar 2026",
    status: "Delivered",
    format: "DOCX",
    firewalls: "3 firewalls",
    previewMd:
      "# Full Handover — Globex Industries\n\nRule-level narrative and appendix attached in export.",
  },
  {
    id: "r3",
    customer: "Initech",
    environment: "Production",
    type: "Audit Checklist",
    pages: 20,
    riskScore: 61,
    generatedIso: "2026-03-22",
    dateDisplay: "22 Mar 2026",
    status: "Draft",
    format: "PDF",
    firewalls: "edge-fw01",
    previewMd: "# Audit Checklist — Initech\n\nControl mapping in progress (draft).",
  },
  {
    id: "r4",
    customer: "Soylent Corp",
    environment: "Production",
    type: "Executive Summary",
    pages: 8,
    riskScore: 35,
    generatedIso: "2026-03-20",
    dateDisplay: "20 Mar 2026",
    status: "Ready",
    format: "PDF",
    firewalls: "2 firewalls",
    previewMd: "# Executive Summary — Soylent Corp\n\nQuarterly snapshot for leadership.",
  },
  {
    id: "r5",
    customer: "Umbrella Corp",
    environment: "Lab",
    type: "Executive Summary",
    pages: 12,
    riskScore: 72,
    generatedIso: "2026-03-18",
    dateDisplay: "18 Mar 2026",
    status: "Delivered",
    format: "PDF",
    firewalls: "hq-gw.soylent.local",
    previewMd:
      "# Executive Summary — Umbrella Corp\n\nElevated exposure on legacy VPN — see findings.",
  },
  {
    id: "r6",
    customer: "Wayne Enterprises",
    environment: "Staging",
    type: "Executive Summary",
    pages: 10,
    riskScore: 22,
    generatedIso: "2026-03-15",
    dateDisplay: "15 Mar 2026",
    status: "Draft",
    format: "DOCX",
    firewalls: "—",
    previewMd: "# Executive Summary — Wayne Enterprises\n\nDraft — awaiting final review.",
  },
  {
    id: "r7",
    customer: "Stark Industries",
    environment: "Production",
    type: "Full Handover",
    pages: 18,
    riskScore: 38,
    generatedIso: "2026-03-12",
    dateDisplay: "12 Mar 2026",
    status: "Ready",
    format: "PDF",
    firewalls: "malibu-core, ny-dr",
    previewMd: "# Full Handover — Stark Industries\n\nDual-site configuration compared.",
  },
  {
    id: "r8",
    customer: "Cyberdyne Systems",
    environment: "Production",
    type: "Executive Summary",
    pages: 6,
    riskScore: 81,
    generatedIso: "2026-03-10",
    dateDisplay: "10 Mar 2026",
    status: "Delivered",
    format: "DOCX",
    firewalls: "skynet-edge",
    previewMd:
      "# Executive Summary — Cyberdyne Systems\n\nHigh-severity items flagged for immediate review.",
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

const TYPE_BADGE: Record<ReportLibraryType, string> = {
  "Full Handover": "border-violet-500/35 bg-violet-500/12 text-violet-700 dark:text-violet-300",
  "Executive Summary": "border-cyan-500/35 bg-cyan-500/12 text-cyan-800 dark:text-cyan-300",
  "Audit Checklist":
    "border-emerald-500/35 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
};

const STATUS_STYLE: Record<ReportLibraryStatus, string> = {
  Draft: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
  Ready: "bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/25",
  Delivered: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25",
  Archived: "bg-muted/50 text-muted-foreground border-border",
};

const SAVED_REPORT_ROW_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rowIsArchived(r: ReportLibraryRow): boolean {
  if (SAVED_REPORT_ROW_ID_RE.test(r.id)) return r.archivedAt != null;
  return r.status === "Archived";
}

function riskPillClass(score: number): string {
  if (score >= 70) return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
  if (score >= 40) return "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30";
}

const columnHelper = createColumnHelper<ReportLibraryRow>();

/* ── Component ── */

function ReportCentreInner() {
  const { org, isGuest, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  /** Guest/demo fills this in `useEffect`; signed-in orgs load cloud rows or stay empty. */
  const [reports, setReports] = useState<ReportLibraryRow[]>([]);
  const [schedules, setSchedules] = useState<ReportCentreSchedule[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<ReportLibraryRow>>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<ReportLibraryRow | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "generatedIso", desc: true }]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterCustomer, setFilterCustomer] = useState<string>("__all__");
  const [filterEnv, setFilterEnv] = useState<string>("__all__");
  const [search, setSearch] = useState("");

  const [genCustomer, setGenCustomer] = useState<string>("");
  const [genType, setGenType] = useState<ReportLibraryType>("Executive Summary");
  const [genConfigFile, setGenConfigFile] = useState<File | null>(null);

  const [quickSendRow, setQuickSendRow] = useState<ReportLibraryRow | null>(null);
  const [quickSendEmail, setQuickSendEmail] = useState("");
  const [quickSendBusy, setQuickSendBusy] = useState(false);
  const [archivesOpen, setArchivesOpen] = useState(true);

  const openScheduledReportsInManagement = useCallback(() => {
    navigate({
      pathname: location.pathname,
      search: mergeManagePanelIntoCurrentSearch(new URLSearchParams(location.search), {
        panel: "settings",
        section: "scheduled-reports",
      }),
    });
  }, [navigate, location.pathname, location.search]);

  const onLibraryEmailClick = useCallback(
    (r: ReportLibraryRow, real: boolean) => {
      if (isGuest || !org) {
        toast.message("Email from library", {
          description:
            "Sign in with your organisation to email saved reports. Until then, download from the row or open the saved report page.",
        });
        return;
      }
      if (!real) {
        toast.message("Email from library", {
          description:
            "This is a sample row. Save a report from Assess while signed in to email it from the library.",
        });
        return;
      }
      setQuickSendRow(r);
      setQuickSendEmail("");
    },
    [isGuest, org],
  );

  const submitQuickSend = useCallback(async () => {
    if (!quickSendRow || !org) return;
    const to = quickSendEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast.error("Enter a valid email address");
      return;
    }
    setQuickSendBusy(true);
    try {
      const pkg = await loadSavedReportPackageById(quickSendRow.id);
      if (!pkg) {
        toast.error("Could not load this saved report");
        return;
      }
      const md = savedPackageToMarkdown(pkg);
      const html = buildReportHtml(md);
      const htmlBase64 = btoa(unescape(encodeURIComponent(html)));
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Session expired — sign in again");
        return;
      }
      const base = `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "")}/functions/v1/api`;
      const tryUrls = [`${base}/send-report/saved-library`, `${base}/send-saved-library-report`];
      let lastErr = "Send failed";
      let res: Response | null = null;
      for (const url of tryUrls) {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            saved_report_id: quickSendRow.id,
            recipient_email: to,
            html_base64: htmlBase64,
            customer_display_name: displayCustomerNameForUi(pkg.customerName, org.name),
            prepared_by: user?.email ?? undefined,
          }),
        });
        res = r;
        if (r.status !== 404) break;
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        lastErr = j.error || "Not found";
      }
      if (!res) {
        throw new Error(lastErr);
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = j.error || "Send failed";
        if (res.status === 404) {
          throw new Error(
            `${msg} — the API may be missing this route. Deploy the latest \`api\` Edge Function (e.g. \`supabase functions deploy api\`) or merge to \`main\` so CI deploys.`,
          );
        }
        throw new Error(msg);
      }
      toast.success(`Report emailed to ${to}`);
      setQuickSendRow(null);
      setQuickSendEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send email");
    } finally {
      setQuickSendBusy(false);
    }
  }, [quickSendRow, quickSendEmail, org, user?.email]);

  const mergedReports = useMemo(
    () => reports.map((r) => ({ ...r, ...overrides[r.id] })),
    [reports, overrides],
  );

  const activeMerged = useMemo(
    () => mergedReports.filter((r) => !rowIsArchived(r)),
    [mergedReports],
  );
  const archivedMerged = useMemo(
    () => mergedReports.filter((r) => rowIsArchived(r)),
    [mergedReports],
  );

  const applyReportFilters = useCallback(
    (list: ReportLibraryRow[]) =>
      list.filter((r) => {
        if (filterCustomer !== "__all__" && r.customer !== filterCustomer) return false;
        if (filterEnv !== "__all__" && r.environment !== filterEnv) return false;
        if (dateFrom && r.generatedIso < dateFrom) return false;
        if (dateTo && r.generatedIso > dateTo) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          if (
            !r.customer.toLowerCase().includes(q) &&
            !r.type.toLowerCase().includes(q) &&
            !r.firewalls.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      }),
    [filterCustomer, filterEnv, dateFrom, dateTo, search],
  );

  const filteredReports = useMemo(
    () => applyReportFilters(activeMerged),
    [activeMerged, applyReportFilters],
  );

  const filteredArchivedReports = useMemo(
    () => applyReportFilters(archivedMerged),
    [archivedMerged, applyReportFilters],
  );

  const customerOptions = useMemo(() => {
    const s = new Set(mergedReports.map((r) => r.customer));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [mergedReports]);

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const stats = useMemo(() => {
    const total = activeMerged.length;
    const archived = archivedMerged.length;
    const generatedThisMonth = activeMerged.filter((r) =>
      r.generatedIso.startsWith(monthPrefix),
    ).length;
    const pending = activeMerged.filter((r) => r.status === "Draft" || r.status === "Ready").length;
    const delivered = activeMerged.filter((r) => r.status === "Delivered").length;
    return { total, archived, generatedThisMonth, pending, delivered };
  }, [activeMerged, archivedMerged, monthPrefix]);

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
          const mapped: ReportLibraryRow[] = savedReports.map((r, i) => {
            const rawCustomer =
              !r.customerName || PLACEHOLDER_NAMES.test(r.customerName) ? orgName : r.customerName;
            const desc = describeSavedReportRowType(r);
            const type = libraryTypeFromDescription(desc);
            const created = new Date(r.createdAt);
            const archivedAt = r.archivedAt ?? null;
            return {
              id: r.id || `r${i}`,
              customer: rawCustomer,
              environment: "Production",
              type,
              pages: pagesForType(type),
              riskScore: hashToRisk(r.id || String(i)),
              generatedIso: created.toISOString().slice(0, 10),
              dateDisplay: created.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }),
              status: archivedAt ? "Archived" : "Ready",
              format: "PDF",
              firewalls: formatFirewallSummaryFromPackage(r),
              previewMd: `# ${rawCustomer}\n\n**${type}** · ${desc}\n\nPreview only — use **Download** or open the saved report for full export (PDF / Word).`,
              archivedAt,
            };
          });
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
        toast.error("Could not load saved reports. Check your connection and try again.");
        setReports([]);
        setSchedules([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id, org?.name]);

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) setSelectedIds(new Set(filteredReports.map((r) => r.id)));
      else setSelectedIds(new Set());
    },
    [filteredReports],
  );

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);

  const applyBulkStatus = useCallback(
    async (status: ReportLibraryStatus) => {
      if (status === "Archived") {
        const ids = [...selectedIds];
        for (const id of ids) {
          if (!SAVED_REPORT_ROW_ID_RE.test(id)) continue;
          const { error } = await setSavedReportArchivedCloud(id, true);
          if (error) {
            toast.error(error);
            return;
          }
        }
        setReports((prev) =>
          prev.map((r) =>
            ids.includes(r.id) && SAVED_REPORT_ROW_ID_RE.test(r.id)
              ? { ...r, archivedAt: Date.now(), status: "Archived" }
              : r,
          ),
        );
        setOverrides((prev) => {
          const next = { ...prev };
          for (const id of ids) {
            if (!SAVED_REPORT_ROW_ID_RE.test(id)) {
              next[id] = { ...next[id], status: "Archived" };
            }
          }
          return next;
        });
        toast.success("Archived selected reports");
        setSelectedIds(new Set());
        return;
      }
      setOverrides((prev) => {
        const next = { ...prev };
        for (const id of selectedIds) {
          next[id] = { ...next[id], status };
        }
        return next;
      });
      toast.success(status === "Delivered" ? "Marked selected as delivered" : "Updated");
      setSelectedIds(new Set());
    },
    [selectedIds],
  );

  const downloadMarkdown = useCallback((r: ReportLibraryRow) => {
    const blob = new Blob([r.previewMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.customer.replace(/\s+/g, "-")}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Markdown downloaded");
  }, []);

  const bulkDownloadZip = useCallback(async () => {
    const rows = filteredReports.filter((r) => selectedIds.has(r.id));
    if (rows.length === 0) return;
    const zip = new JSZip();
    for (const r of rows) {
      zip.file(`${r.id}-${r.customer.replace(/\s+/g, "-")}.md`, r.previewMd);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ZIP prepared");
  }, [filteredReports, selectedIds]);

  const deleteRow = useCallback(async (r: ReportLibraryRow) => {
    if (!SAVED_REPORT_ROW_ID_RE.test(r.id)) {
      toast.error("Sample row — cannot delete");
      return;
    }
    try {
      await deleteSavedReportCloud(r.id);
      setReports((prev) => prev.filter((x) => x.id !== r.id));
      setSelectedIds((s) => {
        const n = new Set(s);
        n.delete(r.id);
        return n;
      });
      toast.success("Report deleted");
    } catch {
      toast.error("Failed to delete report");
    }
  }, []);

  const handleArchiveRow = useCallback(async (r: ReportLibraryRow, real: boolean) => {
    if (real) {
      const { error } = await setSavedReportArchivedCloud(r.id, true);
      if (error) {
        toast.error(error);
        return;
      }
      setReports((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, archivedAt: Date.now(), status: "Archived" } : x)),
      );
    } else {
      setOverrides((o) => ({
        ...o,
        [r.id]: { ...o[r.id], status: "Archived" },
      }));
    }
    setSelectedIds((s) => {
      const n = new Set(s);
      n.delete(r.id);
      return n;
    });
    toast.success("Report archived");
  }, []);

  const restoreRow = useCallback(async (r: ReportLibraryRow, real: boolean) => {
    if (real) {
      const { error } = await setSavedReportArchivedCloud(r.id, false);
      if (error) {
        toast.error(error);
        return;
      }
      setReports((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, archivedAt: null, status: "Ready" } : x)),
      );
      setOverrides((o) => {
        const next = { ...o };
        delete next[r.id];
        return next;
      });
    } else {
      setOverrides((o) => ({
        ...o,
        [r.id]: { ...o[r.id], status: "Ready" },
      }));
    }
    toast.success("Restored to library");
  }, []);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: () => (
          <Checkbox
            checked={
              filteredReports.length > 0 && selectedIds.size === filteredReports.length
                ? true
                : selectedIds.size > 0
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => toggleSelectAll(v === true)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={(v) => toggleSelect(row.original.id, v === true)}
            aria-label={`Select ${row.original.customer}`}
          />
        ),
        size: 36,
      }),
      columnHelper.display({
        id: "idx",
        header: "#",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground text-xs">{row.index + 1}</span>
        ),
        size: 40,
      }),
      columnHelper.accessor("customer", {
        header: "Customer",
        cell: (info) => <span className="font-medium text-sm">{info.getValue()}</span>,
      }),
      columnHelper.accessor("environment", {
        header: "Environment",
        cell: (info) => <span className="text-xs text-muted-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor("type", {
        header: "Type",
        cell: (info) => {
          const t = info.getValue();
          return (
            <span
              className={cn(
                "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold",
                TYPE_BADGE[t],
              )}
            >
              {t}
            </span>
          );
        },
      }),
      columnHelper.accessor("pages", {
        header: "Pages",
        cell: (info) => <span className="tabular-nums text-sm">{info.getValue()}</span>,
      }),
      columnHelper.accessor("riskScore", {
        header: "Risk",
        cell: (info) => (
          <span
            className={cn(
              "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums",
              riskPillClass(info.getValue()),
            )}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("generatedIso", {
        header: "Generated",
        cell: (info) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {info.row.original.dateDisplay}
          </span>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const s = info.getValue();
          return (
            <span
              className={cn(
                "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold",
                STATUS_STYLE[s],
              )}
            >
              {s}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const r = row.original;
          const real = SAVED_REPORT_ROW_ID_RE.test(r.id);
          return (
            <div
              className="ml-auto inline-flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1.5"
              role="group"
              aria-label="Report actions"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                title="View"
                onClick={() => setPreview(r)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {real ? (
                <Link
                  to={`/reports/saved/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    title="Download PDF"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled
                  title="Demo row"
                >
                  <Download className="h-4 w-4 opacity-40" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                title="Download .md"
                onClick={() => downloadMarkdown(r)}
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                title={real ? "Email report" : "Demo row — email unavailable"}
                onClick={() => onLibraryEmailClick(r, real)}
              >
                <Mail className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                title="Archive"
                onClick={() => void handleArchiveRow(r, real)}
              >
                <Archive className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                title="Delete"
                disabled={!real}
                onClick={() => void deleteRow(r)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      }),
    ],
    [
      filteredReports,
      selectedIds,
      toggleSelectAll,
      toggleSelect,
      downloadMarkdown,
      deleteRow,
      onLibraryEmailClick,
      handleArchiveRow,
    ],
  );

  const table = useReactTable({
    data: filteredReports,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function toggleSchedule(id: string) {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  }

  const hasReports = filteredReports.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground assist-chrome-pad-bottom">
      <FireComplyWorkspaceHeader loginShell={isGuest} />

      <WorkspacePrimaryNav
        pageActions={
          <Button size="sm" className="gap-1.5 shadow-sm" asChild>
            <Link to="/">Generate report</Link>
          </Button>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-[#00EDFF]" />
        </div>
      )}

      <main
        className={cn("mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6", loading ? "hidden" : "")}
        data-tour="tour-page-reports"
      >
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
          data-tour="tour-reports-stats"
        >
          {[
            { label: "In library", value: stats.total, icon: FileText, colour: "#2006F7" },
            {
              label: "This month",
              value: stats.generatedThisMonth,
              icon: Calendar,
              colour: "#00EDFF",
            },
            { label: "Pending", value: stats.pending, icon: Clock, colour: "#F29400" },
            { label: "Delivered", value: stats.delivered, icon: Send, colour: "#00F2B3" },
            { label: "Archived", value: stats.archived, icon: Archive, colour: "#9BB0D3" },
          ].map((s) => (
            <div
              key={s.label}
              className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-4 shadow-sm"
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
                  <p className="text-xl font-bold tracking-tight tabular-nums">{s.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] lg:items-start">
          <div className="space-y-4 min-w-0">
            <div
              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
              data-tour="tour-reports-filters"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Filters
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px]">From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">To</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Customer</Label>
                  <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All customers</SelectItem>
                      {customerOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Environment</Label>
                  <Select value={filterEnv} onValueChange={setFilterEnv}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      <SelectItem value="Production">Production</SelectItem>
                      <SelectItem value="Staging">Staging</SelectItem>
                      <SelectItem value="Lab">Lab</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5 max-w-md">
                <Label className="text-[11px]">Search</Label>
                <Input
                  placeholder="Customer, type, firewalls…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <section data-tour="tour-reports-library">
              <h2 className="mb-3 text-sm font-semibold tracking-tight">Library</h2>
              {!hasReports && activeMerged.length === 0 && archivedMerged.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 backdrop-blur-md">
                  <EmptyState
                    className="py-12"
                    icon={<FileText className="h-6 w-6 text-muted-foreground/50" />}
                    title="No saved reports in your library"
                    description={
                      org?.id
                        ? "Save a report from the Assess preview toolbar, or generate one here — saved packages sync to this list for your organisation."
                        : "Run an assessment and generate your first report."
                    }
                    action={
                      <Button asChild size="sm" className="rounded-lg">
                        <Link to="/">Go to Assess</Link>
                      </Button>
                    }
                  />
                </div>
              ) : !hasReports && activeMerged.length === 0 && archivedMerged.length > 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground space-y-2">
                  <p>
                    No active reports in the library — everything here is in{" "}
                    <strong>Archives</strong> below.
                  </p>
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => setArchivesOpen(true)}
                  >
                    Open Archives
                  </Button>
                </div>
              ) : !hasReports ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground">
                  No reports match these filters.
                  <Button
                    variant="link"
                    className="ml-2 h-auto p-0"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setFilterCustomer("__all__");
                      setFilterEnv("__all__");
                      setSearch("");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-card/40 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((hg) => (
                        <TableRow key={hg.id} className="hover:bg-transparent border-border/50">
                          {hg.headers.map((h) => (
                            <TableHead
                              key={h.id}
                              className="text-[10px] uppercase tracking-wider whitespace-nowrap"
                            >
                              {h.isPlaceholder
                                ? null
                                : flexRender(h.column.columnDef.header, h.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} className="border-border/50">
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="align-middle text-sm py-2">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <Collapsible open={archivesOpen} onOpenChange={setArchivesOpen} className="space-y-2">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/50 backdrop-blur-md px-4 py-3 text-left transition-colors hover:bg-card/70"
                  data-tour="tour-reports-archives"
                >
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Archives</span>
                    <span className="ml-1 inline-flex items-center rounded-md border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {archivedMerged.length}
                    </span>
                  </div>
                  {archivesOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {filteredArchivedReports.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/20 px-4 py-8 text-center text-sm text-muted-foreground">
                    {archivedMerged.length === 0
                      ? "No archived reports. Archive rows from the library to store them here (saved cloud reports sync to Supabase)."
                      : "No archived reports match these filters."}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/60 bg-card/40 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/50">
                          <TableHead className="text-[10px] uppercase tracking-wider">
                            Customer
                          </TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider">
                            Type
                          </TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider">
                            Saved
                          </TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider w-[1%] text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredArchivedReports.map((r) => {
                          const real = SAVED_REPORT_ROW_ID_RE.test(r.id);
                          return (
                            <TableRow key={r.id} className="border-border/50">
                              <TableCell className="font-medium text-sm">{r.customer}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {r.type}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {r.dateDisplay}
                              </TableCell>
                              <TableCell className="text-right">
                                <div
                                  className="ml-auto inline-flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1.5"
                                  role="group"
                                  aria-label="Archived report actions"
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    title="Preview"
                                    onClick={() => setPreview(r)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {real ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 shrink-0"
                                      asChild
                                    >
                                      <Link
                                        to={`/reports/saved/${r.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Open saved report"
                                        className="inline-flex"
                                      >
                                        <Download className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                  ) : (
                                    <span className="inline-flex h-9 w-9 shrink-0" aria-hidden />
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 text-[#00F2B3] hover:text-[#00F2B3]"
                                    title="Restore to library"
                                    onClick={() => void restoreRow(r, real)}
                                  >
                                    <ArchiveRestore className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                                    title="Delete"
                                    disabled={!real}
                                    onClick={() => void deleteRow(r)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            <section data-tour="tour-reports-scheduled">
              <button
                type="button"
                onClick={() => setScheduleOpen(!scheduleOpen)}
                className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/50 backdrop-blur-md px-4 py-3 text-left transition-colors hover:bg-card/70"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#00F2B3]" />
                  <span className="text-sm font-semibold">Scheduled reports</span>
                  <span className="ml-1 inline-flex items-center rounded-md border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
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
                  {schedules.length === 0 && org?.id ? (
                    <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground space-y-2">
                      <p>No scheduled reports configured for this organisation yet.</p>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-[#00EDFF]"
                        onClick={openScheduledReportsInManagement}
                      >
                        Open Scheduled reports in Settings
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="hidden sm:grid grid-cols-[1.5fr_1.2fr_0.8fr_0.8fr_auto] gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        <span>Customer</span>
                        <span>Template</span>
                        <span>Frequency</span>
                        <span>Next run</span>
                        <span className="text-right">Active</span>
                      </div>

                      {schedules.map((s) => (
                        <div
                          key={s.id}
                          className="grid grid-cols-1 sm:grid-cols-[1.5fr_1.2fr_0.8fr_0.8fr_auto] gap-2 sm:gap-4 items-center rounded-xl border border-border/60 bg-card/50 backdrop-blur-md px-4 py-3"
                        >
                          <span className="text-sm font-medium">{s.customer}</span>
                          <span className="text-xs text-muted-foreground">{s.template}</span>
                          <span>
                            <span className="inline-flex items-center rounded-md border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              {s.frequency}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground">{s.nextRun}</span>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => toggleSchedule(s.id)}
                              className={cn(
                                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
                                s.active
                                  ? "border-[#00F2B3]/30 bg-[#00F2B3]/20"
                                  : "border-border/60 bg-card/60",
                              )}
                              title={s.active ? "Deactivate" : "Activate"}
                            >
                              <span
                                className={cn(
                                  "inline-block h-4 w-4 rounded-full transition-transform shadow-sm",
                                  s.active
                                    ? "translate-x-[22px] bg-[#00F2B3]"
                                    : "translate-x-[3px] bg-muted-foreground/40",
                                )}
                              />
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside
            className="rounded-2xl border border-[#2006F7]/20 bg-gradient-to-b from-[#2006F7]/[0.08] to-card/80 p-5 shadow-lg shadow-[#2006F7]/5 lg:sticky lg:top-20 space-y-4"
            data-tour="tour-reports-sidebar"
          >
            <h3 className="text-sm font-bold tracking-tight">Generate new report</h3>
            <div className="space-y-2">
              <Label className="text-xs">Customer</Label>
              <Select
                value={genCustomer || "__pick__"}
                onValueChange={(v) => setGenCustomer(v === "__pick__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__pick__">Select…</SelectItem>
                  {customerOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Report type</Label>
              <div className="flex flex-col gap-2">
                {(
                  ["Full Handover", "Executive Summary", "Audit Checklist"] as ReportLibraryType[]
                ).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setGenType(t)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-all",
                      genType === t
                        ? "border-[#2006F7] bg-[#2006F7]/15 text-foreground shadow-[0_0_20px_rgba(32,6,247,0.15)]"
                        : "border-border/60 bg-card/50 hover:border-[#2006F7]/30",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Config file (optional)</Label>
              <Input
                type="file"
                accept=".xml,.conf,.txt,.tar,.gz,.zip"
                className="cursor-pointer text-xs"
                onChange={(e) => setGenConfigFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              className="w-full gap-2 shadow-lg shadow-[#2006F7]/20"
              disabled={!genCustomer.trim()}
              asChild={Boolean(genCustomer.trim())}
            >
              {genCustomer.trim() ? (
                <Link
                  to={`/?${new URLSearchParams({
                    customer: genCustomer.trim(),
                    reportTemplate:
                      genType === "Executive Summary"
                        ? "board-summary"
                        : genType === "Audit Checklist"
                          ? "compliance"
                          : "technical",
                  }).toString()}`}
                >
                  <Plus className="h-4 w-4" />
                  Generate now
                </Link>
              ) : (
                <span className="pointer-events-none flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  Generate now
                </span>
              )}
            </Button>
            {genConfigFile ? (
              <p className="text-[10px] text-muted-foreground">
                {genConfigFile.name} will be available on Assess after you open the workspace.
              </p>
            ) : null}
          </aside>
        </div>
      </main>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-[min(96vw,1100px)] w-full h-[min(92vh,880px)] p-0 gap-0 flex flex-col border-border/60 translate-y-[-50%] [&>button]:hidden">
          {preview ? (
            <>
              <DialogHeader className="px-4 py-3 border-b border-border/60 space-y-0 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <DialogTitle className="text-base font-semibold pr-8">
                    {preview.customer} · {preview.type}
                  </DialogTitle>
                  <div className="flex flex-wrap items-center gap-1">
                    {SAVED_REPORT_ROW_ID_RE.test(preview.id) ? (
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
                        <Link to={`/reports/saved/${preview.id}`} target="_blank" rel="noreferrer">
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled>
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => window.print()}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => {
                        void navigator.clipboard.writeText(window.location.href);
                        toast.success("Link copied");
                      }}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setPreview(null)}
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 py-4 text-sm leading-relaxed">
                <pre className="whitespace-pre-wrap font-sans text-foreground/90">
                  {preview.previewMd}
                </pre>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={quickSendRow != null}
        onOpenChange={(open) => {
          if (!open) {
            setQuickSendRow(null);
            setQuickSendEmail("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email saved report</DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Sends the same HTML document as the saved report viewer (open the attachment in a
                  browser). Your deployment must have outbound email configured (Resend).
                </p>
                <p>
                  For recurring sends, open{" "}
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline font-medium"
                    onClick={() => {
                      setQuickSendRow(null);
                      setQuickSendEmail("");
                      openScheduledReportsInManagement();
                    }}
                  >
                    Scheduled reports
                  </button>{" "}
                  in workspace management.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="quick-send-email">Recipient email</Label>
            <Input
              id="quick-send-email"
              type="email"
              autoComplete="email"
              placeholder="client@example.com"
              value={quickSendEmail}
              onChange={(e) => setQuickSendEmail(e.target.value)}
              disabled={quickSendBusy}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={quickSendBusy}
              onClick={() => {
                setQuickSendRow(null);
                setQuickSendEmail("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={quickSendBusy || !quickSendEmail.trim()}
              onClick={() => void submitQuickSend()}
            >
              {quickSendBusy ? "Sending…" : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedIds.size > 0 ? (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
          <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedIds.size}</span> selected
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => void bulkDownloadZip()}
              >
                <Download className="h-3.5 w-3.5" />
                Download ZIP
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => void applyBulkStatus("Delivered")}
              >
                <Send className="h-3.5 w-3.5" />
                Mark delivered
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => void applyBulkStatus("Archived")}
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
