import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { loadScoreHistoryForFleet } from "@/lib/score-history";
import { gradeForScore, GRADE_COLORS, type Grade } from "@/lib/design-tokens";
import { resolveCustomerName } from "@/lib/customer-name";
import { WorkspaceSettingsStrip } from "@/components/WorkspaceSettingsStrip";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import { PortfolioRiskStrip } from "@/components/PortfolioRiskStrip";
import { EmptyState } from "@/components/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Clock,
  Users,
  DollarSign,
  Shield,
  Send,
  Link2,
  Building2,
  PieChart,
  Loader2,
  Sparkles,
  ListOrdered,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  MOCK_THREAT_ACTIVITY,
  MOCK_THREAT_CATEGORIES,
  MOCK_TOP_THREAT_TYPES,
  MOCK_COMPLIANCE_SERIES,
  MOCK_REPORT_HEATMAP_WEEKS,
  MOCK_RECOMMENDATIONS,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Demo data                                                         */
/* ------------------------------------------------------------------ */

interface Customer {
  id: number;
  name: string;
  score: number;
  firewallCount: number;
  daysSinceAssessment: number;
  criticalFindings: number;
  sector: string;
  exposure: number;
  compliant: boolean;
}

const DEMO_PORTFOLIO: Customer[] = [
  {
    id: 1,
    name: "Acme Corp",
    score: 34,
    firewallCount: 8,
    daysSinceAssessment: 47,
    criticalFindings: 12,
    sector: "Manufacturing",
    exposure: 420000,
    compliant: false,
  },
  {
    id: 2,
    name: "Bright Academy",
    score: 72,
    firewallCount: 3,
    daysSinceAssessment: 12,
    criticalFindings: 3,
    sector: "Education",
    exposure: 85000,
    compliant: true,
  },
  {
    id: 3,
    name: "CityHealth NHS",
    score: 58,
    firewallCount: 14,
    daysSinceAssessment: 5,
    criticalFindings: 9,
    sector: "Healthcare",
    exposure: 310000,
    compliant: false,
  },
  {
    id: 4,
    name: "Delta Finance",
    score: 91,
    firewallCount: 6,
    daysSinceAssessment: 3,
    criticalFindings: 0,
    sector: "Finance",
    exposure: 15000,
    compliant: true,
  },
  {
    id: 5,
    name: "Evergreen Council",
    score: 65,
    firewallCount: 10,
    daysSinceAssessment: 28,
    criticalFindings: 5,
    sector: "Government",
    exposure: 190000,
    compliant: true,
  },
  {
    id: 6,
    name: "FreshRetail Ltd",
    score: 43,
    firewallCount: 4,
    daysSinceAssessment: 62,
    criticalFindings: 8,
    sector: "Retail",
    exposure: 275000,
    compliant: false,
  },
  {
    id: 7,
    name: "GreenTech Solar",
    score: 78,
    firewallCount: 2,
    daysSinceAssessment: 9,
    criticalFindings: 2,
    sector: "Energy",
    exposure: 55000,
    compliant: true,
  },
  {
    id: 8,
    name: "Harbour Logistics",
    score: 51,
    firewallCount: 7,
    daysSinceAssessment: 35,
    criticalFindings: 7,
    sector: "Logistics",
    exposure: 230000,
    compliant: false,
  },
  {
    id: 9,
    name: "InfoSec Academy",
    score: 88,
    firewallCount: 5,
    daysSinceAssessment: 14,
    criticalFindings: 1,
    sector: "Education",
    exposure: 32000,
    compliant: true,
  },
  {
    id: 10,
    name: "JurisTech Legal",
    score: 29,
    firewallCount: 3,
    daysSinceAssessment: 91,
    criticalFindings: 15,
    sector: "Legal",
    exposure: 510000,
    compliant: false,
  },
];

const TREND_DATA = [
  { month: "Oct", score: 56 },
  { month: "Nov", score: 59 },
  { month: "Dec", score: 61 },
  { month: "Jan", score: 58 },
  { month: "Feb", score: 64 },
  { month: "Mar", score: 67 },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Letter + colour — same bands as saved assessments (`assessment-cloud` / `gradeForScore`). */
function gradeFromNumericScore(score: number): { letter: Grade; color: string } {
  const letter = gradeForScore(score);
  return { letter, color: GRADE_COLORS[letter] };
}

function formatGBP(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}K`;
  return `£${n}`;
}

const SECTOR_DOT_COLORS: Record<string, string> = {
  Manufacturing: "#8b5cf6",
  Education: "#06b6d4",
  Healthcare: "#10b981",
  Finance: "#f59e0b",
  Government: "#ec4899",
  Retail: "#ef4444",
  Energy: "#84cc16",
  Logistics: "#6366f1",
  Legal: "#64748b",
  default: "#2006F7",
};

/* ------------------------------------------------------------------ */
/*  Trend chart                                                       */
/* ------------------------------------------------------------------ */

function TrendChart({ data }: { data: { month: string; score: number }[] }) {
  const w = 480;
  const h = 200;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;

  if (data.length === 0) {
    return (
      <EmptyState
        className="min-h-[200px] py-10"
        icon={<TrendingUp className="h-6 w-6 text-muted-foreground/50" />}
        title="No trend data yet"
        description="Score history will appear after assessments are recorded for your organisation."
      />
    );
  }

  const minS = Math.min(...data.map((d) => d.score)) - 5;
  const maxS = Math.max(...data.map((d) => d.score)) + 5;
  const spanY = Math.max(1, maxS - minS);
  const xDenom = Math.max(1, data.length - 1);

  const x = (i: number) => pad.left + (i / xDenom) * iw;
  const y = (s: number) => pad.top + ((maxS - s) / spanY) * ih;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.score)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${h - pad.bottom} L${x(0)},${h - pad.bottom} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2006F7" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#2006F7" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke="#2006F7" strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.month}>
          <circle cx={x(i)} cy={y(d.score)} r={4} fill="#2006F7" stroke="#fff" strokeWidth="2" />
          <text
            x={x(i)}
            y={h - pad.bottom + 18}
            fontSize="11"
            fill="currentColor"
            opacity={0.5}
            textAnchor="middle"
          >
            {d.month}
          </text>
          <text
            x={x(i)}
            y={y(d.score) - 10}
            fontSize="10"
            fill="currentColor"
            opacity={0.6}
            textAnchor="middle"
          >
            {d.score}
          </text>
        </g>
      ))}
      <text
        x={14}
        y={pad.top + ih / 2}
        fontSize="10"
        fill="currentColor"
        opacity={0.4}
        textAnchor="middle"
        transform={`rotate(-90,14,${pad.top + ih / 2})`}
      >
        Score
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

const glassCard =
  "relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/80 dark:bg-card/95 backdrop-blur-xl shadow-card";

function heatLevelClass(v: number) {
  if (v <= 0) return "bg-muted/50";
  if (v === 1) return "bg-emerald-600/25";
  if (v === 2) return "bg-emerald-500/40";
  if (v === 3) return "bg-emerald-500/60";
  return "bg-emerald-400/80";
}

type PortfolioDataMode = "guest_demo" | "org_live" | "org_empty";

function PortfolioInsightsInner() {
  const { user, org, isGuest } = useAuth();
  void user;

  const [portfolio, setPortfolio] = useState<Customer[]>(DEMO_PORTFOLIO);
  const [trendData, setTrendData] = useState(TREND_DATA);
  const [portfolioDataMode, setPortfolioDataMode] = useState<PortfolioDataMode>("guest_demo");
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D" | "12M" | "Custom">("30D");
  const [matrixCustomer, setMatrixCustomer] = useState<Customer | null>(null);
  const [dismissedRecIds, setDismissedRecIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!org?.id) {
      setPortfolio(DEMO_PORTFOLIO);
      setTrendData(TREND_DATA);
      setPortfolioDataMode("guest_demo");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [assessRes, historyEntries] = await Promise.all([
          supabase
            .from("assessments")
            .select("*")
            .eq("org_id", org.id)
            .order("created_at", { ascending: false }),
          loadScoreHistoryForFleet(org.id),
        ]);
        if (cancelled) return;

        const assessments = assessRes.data ?? [];
        const orgName = org.name ?? "";

        // One row per logical customer: merge "(This tenant)", "Unnamed", empty, etc. to org name
        // (same rules as Customer Management / Fleet) so single-tenant orgs do not get duplicate rows.
        const byCustomer = new Map<string, (typeof assessments)[number]>();
        for (const a of assessments) {
          const key = resolveCustomerName(a.customer_name ?? "", orgName);
          if (!byCustomer.has(key)) byCustomer.set(key, a);
        }

        if (byCustomer.size > 0) {
          const mapped = Array.from(byCustomer.entries()).map(([name, a], i) => {
            const fws = a.firewalls as Array<unknown> | null;
            const daysSince = Math.floor(
              (Date.now() - new Date(a.created_at).getTime()) / 86_400_000,
            );
            const exposure = Math.round((100 - a.overall_score) * 3400);
            return {
              id: i + 1,
              name,
              score: a.overall_score,
              firewallCount: Array.isArray(fws) ? fws.length : 1,
              daysSinceAssessment: daysSince,
              criticalFindings: 0,
              sector: a.environment || "Private Sector",
              exposure,
              compliant: a.overall_score >= 60,
            };
          });
          setPortfolio(mapped);
          setPortfolioDataMode("org_live");
        } else {
          setPortfolio([]);
          setPortfolioDataMode("org_empty");
        }

        if (historyEntries.length > 0) {
          const byMonth = new Map<string, number[]>();
          for (const e of historyEntries) {
            const d = new Date(e.assessed_at);
            const key = d.toLocaleDateString("en-GB", { month: "short" });
            const arr = byMonth.get(key) ?? [];
            arr.push(e.overall_score);
            byMonth.set(key, arr);
          }
          const trend = Array.from(byMonth.entries()).map(([month, scores]) => ({
            month,
            score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          }));
          setTrendData(trend.length > 0 ? trend : []);
        } else {
          setTrendData([]);
        }
      } catch (err) {
        console.warn("[PortfolioInsights] load failed", err);
        if (!cancelled) {
          setPortfolio([]);
          setTrendData([]);
          setPortfolioDataMode("org_empty");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  const totalCustomers = portfolio.length;
  const avgScore = useMemo(
    () =>
      totalCustomers > 0
        ? Math.round(portfolio.reduce((s, c) => s + c.score, 0) / totalCustomers)
        : 0,
    [portfolio, totalCustomers],
  );
  const avgGrade = useMemo(() => gradeFromNumericScore(avgScore), [avgScore]);
  const totalExposure = useMemo(() => portfolio.reduce((s, c) => s + c.exposure, 0), [portfolio]);
  const complianceRate = useMemo(
    () =>
      totalCustomers > 0
        ? Math.round((portfolio.filter((c) => c.compliant).length / totalCustomers) * 100)
        : 0,
    [portfolio, totalCustomers],
  );
  const atRiskCustomers = useMemo(
    () => [...portfolio].sort((a, b) => a.score - b.score),
    [portfolio],
  );
  const staleCustomers = useMemo(
    () =>
      portfolio
        .filter((c) => c.daysSinceAssessment >= 30)
        .sort((a, b) => b.daysSinceAssessment - a.daysSinceAssessment),
    [portfolio],
  );
  const belowTargetCount = useMemo(() => portfolio.filter((c) => c.score < 60).length, [portfolio]);
  const portfolioLowest = useMemo(() => {
    if (portfolio.length === 0) return { name: null as string | null, score: 0 };
    const sorted = [...portfolio].sort((a, b) => a.score - b.score);
    return { name: sorted[0].name, score: sorted[0].score };
  }, [portfolio]);
  const sectorAverages = useMemo(() => {
    const map: Record<string, number[]> = {};
    portfolio.forEach((c) => {
      if (!map[c.sector]) map[c.sector] = [];
      map[c.sector].push(c.score);
    });
    return Object.entries(map).map(([sector, scores]) => ({
      sector,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));
  }, [portfolio]);

  const threatDays =
    timeRange === "7D" ? 7 : timeRange === "90D" ? 30 : timeRange === "12M" ? 30 : 30;
  const threatSlice = useMemo(
    () => MOCK_THREAT_ACTIVITY.slice(-Math.min(threatDays, MOCK_THREAT_ACTIVITY.length)),
    [threatDays],
  );

  const stackedCategoryRow = useMemo(() => {
    const row: Record<string, string | number> = { name: "30d" };
    for (const c of MOCK_THREAT_CATEGORIES) row[c.name] = c.value;
    return [row];
  }, []);

  const scatterData = useMemo(
    () =>
      portfolio.map((c) => ({
        id: c.id,
        name: c.name,
        devices: c.firewallCount,
        risk: Math.max(4, Math.min(96, 100 - c.score)),
        alertCount: Math.max(2, c.criticalFindings * 5 + c.firewallCount),
        sector: c.sector,
        topFinding:
          c.criticalFindings >= 8
            ? "Multiple critical findings"
            : c.criticalFindings >= 4
              ? "Elevated critical count"
              : "Review alignment with target posture",
        score: c.score,
      })),
    [portfolio],
  );

  const scatterClick = useCallback(
    (e: { payload?: { id?: number } } | undefined) => {
      const id = e?.payload?.id;
      if (typeof id !== "number") return;
      const c = portfolio.find((x) => x.id === id);
      if (c) setMatrixCustomer(c);
    },
    [portfolio],
  );

  const showIllustrativeCharts =
    portfolioDataMode === "guest_demo" || portfolioDataMode === "org_live";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <FireComplyWorkspaceHeader loginShell={isGuest} />

      <WorkspacePrimaryNav />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading portfolio data…
        </div>
      )}

      <main
        className={`mx-auto max-w-7xl space-y-8 px-6 pt-8 assist-chrome-pad-bottom ${loading ? "hidden" : ""}`}
        data-tour="tour-page-insights"
      >
        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
          data-tour="tour-ins-header"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Security Intelligence
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Trends, patterns, and actionable insights across your entire customer base
              </p>
            </div>
          </div>
        </div>

        {!loading && portfolioDataMode === "guest_demo" ? (
          <Alert className="border-border/60 bg-muted/40">
            <Info className="h-4 w-4" />
            <AlertTitle>Demo portfolio</AlertTitle>
            <AlertDescription>
              You are not signed in to an organisation, or no org is selected. The customers,
              scores, and matrix below are sample data. Sign in to load real saved assessments.
            </AlertDescription>
          </Alert>
        ) : null}

        {!loading && portfolioDataMode === "org_empty" ? (
          <Alert className="border-amber-500/35 bg-amber-500/[0.08] dark:bg-amber-950/25">
            <Info className="h-4 w-4 text-amber-800 dark:text-amber-300" />
            <AlertTitle>No saved assessments in this organisation</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                Insights builds customer KPIs and charts from assessment records saved to your
                workspace. Until at least one assessment exists, totals stay at zero and there is
                nothing to plot. Illustrative threat and compliance visuals are hidden here so they
                are not mistaken for your telemetry.
              </p>
              <Button type="button" size="sm" asChild>
                <Link to="/">Open Assess</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {!loading && portfolioDataMode === "org_live" ? (
          <Alert className="border-sky-500/30 bg-sky-500/[0.06] dark:bg-sky-950/25">
            <Info className="h-4 w-4 text-sky-800 dark:text-sky-300" />
            <AlertTitle>What is live vs sample on this page</AlertTitle>
            <AlertDescription>
              Customer counts, scores, exposure, compliance rate, risk matrix, sector breakdown,
              portfolio trend (from score history), and at-risk tables reflect your saved
              assessments. Threat landscape, compliance trend lines, report activity heatmap, and
              recommendation cards are still mock visualisations — they do not pull Sophos Central
              alerts or SIEM data yet.
            </AlertDescription>
          </Alert>
        ) : null}

        <div data-tour="tour-ins-risk-strip">
          <PortfolioRiskStrip
            customerCount={totalCustomers}
            belowTargetCount={belowTargetCount}
            staleCount={staleCustomers.length}
            lowestScore={portfolioLowest.score}
            lowestName={portfolioLowest.name}
          />
        </div>
        {org?.id && !isGuest && (
          <div data-tour="tour-ins-settings">
            <WorkspaceSettingsStrip variant="insights" />
          </div>
        )}

        {showIllustrativeCharts ? (
          <>
            <div className="flex flex-wrap gap-2" data-tour="tour-ins-time-range">
              {(["7D", "30D", "90D", "12M", "Custom"] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={timeRange === p ? "default" : "outline"}
                  className="h-9 rounded-full px-4"
                  onClick={() => setTimeRange(p)}
                >
                  {p === "Custom" ? "Custom" : p}
                </Button>
              ))}
            </div>

            {/* ---- Threat landscape ---- */}
            <section className={glassCard + " overflow-hidden"} data-tour="tour-ins-threat">
              <div className="border-b border-border/40 px-6 py-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#2006F7]" />
                  Threat landscape
                </h2>
                <p className="text-sm text-muted-foreground">
                  Modelled traffic mix for the selected window (demo series).
                </p>
              </div>
              <div className="grid gap-6 p-4 lg:grid-cols-3 lg:p-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="h-[240px] w-full min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={threatSlice}>
                        <defs>
                          <linearGradient id="insThreatFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2006F7" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#2006F7" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          className="text-muted-foreground"
                        />
                        <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 12,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="blocked"
                          name="Blocked"
                          stroke="#2006F7"
                          fill="url(#insThreatFill)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-[200px] w-full min-h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stackedCategoryRow} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={40} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 12,
                          }}
                        />
                        <Legend />
                        {MOCK_THREAT_CATEGORIES.map((c, i) => (
                          <Bar
                            key={c.name}
                            dataKey={c.name}
                            stackId="t"
                            fill={["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"][i % 4]}
                            radius={[0, 4, 4, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ListOrdered className="h-4 w-4" />
                    Top threat types
                  </h3>
                  <ul className="space-y-3">
                    {MOCK_TOP_THREAT_TYPES.map((t) => (
                      <li key={t.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{t.name}</span>
                          <span className="tabular-nums text-muted-foreground">{t.pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#2006F7]/80"
                            style={{ width: `${t.pct}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* ---- Compliance trends ---- */}
            <section className={glassCard + " overflow-hidden"}>
              <div className="border-b border-border/40 px-6 py-4">
                <h2 className="text-lg font-semibold">Compliance trends</h2>
                <p className="text-sm text-muted-foreground">
                  Average framework scores over time (illustrative — not your assessed frameworks).
                </p>
              </div>
              <div className="grid gap-6 p-4 lg:grid-cols-2 lg:p-6">
                <div className="h-[260px] min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={MOCK_COMPLIANCE_SERIES}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis domain={[60, 90]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="gdpr"
                        name="GDPR"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="hipaa"
                        name="HIPAA"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="nist"
                        name="NIST"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="pci"
                        name="PCI-DSS"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Report generation activity</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    GitHub-style intensity (demo).
                  </p>
                  <div className="flex gap-1 flex-col">
                    {MOCK_REPORT_HEATMAP_WEEKS.map((week, wi) => (
                      <div key={wi} className="flex gap-1">
                        {week.map((v, di) => (
                          <div
                            key={di}
                            className={cn("h-3.5 w-3.5 rounded-sm", heatLevelClass(v))}
                            title={`Activity level ${v}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : null}

        <div className="space-y-8" data-tour="tour-ins-widgets">
          {/* ---- Executive KPIs ---- */}
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className={glassCard + " p-5"}>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4 text-[#2006F7]" />
                Total Customers
              </div>
              <p className="text-3xl font-extrabold tracking-tight">{totalCustomers}</p>
            </div>

            <div className={glassCard + " p-5"}>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Shield className="h-4 w-4 text-[#00EDFF]" />
                Fleet Average Score
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-extrabold tracking-tight">{avgScore}</p>
                <span
                  className="rounded-lg px-2.5 py-0.5 text-sm font-bold"
                  style={{ backgroundColor: avgGrade.color + "22", color: avgGrade.color }}
                >
                  {avgGrade.letter}
                </span>
              </div>
            </div>

            <div className={glassCard + " p-5"}>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <DollarSign className="h-4 w-4 text-[#EA0022]" />
                Total Exposure
              </div>
              <p className="text-3xl font-extrabold tracking-tight text-[#EA0022]">
                {formatGBP(totalExposure)}
              </p>
            </div>

            <div className={glassCard + " p-5"}>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BarChart3 className="h-4 w-4 text-[#00F2B3]" />
                Compliance Rate
              </div>
              <p className="text-3xl font-extrabold tracking-tight">{complianceRate}%</p>
            </div>
          </section>

          {/* ---- Customer risk matrix ---- */}
          <section className={glassCard + " overflow-hidden"}>
            <div className="border-b border-border/40 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <PieChart className="h-5 w-5 text-[#2006F7]" />
                Customer risk matrix
              </h2>
              <p className="text-sm text-muted-foreground">
                X: devices · Y: risk score (higher = worse) · Size ∝ alert weight · Colour = sector.
                Click a point for detail.
              </p>
            </div>
            <div className="h-[400px] w-full min-h-[320px] px-2 py-4">
              {scatterData.length === 0 ? (
                <EmptyState
                  className="min-h-[280px] py-16"
                  icon={<PieChart className="h-6 w-6 text-muted-foreground/50" />}
                  title="No customers to plot"
                  description="Save at least one assessment for this organisation to see points on the risk matrix."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis
                      type="number"
                      dataKey="devices"
                      name="Devices"
                      tick={{ fontSize: 11 }}
                      label={{ value: "Devices", position: "bottom", offset: 0, fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="risk"
                      name="Risk"
                      tick={{ fontSize: 11 }}
                      label={{
                        value: "Risk score",
                        angle: -90,
                        position: "insideLeft",
                        fontSize: 11,
                      }}
                    />
                    <ZAxis type="number" dataKey="alertCount" range={[80, 400]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const p = payload[0].payload as (typeof scatterData)[0];
                        return (
                          <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                            <p className="font-semibold">{p.name}</p>
                            <p className="text-muted-foreground">
                              Risk {p.risk} · Devices {p.devices} · {p.topFinding}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Scatter name="Customers" data={scatterData} onClick={(d) => scatterClick(d)}>
                      {scatterData.map((e, i) => (
                        <Cell
                          key={i}
                          fill={SECTOR_DOT_COLORS[e.sector] ?? SECTOR_DOT_COLORS.default}
                          className="cursor-pointer"
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>

        {showIllustrativeCharts ? (
          <section className={glassCard + " overflow-hidden"}>
            <div className="border-b border-border/40 px-6 py-4">
              <h2 className="text-lg font-semibold">Recommendations</h2>
              <p className="text-sm text-muted-foreground">
                Illustrative action cards (demo) — not generated from your current assessment rows.
              </p>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {MOCK_RECOMMENDATIONS.filter((r) => !dismissedRecIds.has(r.id)).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col rounded-xl border border-border/50 bg-muted/20 p-4 gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-bold rounded-md border px-2 py-0.5",
                        r.priority === "P1" &&
                          "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
                        r.priority === "P2" &&
                          "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
                        r.priority === "P3" && "border-border bg-muted/50 text-muted-foreground",
                      )}
                    >
                      {r.priority}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {r.effort} effort
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground">{r.customer}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">{r.text}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs" asChild>
                      <Link to="/playbooks">Playbook</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => setDismissedRecIds((prev) => new Set(prev).add(r.id))}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ---- Score trend + Sector breakdown row ---- */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <section className={glassCard + " lg:col-span-3 overflow-hidden"}>
            <div className="border-b border-border/40 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <TrendingUp className="h-5 w-5 text-[#2006F7]" />
                Portfolio Score Trend
              </h2>
              <p className="text-sm text-muted-foreground">Average score over the last 6 months</p>
            </div>
            <div className="px-4 py-6">
              <TrendChart data={trendData} />
            </div>
          </section>

          <section className={glassCard + " lg:col-span-2 overflow-hidden"}>
            <div className="border-b border-border/40 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="h-5 w-5 text-[#F29400]" />
                Sector Breakdown
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5">
              {sectorAverages.length === 0 ? (
                <p className="col-span-2 text-sm text-muted-foreground py-6 text-center">
                  Sector averages appear when saved assessments include environment or sector
                  context.
                </p>
              ) : (
                sectorAverages.map(({ sector, avg }) => {
                  const g = gradeFromNumericScore(avg);
                  return (
                    <div
                      key={sector}
                      className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/30 px-4 py-3"
                    >
                      <span className="text-sm font-medium">{sector}</span>
                      <span className="text-sm font-bold" style={{ color: g.color }}>
                        {avg}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* ---- At-risk customers table ---- */}
        <section className={glassCard + " overflow-hidden"}>
          <div className="border-b border-border/40 px-6 py-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="h-5 w-5 text-[#EA0022]" />
              At-Risk Customers
            </h2>
            <p className="text-sm text-muted-foreground">
              Every customer, sorted by lowest score first. Grades match saved assessments (A≥90,
              B≥75, C≥60, D≥40). <span className="font-medium text-foreground">Action needed</span>{" "}
              when score is under 60, last assessment over 30 days ago, or five or more critical
              findings.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-4 py-3 text-center">Score</th>
                  <th className="px-4 py-3 text-center">Grade</th>
                  <th className="px-4 py-3 text-center">Days Since Assessment</th>
                  <th className="px-4 py-3 text-center">Critical Findings</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {atRiskCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                    >
                      No customers yet — save assessments to populate this table.
                    </td>
                  </tr>
                ) : (
                  atRiskCustomers.map((c) => {
                    const g = gradeFromNumericScore(c.score);
                    const needsAction =
                      c.score < 60 || c.daysSinceAssessment > 30 || c.criticalFindings >= 5;
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border/20 transition-colors hover:bg-muted/40"
                      >
                        <td className="px-6 py-3.5 font-medium">{c.name}</td>
                        <td className="px-4 py-3.5 text-center font-semibold">{c.score}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
                            style={{ backgroundColor: g.color + "22", color: g.color }}
                          >
                            {g.letter}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={
                              c.daysSinceAssessment >= 30 ? "font-semibold text-[#F29400]" : ""
                            }
                          >
                            {c.daysSinceAssessment}d
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={
                              c.criticalFindings >= 5 ? "font-semibold text-[#EA0022]" : ""
                            }
                          >
                            {c.criticalFindings}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {needsAction ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#EA0022]/10 px-3 py-1 text-xs font-semibold text-[#EA0022]">
                              <AlertTriangle className="h-3 w-3" />
                              Action Needed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#00F2B3]/10 px-3 py-1 text-xs font-semibold text-[#007A5A] dark:text-[#00F2B3]">
                              <Shield className="h-3 w-3" />
                              Healthy
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Stale assessment alerts ---- */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5 text-[#F29400]" />
            Stale Assessment Alerts
          </h2>
          {staleCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No customers with assessments older than 30 days — or no assessment data yet.
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {staleCustomers.map((c) => (
              <div key={c.id} className={glassCard + " flex flex-col gap-4 p-5"}>
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Last assessed{" "}
                    <span className="font-semibold text-[#F29400]">
                      {c.daysSinceAssessment} days ago
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    Send Reminder
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    Generate Upload Link
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Sheet open={matrixCustomer !== null} onOpenChange={(o) => !o && setMatrixCustomer(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {matrixCustomer ? (
            <>
              <SheetHeader>
                <SheetTitle>{matrixCustomer.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Security score{" "}
                  <span className="font-semibold text-foreground">{matrixCustomer.score}</span> ·
                  Devices <span className="font-mono">{matrixCustomer.firewallCount}</span> · Risk
                  index <span className="font-mono">{100 - matrixCustomer.score}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Top finding: </span>
                  {matrixCustomer.criticalFindings >= 5
                    ? "Multiple critical findings need triage."
                    : "Review firewall posture against latest assessment."}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild size="sm">
                    <Link
                      to={`/?${new URLSearchParams({ customer: matrixCustomer.name }).toString()}`}
                    >
                      Open Assess
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to={`/command?${new URLSearchParams({ customer: matrixCustomer.name }).toString()}`}
                    >
                      Fleet
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function PortfolioInsights() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <PortfolioInsightsInner />
    </AuthProvider>
  );
}
