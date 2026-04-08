import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerDirectoryQuery } from "@/hooks/queries/use-customer-directory-query";
import { queryKeys } from "@/hooks/queries/keys";
import { invalidateOrgScopedQueries } from "@/lib/invalidate-org-queries";
import { toast } from "sonner";
import type { CustomerDirectoryEntry, HealthStatus } from "@/lib/customer-directory";
import {
  customerNameVariantsForDelete,
  dedupeNameVariantsCaseInsensitive,
  escapeForExactIlike,
} from "@/lib/customer-data-delete";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

const PortalViewerManager = lazy(() =>
  import("@/components/PortalViewerManager").then((m) => ({ default: m.PortalViewerManager })),
);
const PortalConfigurator = lazy(() =>
  import("@/components/PortalConfigurator").then((m) => ({ default: m.PortalConfigurator })),
);
import {
  Users,
  Plus,
  Search,
  Filter,
  Building2,
  Globe,
  Shield,
  FileText,
  ExternalLink,
  Send,
  Clock,
  TrendingUp,
  AlertTriangle,
  Trash2,
  X,
  UserCog,
  Settings,
  Cloud,
  Monitor,
  BarChart3,
  GitCompare,
  Code2,
  LayoutDashboard,
  Star,
  Download,
  Sparkles,
  LayoutGrid,
  Table2,
  Radar,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { WorkspaceSettingsStrip } from "@/components/WorkspaceSettingsStrip";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerDirectoryTable } from "@/components/customers/CustomerDirectoryTable";
import { CustomerDetailSheet } from "@/components/customers/CustomerDetailSheet";
import { cn } from "@/lib/utils";
import {
  customerCardGlowClass,
  customerCrmStatus,
  customerOpenAlerts,
  customerInitials,
  avatarHueFromName,
  customerRiskScore,
} from "@/lib/customer-ui-helpers";

type DemoCustomer = CustomerDirectoryEntry;

const DEMO_CUSTOMERS: DemoCustomer[] = [
  {
    id: "1",
    name: "Cheltenham Academy Trust",
    sector: "Education",
    country: "United Kingdom",
    countryFlag: "🇬🇧",
    score: 87,
    grade: "A",
    firewallCount: 4,
    unassessedCount: 0,
    tenantNameRaw: null,
    lastAssessed: "2 days ago",
    daysAgo: 2,
    frameworks: ["Cyber Essentials", "ISO 27001"],
    health: "Healthy",
    portalSlug: "cheltenham-academy",
  },
  {
    id: "2",
    name: "Westfield NHS Foundation",
    sector: "Healthcare",
    country: "United Kingdom",
    countryFlag: "🇬🇧",
    score: 62,
    grade: "C",
    firewallCount: 8,
    unassessedCount: 0,
    tenantNameRaw: null,
    lastAssessed: "18 days ago",
    daysAgo: 18,
    frameworks: ["DSPT", "Cyber Essentials Plus", "ISO 27001"],
    health: "At Risk",
    portalSlug: "westfield-nhs",
  },
  {
    id: "3",
    name: "Borough of Swindon Council",
    sector: "Government",
    country: "United Kingdom",
    countryFlag: "🇬🇧",
    score: 44,
    grade: "D",
    firewallCount: 12,
    unassessedCount: 0,
    tenantNameRaw: null,
    lastAssessed: "45 days ago",
    daysAgo: 45,
    frameworks: ["CAF", "Cyber Essentials Plus"],
    health: "Critical",
    portalSlug: "swindon-council",
  },
  {
    id: "4",
    name: "Pennine Building Society",
    sector: "Financial Services",
    country: "United Kingdom",
    countryFlag: "🇬🇧",
    score: 91,
    grade: "A",
    firewallCount: 6,
    unassessedCount: 0,
    tenantNameRaw: null,
    lastAssessed: "5 days ago",
    daysAgo: 5,
    frameworks: ["PCI DSS", "ISO 27001", "NIST CSF"],
    health: "Healthy",
    portalSlug: "pennine-bs",
  },
  {
    id: "5",
    name: "Hartley & Webb Solicitors",
    sector: "Legal",
    country: "United Kingdom",
    countryFlag: "🇬🇧",
    score: 73,
    grade: "B",
    firewallCount: 2,
    unassessedCount: 0,
    tenantNameRaw: null,
    lastAssessed: "31 days ago",
    daysAgo: 31,
    frameworks: ["Cyber Essentials"],
    health: "Overdue",
    portalSlug: "hartley-webb",
  },
  {
    id: "6",
    name: "Northern Retail Group",
    sector: "Retail",
    country: "United Kingdom",
    countryFlag: "🇬🇧",
    score: 56,
    grade: "C",
    firewallCount: 14,
    unassessedCount: 0,
    tenantNameRaw: null,
    lastAssessed: "22 days ago",
    daysAgo: 22,
    frameworks: ["PCI DSS", "Cyber Essentials"],
    health: "At Risk",
    portalSlug: "northern-retail",
  },
];

const HEALTH_OPTIONS: HealthStatus[] = ["Healthy", "At Risk", "Critical", "Overdue"];

const HEALTH_DOT: Record<HealthStatus, string> = {
  Healthy: "bg-[#00F2B3]",
  "At Risk": "bg-[#F29400]",
  Critical: "bg-[#EA0022]",
  Overdue: "bg-[#EA0022] animate-pulse",
};

const SECTOR_BADGE_STYLE: Record<string, string> = {
  Education: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Healthcare: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Government: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "Financial Services": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Legal: "bg-slate-500/15 text-slate-300 border-slate-500/20",
  Retail: "bg-pink-500/15 text-pink-400 border-pink-500/20",
};

const CUSTOMER_PIN_STORAGE_KEY = (orgKey: string) => `fc-customer-pins-v1:${orgKey}`;

function escapeCsvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCustomersCsv(rows: DemoCustomer[], filename: string) {
  const header = [
    "name",
    "sector",
    "country",
    "grade",
    "score",
    "health",
    "firewalls",
    "unassessed",
    "last_assessed_days_ago",
    "frameworks",
  ];
  const lines = [
    header.join(","),
    ...rows.map((c) =>
      [
        escapeCsvCell(c.name),
        escapeCsvCell(c.sector),
        escapeCsvCell(c.country),
        escapeCsvCell(c.grade),
        escapeCsvCell(c.score),
        escapeCsvCell(c.health),
        escapeCsvCell(c.firewallCount),
        escapeCsvCell(c.unassessedCount),
        escapeCsvCell(c.daysAgo),
        escapeCsvCell(c.frameworks.join("; ")),
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Customer directory CSV downloaded");
}

type CustomerSortKey = "name" | "score_desc" | "firewalls_desc" | "assessed_recent";

const SECTOR_FALLBACK_BADGE_STYLE =
  "bg-muted/45 text-muted-foreground border-border/55 dark:bg-white/[0.05] dark:border-white/10";

function sectorBadgeText(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s || /^unknown$/i.test(s)) return "Environment not set";
  return s;
}

function sectorBadgeClass(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s || /^unknown$/i.test(s)) return SECTOR_FALLBACK_BADGE_STYLE;
  return (
    SECTOR_BADGE_STYLE[s] ??
    "bg-slate-500/12 text-slate-500 border-slate-500/18 dark:text-slate-400"
  );
}

function CustomerManagementInner() {
  const { org, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const customerDirectoryQuery = useCustomerDirectoryQuery(org?.id, org?.name);

  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("");
  const [healthFilter, setHealthFilter] = useState<HealthStatus | "">("");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [customerSort, setCustomerSort] = useState<CustomerSortKey>("name");
  const [attentionCustomersOnly, setAttentionCustomersOnly] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DemoCustomer | null>(null);
  const [accessTarget, setAccessTarget] = useState<DemoCustomer | null>(null);
  const [portalConfigTarget, setPortalConfigTarget] = useState<DemoCustomer | null>(null);
  const [customerViewMode, setCustomerViewMode] = useState<"grid" | "table">("grid");
  const [detailCustomer, setDetailCustomer] = useState<DemoCustomer | null>(null);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    environment: "",
    country: "",
    logoFile: null as File | null,
  });
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 300);

  const pinStorageKey = CUSTOMER_PIN_STORAGE_KEY(org?.id ?? (isGuest ? "guest" : "signed-out"));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(pinStorageKey);
      if (!raw) {
        setPinnedIds(new Set());
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setPinnedIds(new Set());
        return;
      }
      setPinnedIds(new Set(parsed.filter((x): x is string => typeof x === "string")));
    } catch {
      setPinnedIds(new Set());
    }
  }, [pinStorageKey]);

  const togglePin = useCallback(
    (id: string) => {
      setPinnedIds((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        try {
          localStorage.setItem(pinStorageKey, JSON.stringify([...n]));
        } catch {
          /* ignore quota */
        }
        return n;
      });
    },
    [pinStorageKey],
  );

  const customers = useMemo(() => {
    if (!org?.id) return isGuest ? DEMO_CUSTOMERS : [];
    if (customerDirectoryQuery.isError) return [];
    return customerDirectoryQuery.data ?? [];
  }, [org?.id, isGuest, customerDirectoryQuery.isError, customerDirectoryQuery.data]);

  const loading = Boolean(org?.id) && customerDirectoryQuery.isPending;

  const sectors = useMemo(() => [...new Set(customers.map((c) => c.sector))].sort(), [customers]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) {
      const co = (c.country ?? "").trim();
      if (co) set.add(co);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [customers]);

  const deleteCustomerMutation = useMutation({
    mutationFn: async (payload: { orgId: string; customer: DemoCustomer }) => {
      const manualId = payload.customer.manualDirectoryId?.trim();
      if (manualId) {
        const { error: mErr } = await supabase
          .from("customer_directory_manual")
          .delete()
          .eq("org_id", payload.orgId)
          .eq("id", manualId);
        if (mErr) throw mErr;
      }

      const variants = dedupeNameVariantsCaseInsensitive(
        customerNameVariantsForDelete(payload.customer),
      );
      for (const n of variants) {
        const pattern = escapeForExactIlike(n);
        const { error: aErr } = await supabase
          .from("assessments")
          .delete()
          .eq("org_id", payload.orgId)
          .ilike("customer_name", pattern);
        if (aErr) throw aErr;
        const { error: sErr } = await supabase
          .from("saved_reports")
          .delete()
          .eq("org_id", payload.orgId)
          .ilike("customer_name", pattern);
        if (sErr) throw sErr;
        const { error: pErr } = await supabase
          .from("portal_config")
          .delete()
          .eq("org_id", payload.orgId)
          .ilike("tenant_name", pattern);
        if (pErr) {
          console.warn("[CustomerManagement] portal_config delete skipped or failed", pErr.message);
        }
        const { error: schErr } = await supabase
          .from("scheduled_reports")
          .delete()
          .eq("org_id", payload.orgId)
          .ilike("customer_name", pattern);
        if (schErr) throw schErr;
      }
    },
    onSuccess: async (_data, { orgId }) => {
      await invalidateOrgScopedQueries(queryClient, orgId);
      setDeleteTarget(null);
    },
    onError: (err) => {
      console.warn("[CustomerManagement] delete failed", err);
      toast.error("Could not delete customer data.");
    },
  });

  const addCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("No organisation");
      const name = addForm.name.trim();
      const { error } = await supabase.from("customer_directory_manual").insert({
        org_id: org.id,
        display_name: name,
        contact_email: addForm.email.trim() || null,
        environment: addForm.environment.trim() || null,
        compliance_country: addForm.country.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      if (org?.id) {
        await invalidateOrgScopedQueries(queryClient, org.id);
      }
      toast.success("Customer created", {
        description:
          "They appear in your directory. Run an assessment from Assess when you have a config export.",
      });
      setAddCustomerOpen(false);
      setAddForm({ name: "", email: "", environment: "", country: "", logoFile: null });
    },
    onError: (err: Error & { code?: string }) => {
      const dup = err?.code === "23505" || /duplicate|unique/i.test(String(err?.message ?? ""));
      toast.error(dup ? "A customer with this name already exists." : "Could not create customer.");
    },
  });

  const filtered = useMemo(() => {
    let list = customers;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (sectorFilter) {
      list = list.filter((c) => c.sector === sectorFilter);
    }
    if (healthFilter) {
      list = list.filter((c) => c.health === healthFilter);
    }
    if (countryFilter) {
      list = list.filter((c) => c.country === countryFilter);
    }
    if (attentionCustomersOnly) {
      list = list.filter((c) => c.health !== "Healthy");
    }
    return list;
  }, [
    debouncedSearch,
    sectorFilter,
    healthFilter,
    countryFilter,
    attentionCustomersOnly,
    customers,
  ]);

  const sortedFiltered = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const ap = pinnedIds.has(a.id) ? 1 : 0;
      const bp = pinnedIds.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      switch (customerSort) {
        case "score_desc":
          return b.score - a.score || a.name.localeCompare(b.name);
        case "firewalls_desc":
          return b.firewallCount - a.firewallCount || a.name.localeCompare(b.name);
        case "assessed_recent":
          return a.daysAgo - b.daysAgo || a.name.localeCompare(b.name);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [filtered, pinnedIds, customerSort]);

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.health !== "Overdue").length;
    const overdue = customers.filter(
      (c) => c.health === "Overdue" || c.health === "Critical",
    ).length;
    const avg = total > 0 ? Math.round(customers.reduce((s, c) => s + c.score, 0) / total) : 0;
    const firewallsTracked = customers.reduce((s, c) => s + c.firewallCount, 0);
    const abCount = customers.filter((c) => c.grade === "A" || c.grade === "B").length;
    const abPct = total > 0 ? Math.round((abCount / total) * 100) : 0;
    return { total, active, overdue, avg, firewallsTracked, abPct, abCount };
  }, [customers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <FireComplyWorkspaceHeader loginShell={isGuest} />

      <WorkspacePrimaryNav
        pageActions={
          <>
            <Button variant="outline" onClick={() => setAddCustomerOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add customer</span>
              <span className="sm:hidden">Add</span>
            </Button>
            <Button
              variant="default"
              className="gap-2 shadow-sm"
              onClick={() => setAddCustomerOpen(true)}
              title="Create a customer record on this page (no need to leave Customers)"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Onboard Customer</span>
            </Button>
          </>
        }
      />

      <main
        id="main-content"
        className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 assist-chrome-pad-bottom"
        data-tour="tour-page-customers"
      >
        {org?.id && !isGuest && (
          <div className="mb-4" data-tour="tour-cust-settings">
            <WorkspaceSettingsStrip variant="customers" />
          </div>
        )}
        {org?.id && !isGuest && customerDirectoryQuery.isError && (
          <div
            className="mb-4 flex flex-col gap-2 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <p className="text-sm text-foreground">
              Couldn&apos;t load your customer directory. Check your connection and try again — we
              no longer show sample data when the request fails.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: queryKeys.org.customerDirectory(org.id),
                })
              }
            >
              Retry
            </Button>
          </div>
        )}
        {/* Summary strip */}
        <div
          className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          data-tour="tour-cust-summary"
        >
          <SummaryCard
            icon={<Users className="h-5 w-5 text-[#2006F7]" />}
            label="Total Customers"
            value={stats.total}
          />
          <SummaryCard
            icon={<Shield className="h-5 w-5 text-[#00F2B3]" />}
            label="Active Portals"
            value={stats.active}
          />
          <SummaryCard
            icon={<AlertTriangle className="h-5 w-5 text-[#EA0022]" />}
            label="Overdue Assessments"
            value={stats.overdue}
          />
          <SummaryCard
            icon={<TrendingUp className="h-5 w-5 text-[#00EDFF]" />}
            label="Average Score"
            value={stats.avg}
            suffix="/100"
          />
          <SummaryCard
            icon={<Monitor className="h-5 w-5 text-[#009CFB]" />}
            label="Firewalls tracked"
            value={stats.firewallsTracked}
          />
        </div>

        {stats.total > 0 ? (
          <div
            className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-900/[0.10] bg-gradient-to-br from-[#2006F7]/[0.06] via-white/70 to-[#00EDFF]/[0.05] p-4 backdrop-blur-md dark:border-white/[0.06] dark:from-[#2006F7]/[0.12] dark:via-white/[0.04] dark:to-[#00EDFF]/[0.06] sm:flex-row sm:items-center"
            data-tour="tour-cust-pulse"
          >
            <div className="flex items-start gap-3 shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2006F7]/15 text-[#2006F7] dark:text-[#00EDFF]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Portfolio pulse</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  <strong className="text-foreground">{stats.abPct}%</strong> of your customers are
                  grade A or B ({stats.abCount} of {stats.total}). This blends every row in your
                  directory — use filters and export when you brief leadership or the board.
                </p>
              </div>
            </div>
            <div className="flex-1 min-w-[120px] space-y-1.5 sm:max-w-md sm:ml-auto">
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-900/[0.08] dark:bg-white/[0.10]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2006F7] via-[#009CFB] to-[#00F2B3] transition-[width] duration-500 ease-out"
                  style={{ width: `${stats.abPct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right tabular-nums">
                Target: move weak grades up with Assess + Fleet follow-through
              </p>
            </div>
          </div>
        ) : null}

        <div
          className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-900/[0.10] bg-white/60 px-3 py-2.5 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.04]"
          data-tour="tour-cust-jump"
        >
          <span className="text-[11px] font-medium text-muted-foreground self-center mr-1">
            Workspace
          </span>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link to="/dashboard">
              <Radar className="h-3.5 w-3.5" />
              Mission control
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link to="/">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Assess
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link to="/command">
              <Monitor className="h-3.5 w-3.5" />
              Fleet
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link to="/central/overview">
              <Cloud className="h-3.5 w-3.5" />
              Central
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link to="/reports">
              <FileText className="h-3.5 w-3.5" />
              Reports
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link to="/insights">
              <BarChart3 className="h-3.5 w-3.5" />
              Insights
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link to="/drift">
              <GitCompare className="h-3.5 w-3.5" />
              Drift
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link to="/api">
              <Code2 className="h-3.5 w-3.5" />
              API
            </Link>
          </Button>
        </div>

        {/* Search & filter bar */}
        <div className="mb-6 space-y-6" data-tour="tour-cust-toolbar">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search customers…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-900/[0.10] bg-white/70 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur-md transition-colors focus:border-[#2006F7]/40 focus:outline-none focus:ring-2 focus:ring-[#2006F7]/20 dark:border-white/[0.06] dark:bg-white/[0.04]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={customerSort}
                onValueChange={(v) => setCustomerSort(v as CustomerSortKey)}
              >
                <SelectTrigger className="h-10 w-full min-w-[160px] sm:w-[200px] text-xs bg-white/80 dark:bg-white/[0.06]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort: Name A–Z</SelectItem>
                  <SelectItem value="score_desc">Sort: Score (high first)</SelectItem>
                  <SelectItem value="firewalls_desc">Sort: Most firewalls</SelectItem>
                  <SelectItem value="assessed_recent">Sort: Assessed recently</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant={attentionCustomersOnly ? "default" : "outline"}
                size="sm"
                className={`h-10 gap-1.5 ${attentionCustomersOnly ? "shadow-md shadow-[#EA0022]/10" : ""}`}
                onClick={() => setAttentionCustomersOnly((v) => !v)}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Needs follow-up
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 gap-1.5"
                disabled={sortedFiltered.length === 0}
                onClick={() =>
                  downloadCustomersCsv(
                    sortedFiltered,
                    `customers-${new Date().toISOString().slice(0, 10)}.csv`,
                  )
                }
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>

              <div className="flex h-10 rounded-xl border border-slate-900/[0.10] bg-white/80 p-0.5 dark:border-white/[0.06] dark:bg-white/[0.06]">
                <Button
                  type="button"
                  variant={customerViewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 px-3 rounded-lg"
                  onClick={() => setCustomerViewMode("grid")}
                  aria-pressed={customerViewMode === "grid"}
                  title="Card grid"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={customerViewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 px-3 rounded-lg"
                  onClick={() => setCustomerViewMode("table")}
                  aria-pressed={customerViewMode === "table"}
                  title="Table view"
                >
                  <Table2 className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
                Filters
                {(sectorFilter || healthFilter || countryFilter || attentionCustomersOnly) && (
                  <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-[#2006F7] text-[10px] font-bold text-white tabular-nums">
                    {(sectorFilter ? 1 : 0) +
                      (healthFilter ? 1 : 0) +
                      (countryFilter ? 1 : 0) +
                      (attentionCustomersOnly ? 1 : 0)}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Filter pills row */}
          {showFilters && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-900/[0.10] bg-white/60 p-4 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.03]">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sector
              </span>
              <div className="flex flex-wrap gap-1.5">
                <FilterPill
                  label="All"
                  active={!sectorFilter}
                  onClick={() => setSectorFilter("")}
                />
                {sectors.map((s) => (
                  <FilterPill
                    key={s}
                    label={s}
                    active={sectorFilter === s}
                    onClick={() => setSectorFilter(sectorFilter === s ? "" : s)}
                  />
                ))}
              </div>

              <span className="ml-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Health
              </span>
              <div className="flex flex-wrap gap-1.5">
                <FilterPill
                  label="All"
                  active={!healthFilter}
                  onClick={() => setHealthFilter("")}
                />
                {HEALTH_OPTIONS.map((h) => (
                  <FilterPill
                    key={h}
                    label={h}
                    active={healthFilter === h}
                    onClick={() => setHealthFilter(healthFilter === h ? "" : h)}
                  />
                ))}
              </div>

              {countries.length > 0 ? (
                <>
                  <span className="w-full sm:w-auto sm:ml-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Country
                  </span>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Select
                      value={countryFilter || "__all__"}
                      onValueChange={(v) => setCountryFilter(v === "__all__" ? "" : v)}
                    >
                      <SelectTrigger className="h-9 w-full sm:w-[220px] text-xs bg-white/80 dark:bg-white/[0.06]">
                        <SelectValue placeholder="All countries" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All countries</SelectItem>
                        {countries.map((co) => (
                          <SelectItem key={co} value={co}>
                            {co}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}

              {(sectorFilter || healthFilter || countryFilter || attentionCustomersOnly) && (
                <button
                  onClick={() => {
                    setSectorFilter("");
                    setHealthFilter("");
                    setCountryFilter("");
                    setAttentionCustomersOnly(false);
                  }}
                  className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Customer cards grid */}
        {sortedFiltered.length > 0 ? (
          <div className="space-y-2" data-tour="tour-cust-directory">
            {pinnedIds.size > 0 ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" aria-hidden />
                Starred customers stay at the top on this browser (saved per organisation).
              </p>
            ) : null}
            {debouncedSearch ||
            sectorFilter ||
            healthFilter ||
            countryFilter ||
            attentionCustomersOnly ? (
              <p className="text-xs text-muted-foreground">
                Showing {sortedFiltered.length} of {customers.length} customer
                {customers.length === 1 ? "" : "s"}
                {debouncedSearch ? ` matching “${debouncedSearch}”` : ""}
                {countryFilter ? ` · ${countryFilter}` : ""}
                {attentionCustomersOnly ? " · needs follow-up only" : ""}
              </p>
            ) : null}
            {customerViewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedFiltered.map((customer) => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    isPinned={pinnedIds.has(customer.id)}
                    onTogglePin={togglePin}
                    onDelete={setDeleteTarget}
                    onManageAccess={setAccessTarget}
                    onConfigurePortal={setPortalConfigTarget}
                    onView={setDetailCustomer}
                  />
                ))}
              </div>
            ) : (
              <CustomerDirectoryTable
                data={sortedFiltered}
                onView={(c) => setDetailCustomer(c)}
                onManage={(c) => setPortalConfigTarget(c)}
              />
            )}
          </div>
        ) : customers.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-900/[0.10] bg-white/40 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.02]">
            <EmptyState
              className="py-16 px-6"
              icon={<Search className="h-8 w-8 text-[#2006F7]" />}
              title="No matching customers"
              description="Try a different search or clear filters to see all customers in your directory."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setSectorFilter("");
                    setHealthFilter("");
                    setCountryFilter("");
                    setAttentionCustomersOnly(false);
                    setCustomerSort("name");
                  }}
                >
                  Clear search &amp; filters
                </Button>
              }
            />
          </div>
        ) : org?.id && !isGuest && customerDirectoryQuery.isError ? (
          <div className="rounded-2xl border border-dashed border-slate-900/[0.10] bg-white/40 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.02]">
            <EmptyState
              className="py-16 px-6"
              icon={<Users className="h-8 w-8 text-muted-foreground" />}
              title="Directory unavailable"
              description="We could not load customers from the server. Use Retry above or check your session."
              action={
                <Button
                  onClick={() =>
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.org.customerDirectory(org.id),
                    })
                  }
                >
                  Retry
                </Button>
              }
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-900/[0.10] bg-white/40 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.02]">
            <EmptyState
              className="py-16 px-6"
              icon={<Users className="h-8 w-8 text-[#2006F7]" />}
              title="No customers yet"
              description="Create a customer here, or run your first assessment from Assess when you have a firewall export."
              action={
                <Button className="gap-2" onClick={() => setAddCustomerOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add customer
                </Button>
              }
            />
          </div>
        )}
      </main>

      {/* Per-customer portal configuration */}
      {portalConfigTarget && org?.id && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setPortalConfigTarget(null)}
          />
          <div className="fixed inset-x-4 top-[6vh] z-50 mx-auto max-w-xl max-h-[88vh] overflow-y-auto rounded-2xl border border-border/60 bg-background text-foreground shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur-sm rounded-t-2xl">
              <h3 className="text-sm font-display font-bold text-foreground">
                Portal — {portalConfigTarget.name}
              </h3>
              <button
                onClick={() => setPortalConfigTarget(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
                  </div>
                }
              >
                <PortalConfigurator
                  key={portalConfigTarget.id}
                  tenantListMode="focused"
                  initialTenantName={
                    portalConfigTarget.tenantNameRaw ??
                    portalConfigTarget.originalNames?.[0] ??
                    portalConfigTarget.name
                  }
                  onSaved={() => {
                    if (org?.id) {
                      void queryClient.invalidateQueries({
                        queryKey: queryKeys.org.customerDirectory(org.id),
                      });
                    }
                  }}
                />
              </Suspense>
            </div>
          </div>
        </>
      )}

      {/* Portal access manager modal */}
      {accessTarget && org?.id && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setAccessTarget(null)}
          />
          <div className="fixed inset-x-4 top-[8vh] z-50 mx-auto w-full max-w-4xl max-h-[84vh] overflow-y-auto rounded-2xl border border-border/60 bg-background text-foreground shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur-sm rounded-t-2xl">
              <h3 className="text-sm font-display font-bold text-foreground">
                Portal Access — {accessTarget.name}
              </h3>
              <button
                onClick={() => setAccessTarget(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
                  </div>
                }
              >
                <PortalViewerManager
                  orgId={org.id}
                  portalSlug={accessTarget.portalSlug?.trim() ?? ""}
                />
              </Suspense>
            </div>
          </div>
        </>
      )}

      <CustomerDetailSheet
        customer={detailCustomer}
        open={detailCustomer !== null}
        onOpenChange={(open) => {
          if (!open) setDetailCustomer(null);
        }}
        onConfigurePortal={(c) => {
          setDetailCustomer(null);
          setPortalConfigTarget(c);
        }}
        onManageAccess={(c) => {
          setDetailCustomer(null);
          setAccessTarget(c);
        }}
      />

      <Dialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
        <DialogContent className="sm:max-w-md border-border/60">
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>
              Creates a directory entry for this organisation. You can upload a firewall assessment
              from Assess whenever you are ready — you do not need to leave this page first.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="add-customer-name">Customer name</Label>
              <Input
                id="add-customer-name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Acme Ltd"
                autoComplete="organization"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-customer-email">Primary contact email</Label>
              <Input
                id="add-customer-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="security@example.com"
                autoComplete="email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-customer-env">Environment</Label>
              <Select
                value={addForm.environment || "__none__"}
                onValueChange={(v) =>
                  setAddForm((f) => ({ ...f, environment: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger id="add-customer-env">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select…</SelectItem>
                  <SelectItem value="Production">Production</SelectItem>
                  <SelectItem value="Staging">Staging</SelectItem>
                  <SelectItem value="Lab">Lab</SelectItem>
                  <SelectItem value="MSP tenant">MSP tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-customer-country">Country</Label>
              <Select
                value={addForm.country || "__none__"}
                onValueChange={(v) =>
                  setAddForm((f) => ({ ...f, country: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger id="add-customer-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select…</SelectItem>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="Ireland">Ireland</SelectItem>
                  <SelectItem value="Germany">Germany</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-customer-logo">Logo (optional)</Label>
              <Input
                id="add-customer-logo"
                type="file"
                accept="image/*"
                className="cursor-pointer"
                disabled
                title="Logo upload for directory customers is not wired yet"
                onChange={(e) =>
                  setAddForm((f) => ({
                    ...f,
                    logoFile: e.target.files?.[0] ?? null,
                  }))
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Logo is not saved to the directory yet.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddCustomerOpen(false)}
              disabled={addCustomerMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={addCustomerMutation.isPending}
              onClick={() => {
                if (!addForm.name.trim()) {
                  toast.error("Enter a customer name.");
                  return;
                }
                addCustomerMutation.mutate();
              }}
            >
              {addCustomerMutation.isPending ? "Creating…" : "Create customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="fixed inset-x-4 top-[30vh] z-50 mx-auto max-w-sm rounded-2xl border border-border/60 bg-background text-foreground shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EA0022]/10">
                  <Trash2 className="h-5 w-5 text-[#EA0022]" />
                </div>
                <h3 className="text-sm font-display font-bold text-foreground">Delete Customer</h3>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Delete <strong className="text-foreground">{deleteTarget.name}</strong>? This will
              remove assessment and saved-report rows (any matching spelling), scheduled email
              reports for this customer, and their client portal link if you have admin access.
              {deleteTarget.originalNames && deleteTarget.originalNames.length > 1 && (
                <span>
                  {" "}
                  Includes data saved under{" "}
                  {deleteTarget.originalNames
                    .filter((n) => n !== deleteTarget.name)
                    .map((n) => `"${n}"`)
                    .join(", ")}
                  .
                </span>
              )}{" "}
              If this name still appears afterward, Sophos Central may still be syncing firewalls or
              agents for that tenant — adjust or remove them under Agent Management. This cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteCustomerMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#EA0022] hover:bg-[#EA0022]/90 text-white gap-1.5"
                onClick={() => {
                  if (!org?.id) return;
                  deleteCustomerMutation.mutate({ orgId: org.id, customer: deleteTarget });
                }}
                disabled={deleteCustomerMutation.isPending}
              >
                {deleteCustomerMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-900/[0.10] bg-white/70 p-4 backdrop-blur-md transition-transform hover:scale-[1.02] dark:border-white/[0.06] dark:bg-white/[0.04]">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">
        {value}
        {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
        active
          ? "border-[#2006F7]/30 bg-[#2006F7] text-white shadow-sm"
          : "border-slate-900/[0.10] bg-white/60 text-muted-foreground hover:border-[#2006F7]/20 hover:text-foreground dark:border-white/[0.06] dark:bg-white/[0.04]"
      }`}
    >
      {label}
    </button>
  );
}

function CustomerRiskRing({ risk }: { risk: number }) {
  const r = 18;
  const cx = 22;
  const cy = 22;
  const stroke = 3.5;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, risk)) / 100;
  const offset = C * (1 - pct);
  const color = risk > 70 ? "#ef4444" : risk > 50 ? "#f59e0b" : risk > 25 ? "#eab308" : "#22c55e";
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-muted/40" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        className="fill-foreground text-[10px] font-bold tabular-nums"
      >
        {Math.round(risk)}
      </text>
    </svg>
  );
}

function crmBadgeClass(status: ReturnType<typeof customerCrmStatus>): string {
  if (status === "Active")
    return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-400";
  if (status === "Onboarding")
    return "border-blue-500/35 bg-blue-500/12 text-blue-700 dark:text-blue-400";
  return "border-border bg-muted/60 text-muted-foreground";
}

function CustomerCard({
  customer,
  isPinned,
  onTogglePin,
  onDelete,
  onManageAccess,
  onConfigurePortal,
  onView,
}: {
  customer: DemoCustomer;
  isPinned?: boolean;
  onTogglePin?: (customerId: string) => void;
  onDelete?: (c: DemoCustomer) => void;
  onManageAccess?: (c: DemoCustomer) => void;
  onConfigurePortal?: (c: DemoCustomer) => void;
  onView?: (c: DemoCustomer) => void;
}) {
  const hue = avatarHueFromName(customer.name);
  const crm = customerCrmStatus(customer);
  const openAlerts = customerOpenAlerts(customer);
  const risk = customerRiskScore(customer);

  return (
    <div
      className={cn(
        "group relative rounded-2xl border border-slate-900/[0.10] bg-white/70 p-5 backdrop-blur-md transition-all duration-200 hover:scale-[1.015] hover:shadow-lg dark:border-white/[0.06] dark:bg-white/[0.04]",
        customerCardGlowClass(customer),
      )}
    >
      <button
        type="button"
        className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-amber-500/15 hover:text-amber-600 dark:hover:text-amber-400"
        title={isPinned ? "Unstar customer" : "Star — keep at top of directory"}
        aria-label={isPinned ? "Unstar customer" : "Star customer"}
        aria-pressed={isPinned}
        onClick={() => onTogglePin?.(customer.id)}
      >
        <Star
          className={
            isPinned
              ? "h-4 w-4 fill-amber-500 text-amber-500"
              : "h-4 w-4 text-muted-foreground group-hover:text-amber-600/80"
          }
        />
      </button>
      <div className="absolute right-4 top-4">
        <span className={`block h-2.5 w-2.5 rounded-full ${HEALTH_DOT[customer.health]}`} />
      </div>

      <div className="mb-3 flex gap-3 pl-8 pr-6">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-inner"
          style={{ backgroundColor: `hsl(${hue} 55% 42%)` }}
        >
          {customerInitials(customer.name)}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-base font-bold leading-snug line-clamp-2">{customer.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${sectorBadgeClass(customer.sector)}`}
            >
              <Building2 className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
              {sectorBadgeText(customer.sector)}
            </span>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${crmBadgeClass(crm)}`}
            >
              {crm}
            </span>
            {customer.centralLinked ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-tight bg-[#2006F7]/[0.09] text-[#2006F7] border-[#2006F7]/22 dark:bg-[#009CFB]/[0.12] dark:text-[#7ae8ff] dark:border-[#00EDFF]/28"
                title="Sophos Central tenant"
              >
                <Cloud className="h-3 w-3 shrink-0 opacity-95" aria-hidden />
                Central
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Globe className="h-3 w-3 shrink-0" aria-hidden />
            {customer.countryFlag} {customer.country}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <CustomerRiskRing risk={risk} />
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            Risk
          </span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-900/[0.08] bg-white/50 px-3 py-2 text-center dark:border-white/[0.06] dark:bg-white/[0.03]">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Devices
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {customer.firewallCount}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Open alerts
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">{openAlerts}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Last report
          </p>
          <p className="text-xs font-medium leading-tight text-foreground line-clamp-2">
            {customer.lastAssessed}
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {customer.frameworks.slice(0, 4).map((fw) => (
          <span
            key={fw}
            className="rounded-full border border-[#2006F7]/15 bg-[#2006F7]/8 px-2 py-0.5 text-[9px] font-medium text-[#2006F7] dark:border-[#00EDFF]/15 dark:bg-[#00EDFF]/8 dark:text-[#00EDFF]"
          >
            {fw}
          </span>
        ))}
        {customer.frameworks.length > 4 ? (
          <span className="text-[9px] text-muted-foreground self-center">
            +{customer.frameworks.length - 4}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-900/[0.06] pt-3 dark:border-white/[0.06]">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="flex-1 min-w-[88px] gap-1.5 text-xs"
          onClick={() => onView?.(customer)}
        >
          View
        </Button>
        <Button
          asChild
          variant="default"
          size="sm"
          className="flex-1 min-w-[120px] gap-1.5 text-xs"
        >
          <Link to={`/?${new URLSearchParams({ customer: customer.name }).toString()}`}>
            New assessment
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 min-w-[88px] gap-1.5 text-xs"
          onClick={() => onConfigurePortal?.(customer)}
        >
          Manage
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-1 border-t border-dashed border-border/50 pt-2">
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px]">
          <Link to={`/command?${new URLSearchParams({ customer: customer.name }).toString()}`}>
            <Monitor className="h-3 w-3" />
            Fleet
          </Link>
        </Button>
        {customer.portalSlug ? (
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px]">
            <Link to={`/portal/${customer.portalSlug}`}>
              <ExternalLink className="h-3 w-3" />
              Portal
            </Link>
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Portal access"
          onClick={() => onManageAccess?.(customer)}
        >
          <UserCog className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Configure portal"
          onClick={() => onConfigurePortal?.(customer)}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
        <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Upload configs">
          <Link
            to={`/?${new URLSearchParams({ customer: customer.name, openUpload: "1" }).toString()}`}
          >
            <Send className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-[#EA0022] hover:bg-[#EA0022]/10"
          title="Delete customer"
          onClick={() => onDelete?.(customer)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function CustomerManagement() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <CustomerManagementInner />
    </AuthProvider>
  );
}
