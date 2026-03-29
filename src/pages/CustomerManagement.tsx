import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const PortalViewerManager = lazy(() =>
  import("@/components/PortalViewerManager").then((m) => ({ default: m.PortalViewerManager })),
);
import {
  Users,
  Plus,
  Search,
  Filter,
  ArrowLeft,
  Building2,
  Globe,
  Shield,
  FileText,
  ExternalLink,
  Send,
  Clock,
  TrendingUp,
  AlertTriangle,
  Sun,
  Moon,
  Trash2,
  X,
  UserCog,
} from "lucide-react";

const PLACEHOLDER_NAMES = /^\s*(\(this tenant\)|unnamed|unknown|customer)\s*$/i;

function resolveCustomerName(raw: string, orgName: string): string {
  if (!raw || PLACEHOLDER_NAMES.test(raw)) return orgName || "My Organisation";
  return raw;
}

type HealthStatus = "Healthy" | "At Risk" | "Critical" | "Overdue";

interface DemoCustomer {
  id: string;
  name: string;
  sector: string;
  country: string;
  countryFlag: string;
  score: number;
  grade: string;
  firewallCount: number;
  lastAssessed: string;
  daysAgo: number;
  frameworks: string[];
  health: HealthStatus;
  portalSlug: string;
  originalNames?: string[];
}

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
    lastAssessed: "22 days ago",
    daysAgo: 22,
    frameworks: ["PCI DSS", "Cyber Essentials"],
    health: "At Risk",
    portalSlug: "northern-retail",
  },
];

const SECTORS = [...new Set(DEMO_CUSTOMERS.map((c) => c.sector))];
const HEALTH_OPTIONS: HealthStatus[] = ["Healthy", "At Risk", "Critical", "Overdue"];

const GRADE_COLORS: Record<string, string> = {
  A: "#00F2B3",
  B: "#00EDFF",
  C: "#F29400",
  D: "#EA0022",
  F: "#EA0022",
};

const HEALTH_DOT: Record<HealthStatus, string> = {
  Healthy: "bg-[#00F2B3]",
  "At Risk": "bg-[#F29400]",
  Critical: "bg-[#EA0022]",
  Overdue: "bg-[#EA0022] animate-pulse",
};

const HEALTH_BADGE_STYLE: Record<HealthStatus, string> = {
  Healthy: "bg-[#00F2B3]/15 text-[#007A5A] dark:text-[#00F2B3] border-[#00F2B3]/20",
  "At Risk": "bg-[#F29400]/15 text-[#F29400] border-[#F29400]/20",
  Critical: "bg-[#EA0022]/15 text-[#EA0022] border-[#EA0022]/20",
  Overdue: "bg-[#EA0022]/15 text-[#EA0022] border-[#EA0022]/20",
};

const SECTOR_BADGE_STYLE: Record<string, string> = {
  Education: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Healthcare: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Government: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "Financial Services": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Legal: "bg-slate-500/15 text-slate-300 border-slate-500/20",
  Retail: "bg-pink-500/15 text-pink-400 border-pink-500/20",
};

function CustomerManagementInner() {
  const { user, org, isGuest } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("");
  const [healthFilter, setHealthFilter] = useState<HealthStatus | "">("");
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<DemoCustomer[]>(DEMO_CUSTOMERS);
  const [deleteTarget, setDeleteTarget] = useState<DemoCustomer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [accessTarget, setAccessTarget] = useState<DemoCustomer | null>(null);

  const handleDelete = useCallback(
    async (customer: DemoCustomer) => {
      if (!org?.id) return;
      setDeleting(true);
      try {
        const names = customer.originalNames ?? [customer.name];
        for (const n of names) {
          await supabase.from("assessments").delete().eq("org_id", org.id).eq("customer_name", n);
          await supabase.from("saved_reports").delete().eq("org_id", org.id).eq("customer_name", n);
        }
        setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
        setDeleteTarget(null);
      } catch (err) {
        console.warn("[CustomerManagement] delete failed", err);
      } finally {
        setDeleting(false);
      }
    },
    [org?.id],
  );

  useEffect(() => {
    if (!org?.id) {
      if (isGuest) setCustomers(DEMO_CUSTOMERS);
      else setCustomers([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [assessRes, tenantRes, agentRes, fwRes] = await Promise.all([
          supabase
            .from("assessments")
            .select("*")
            .eq("org_id", org.id)
            .order("created_at", { ascending: false }),
          supabase.from("central_tenants").select("central_tenant_id, name").eq("org_id", org.id),
          supabase
            .from("agents")
            .select(
              "id, name, firewall_host, customer_name, tenant_name, last_score, last_grade, last_seen_at, status, hardware_model",
            )
            .eq("org_id", org.id),
          supabase
            .from("central_firewalls")
            .select("central_tenant_id, hostname, name, firmware_version, model, status_json")
            .eq("org_id", org.id),
        ]);

        if (cancelled) return;

        const assessments = assessRes.data ?? [];
        const tenants = tenantRes.data ?? [];
        const agents = agentRes.data ?? [];
        const firewalls = fwRes.data ?? [];

        const gradeFor = (s: number) =>
          s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : s >= 40 ? "D" : "F";

        const customerMap = new Map<string, DemoCustomer>();

        for (const t of tenants) {
          const tName = /^\s*\(this tenant\)\s*$/i.test(t.name) ? org.name || t.name : t.name;
          if (!tName || customerMap.has(tName)) continue;
          const tFws = firewalls.filter((fw) => fw.central_tenant_id === t.central_tenant_id);
          const onlineCount = tFws.filter((fw) => {
            const sj = fw.status_json as { connected?: boolean } | null;
            return sj?.connected;
          }).length;
          customerMap.set(tName, {
            id: t.central_tenant_id,
            name: tName,
            sector: "Private Sector",
            country: "United Kingdom",
            countryFlag: "🇬🇧",
            score: 0,
            grade: "F",
            firewallCount: tFws.length,
            lastAssessed: "Not assessed",
            daysAgo: 999,
            frameworks: [],
            health: "Overdue" as HealthStatus,
            portalSlug: t.central_tenant_id,
          });
          void onlineCount;
        }

        for (const a of assessments) {
          const rawName = a.customer_name;
          const name = resolveCustomerName(rawName, org.name);
          const fws = a.firewalls as Array<unknown> | null;
          const fwCount = Array.isArray(fws) ? fws.length : 1;
          const daysSince = Math.floor(
            (Date.now() - new Date(a.created_at).getTime()) / 86_400_000,
          );
          let health: HealthStatus;
          if (a.overall_score < 40) health = "Critical";
          else if (daysSince > 90) health = "Overdue";
          else if (a.overall_score < 60 || daysSince > 60) health = "At Risk";
          else health = "Healthy";

          const existing = customerMap.get(name);
          if (existing) {
            if (!existing.originalNames) existing.originalNames = [];
            if (!existing.originalNames.includes(rawName)) existing.originalNames.push(rawName);
            if (existing.score === 0 || a.overall_score > existing.score) {
              existing.score = a.overall_score;
              existing.grade = a.overall_grade;
              existing.sector = a.environment || existing.sector;
              existing.firewallCount = Math.max(existing.firewallCount, fwCount);
              existing.lastAssessed =
                daysSince === 0 ? "Today" : daysSince === 1 ? "Yesterday" : `${daysSince} days ago`;
              existing.daysAgo = Math.min(existing.daysAgo, daysSince);
              existing.health = health;
            }
          } else {
            customerMap.set(name, {
              id: a.id,
              name,
              sector: a.environment || "Private Sector",
              country: "United Kingdom",
              countryFlag: "🇬🇧",
              score: a.overall_score,
              grade: a.overall_grade,
              firewallCount: fwCount,
              lastAssessed:
                daysSince === 0 ? "Today" : daysSince === 1 ? "Yesterday" : `${daysSince} days ago`,
              daysAgo: daysSince,
              frameworks: [],
              health,
              portalSlug: a.id,
              originalNames: [rawName],
            });
          }
        }

        for (const ag of agents) {
          const rawAgName = ag.tenant_name || ag.customer_name || ag.name;
          const resolvedName = resolveCustomerName(rawAgName, org.name);
          const existing = customerMap.get(resolvedName);
          if (existing) {
            if (existing.score === 0 && ag.last_score != null) {
              existing.score = ag.last_score;
              existing.grade = ag.last_grade || gradeFor(ag.last_score);
              const daysSince = ag.last_seen_at
                ? Math.floor((Date.now() - new Date(ag.last_seen_at).getTime()) / 86_400_000)
                : 999;
              existing.lastAssessed =
                daysSince === 0 ? "Today" : daysSince === 1 ? "Yesterday" : `${daysSince} days ago`;
              existing.daysAgo = daysSince;
              if (ag.last_score < 40) existing.health = "Critical";
              else if (ag.last_score < 60) existing.health = "At Risk";
              else existing.health = "Healthy";
            }
          } else {
            const daysSince = ag.last_seen_at
              ? Math.floor((Date.now() - new Date(ag.last_seen_at).getTime()) / 86_400_000)
              : 999;
            let health: HealthStatus = "Overdue";
            if (ag.last_score != null) {
              if (ag.last_score < 40) health = "Critical";
              else if (ag.last_score < 60 || daysSince > 60) health = "At Risk";
              else if (daysSince <= 90) health = "Healthy";
            }
            customerMap.set(resolvedName, {
              id: ag.id,
              name: resolvedName,
              sector: "Private Sector",
              country: "United Kingdom",
              countryFlag: "🇬🇧",
              score: ag.last_score ?? 0,
              grade: ag.last_grade || gradeFor(ag.last_score ?? 0),
              firewallCount: 1,
              lastAssessed:
                daysSince === 0
                  ? "Today"
                  : daysSince === 1
                    ? "Yesterday"
                    : daysSince < 999
                      ? `${daysSince} days ago`
                      : "Not assessed",
              daysAgo: daysSince,
              frameworks: [],
              health,
              portalSlug: ag.id,
            });
          }
        }

        setCustomers(customerMap.size > 0 ? Array.from(customerMap.values()) : []);
      } catch (err) {
        console.warn("[CustomerManagement] load failed", err);
        setCustomers(DEMO_CUSTOMERS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id, org?.name, isGuest]);

  const filtered = useMemo(() => {
    let list = customers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (sectorFilter) {
      list = list.filter((c) => c.sector === sectorFilter);
    }
    if (healthFilter) {
      list = list.filter((c) => c.health === healthFilter);
    }
    return list;
  }, [searchQuery, sectorFilter, healthFilter, customers]);

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.health !== "Overdue").length;
    const overdue = customers.filter(
      (c) => c.health === "Overdue" || c.health === "Critical",
    ).length;
    const avg = total > 0 ? Math.round(customers.reduce((s, c) => s + c.score, 0) / total) : 0;
    return { total, active, overdue, avg };
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
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-white/[0.06]"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(0,237,255,0.10), transparent 18%), radial-gradient(circle at top right, rgba(32,6,247,0.20), transparent 24%), linear-gradient(90deg, #00163d 0%, #001A47 42%, #10037C 100%)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="text-white/30">/</span>
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Customer Management
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
            <Button onClick={() => setShowOnboardModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Onboard Customer</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Summary strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        </div>

        {/* Search & filter bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search customers…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-900/[0.10] bg-white/70 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur-md transition-colors focus:border-[#2006F7]/40 focus:outline-none focus:ring-2 focus:ring-[#2006F7]/20 dark:border-white/[0.06] dark:bg-white/[0.04]"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2 sm:w-auto"
          >
            <Filter className="h-4 w-4" />
            Filters
            {(sectorFilter || healthFilter) && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2006F7] text-[10px] font-bold text-white">
                {(sectorFilter ? 1 : 0) + (healthFilter ? 1 : 0)}
              </span>
            )}
          </Button>
        </div>

        {/* Filter pills row */}
        {showFilters && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-900/[0.10] bg-white/60 p-4 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.03]">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sector
            </span>
            <div className="flex flex-wrap gap-1.5">
              <FilterPill label="All" active={!sectorFilter} onClick={() => setSectorFilter("")} />
              {SECTORS.map((s) => (
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
              <FilterPill label="All" active={!healthFilter} onClick={() => setHealthFilter("")} />
              {HEALTH_OPTIONS.map((h) => (
                <FilterPill
                  key={h}
                  label={h}
                  active={healthFilter === h}
                  onClick={() => setHealthFilter(healthFilter === h ? "" : h)}
                />
              ))}
            </div>

            {(sectorFilter || healthFilter) && (
              <button
                onClick={() => {
                  setSectorFilter("");
                  setHealthFilter("");
                }}
                className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Customer cards grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onDelete={setDeleteTarget}
                onManageAccess={setAccessTarget}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-900/[0.10] bg-white/40 px-6 py-20 text-center backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.02]">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2006F7]/10">
              <Users className="h-8 w-8 text-[#2006F7]" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No customers yet</h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Start by running your first assessment.
            </p>
            <Button onClick={() => setShowOnboardModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Onboard Customer
            </Button>
          </div>
        )}
      </main>

      {/* Onboard modal backdrop */}
      {showOnboardModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowOnboardModal(false)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-slate-900/[0.10] bg-white p-6 shadow-2xl dark:border-white/[0.06] dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-bold">Onboard New Customer</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Customer onboarding will be available once you connect your first firewall
              configuration. Use the main dashboard to run an assessment.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowOnboardModal(false)}>
                Cancel
              </Button>
              <Link to="/">
                <Button>Go to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Portal access manager modal */}
      {accessTarget && org?.id && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setAccessTarget(null)}
          />
          <div className="fixed inset-x-4 top-[8vh] z-50 mx-auto max-w-xl max-h-[84vh] overflow-y-auto rounded-2xl border border-border/60 bg-background text-foreground shadow-2xl">
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
                <PortalViewerManager orgId={org.id} />
              </Suspense>
            </div>
          </div>
        </>
      )}

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
              remove all assessment records
              {deleteTarget.originalNames && deleteTarget.originalNames.length > 1 && (
                <span>
                  {" "}
                  (including assessments saved as{" "}
                  {deleteTarget.originalNames
                    .filter((n) => n !== deleteTarget.name)
                    .map((n) => `"${n}"`)
                    .join(", ")}
                  )
                </span>
              )}{" "}
              and saved reports for this customer. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#EA0022] hover:bg-[#EA0022]/90 text-white gap-1.5"
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
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

function CustomerCard({
  customer,
  onDelete,
  onManageAccess,
}: {
  customer: DemoCustomer;
  onDelete?: (c: DemoCustomer) => void;
  onManageAccess?: (c: DemoCustomer) => void;
}) {
  const gradeColor = GRADE_COLORS[customer.grade] ?? "#2006F7";

  return (
    <div className="group relative rounded-2xl border border-slate-900/[0.10] bg-white/70 p-5 backdrop-blur-md transition-all duration-200 hover:scale-[1.015] hover:shadow-lg dark:border-white/[0.06] dark:bg-white/[0.04]">
      {/* Health dot */}
      <div className="absolute right-4 top-4">
        <span className={`block h-2.5 w-2.5 rounded-full ${HEALTH_DOT[customer.health]}`} />
      </div>

      {/* Header */}
      <div className="mb-3">
        <h3 className="pr-6 text-base font-bold leading-snug">{customer.name}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${SECTOR_BADGE_STYLE[customer.sector] ?? "bg-gray-500/15 text-gray-400 border-gray-500/20"}`}
          >
            <Building2 className="h-3 w-3" />
            {customer.sector}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Globe className="h-3 w-3" />
            {customer.countryFlag} {customer.country}
          </span>
        </div>
      </div>

      {/* Score gauge */}
      <div className="mb-4 flex items-end gap-3">
        <span className="text-4xl font-extrabold tabular-nums" style={{ color: gradeColor }}>
          {customer.score}
        </span>
        <div className="mb-1 flex flex-col">
          <span className="text-xl font-bold leading-none" style={{ color: gradeColor }}>
            {customer.grade}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Grade
          </span>
        </div>
        <span
          className={`mb-1 ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${HEALTH_BADGE_STYLE[customer.health]}`}
        >
          {customer.health}
        </span>
      </div>

      {/* Meta row */}
      <div className="mb-4 grid grid-cols-2 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          <span>
            {customer.firewallCount} firewall{customer.firewallCount !== 1 && "s"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>{customer.lastAssessed}</span>
        </div>
      </div>

      {/* Framework pills */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {customer.frameworks.map((fw) => (
          <span
            key={fw}
            className="rounded-full border border-[#2006F7]/15 bg-[#2006F7]/8 px-2 py-0.5 text-[10px] font-medium text-[#2006F7] dark:border-[#00EDFF]/15 dark:bg-[#00EDFF]/8 dark:text-[#00EDFF]"
          >
            {fw}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-slate-900/[0.06] pt-3 dark:border-white/[0.06]">
        <Link to={`/portal/${customer.portalSlug}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
            <ExternalLink className="h-3.5 w-3.5" />
            View Portal
          </Button>
        </Link>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Generate Report">
          <FileText className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Send Upload Link">
          <Send className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Manage portal access"
          onClick={() => onManageAccess?.(customer)}
        >
          <UserCog className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-[#EA0022] hover:bg-[#EA0022]/10"
          title="Delete customer"
          onClick={() => onDelete?.(customer)}
        >
          <Trash2 className="h-4 w-4" />
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
