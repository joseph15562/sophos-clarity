import { useState, useEffect, useMemo } from "react";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { loadScoreHistoryForFleet } from "@/lib/score-history";
import { gradeForScore, GRADE_COLORS, type Grade } from "@/lib/design-tokens";
import { resolveCustomerName } from "@/lib/customer-name";
import { WorkspaceSettingsStrip } from "@/components/WorkspaceSettingsStrip";
import { EmptyState } from "@/components/EmptyState";
import {
  BarChart3,
  TrendingUp,
  ArrowLeft,
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
  Sun,
  Moon,
} from "lucide-react";

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

/* ------------------------------------------------------------------ */
/*  Scatter plot                                                      */
/* ------------------------------------------------------------------ */

const PLOT_W = 720;
const PLOT_H = 420;
const PAD = { top: 30, right: 30, bottom: 50, left: 55 };
const INNER_W = PLOT_W - PAD.left - PAD.right;
const INNER_H = PLOT_H - PAD.top - PAD.bottom;

function ScatterPlot({ customers }: { customers: Customer[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const xScale = (days: number) => PAD.left + (days / 120) * INNER_W;
  const yScale = (score: number) => PAD.top + ((100 - score) / 100) * INNER_H;
  const radius = (fw: number) => Math.max(8, Math.min(26, fw * 2.8));

  const midX = xScale(60);
  const midY = yScale(50);

  return (
    <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} className="w-full h-auto">
      {/* quadrant backgrounds */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={midX - PAD.left}
        height={midY - PAD.top}
        fill="rgba(0,242,179,0.06)"
      />
      <rect
        x={midX}
        y={PAD.top}
        width={PLOT_W - PAD.right - midX}
        height={midY - PAD.top}
        fill="rgba(242,148,0,0.06)"
      />
      <rect
        x={PAD.left}
        y={midY}
        width={midX - PAD.left}
        height={PLOT_H - PAD.bottom - midY}
        fill="rgba(242,148,0,0.06)"
      />
      <rect
        x={midX}
        y={midY}
        width={PLOT_W - PAD.right - midX}
        height={PLOT_H - PAD.bottom - midY}
        fill="rgba(234,0,34,0.06)"
      />

      {/* quadrant labels */}
      <text
        x={PAD.left + 8}
        y={PAD.top + 18}
        fontSize="10"
        fill="#00F2B3"
        fontWeight="600"
        opacity={0.8}
      >
        Low Risk / Current
      </text>
      <text
        x={PLOT_W - PAD.right - 8}
        y={PAD.top + 18}
        fontSize="10"
        fill="#F29400"
        fontWeight="600"
        opacity={0.8}
        textAnchor="end"
      >
        Low Risk / Stale
      </text>
      <text
        x={PAD.left + 8}
        y={PLOT_H - PAD.bottom - 8}
        fontSize="10"
        fill="#F29400"
        fontWeight="600"
        opacity={0.8}
      >
        High Risk / Current
      </text>
      <text
        x={PLOT_W - PAD.right - 8}
        y={PLOT_H - PAD.bottom - 8}
        fontSize="10"
        fill="#EA0022"
        fontWeight="600"
        opacity={0.8}
        textAnchor="end"
      >
        High Risk / Stale
      </text>

      {/* grid lines */}
      <line
        x1={midX}
        y1={PAD.top}
        x2={midX}
        y2={PLOT_H - PAD.bottom}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeDasharray="4 4"
      />
      <line
        x1={PAD.left}
        y1={midY}
        x2={PLOT_W - PAD.right}
        y2={midY}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeDasharray="4 4"
      />

      {/* axes */}
      <line
        x1={PAD.left}
        y1={PLOT_H - PAD.bottom}
        x2={PLOT_W - PAD.right}
        y2={PLOT_H - PAD.bottom}
        stroke="currentColor"
        strokeOpacity={0.25}
      />
      <line
        x1={PAD.left}
        y1={PAD.top}
        x2={PAD.left}
        y2={PLOT_H - PAD.bottom}
        stroke="currentColor"
        strokeOpacity={0.25}
      />

      {/* X ticks */}
      {[0, 30, 60, 90, 120].map((d) => (
        <text
          key={d}
          x={xScale(d)}
          y={PLOT_H - PAD.bottom + 20}
          fontSize="11"
          fill="currentColor"
          opacity={0.5}
          textAnchor="middle"
        >
          {d}d
        </text>
      ))}
      <text
        x={PAD.left + INNER_W / 2}
        y={PLOT_H - 6}
        fontSize="11"
        fill="currentColor"
        opacity={0.4}
        textAnchor="middle"
      >
        Days since last assessment
      </text>

      {/* Y ticks */}
      {[0, 25, 50, 75, 100].map((s) => (
        <text
          key={s}
          x={PAD.left - 10}
          y={yScale(s) + 4}
          fontSize="11"
          fill="currentColor"
          opacity={0.5}
          textAnchor="end"
        >
          {s}
        </text>
      ))}
      <text
        x={14}
        y={PAD.top + INNER_H / 2}
        fontSize="11"
        fill="currentColor"
        opacity={0.4}
        textAnchor="middle"
        transform={`rotate(-90,14,${PAD.top + INNER_H / 2})`}
      >
        Risk Score
      </text>

      {/* data points */}
      {customers.map((c) => {
        const cx = xScale(c.daysSinceAssessment);
        const cy = yScale(c.score);
        const r = radius(c.firewallCount);
        const g = gradeFromNumericScore(c.score);
        const isHovered = hovered === c.id;
        return (
          <g
            key={c.id}
            onMouseEnter={() => setHovered(c.id)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={g.color}
              fillOpacity={isHovered ? 0.9 : 0.55}
              stroke={g.color}
              strokeWidth={isHovered ? 2.5 : 1.2}
              strokeOpacity={0.8}
              style={{ transition: "all 0.2s" }}
            />
            <text x={cx} y={cy + 3} fontSize="9" fill="#fff" fontWeight="700" textAnchor="middle">
              {g.letter}
            </text>
            {isHovered && (
              <g>
                <rect
                  x={cx + r + 6}
                  y={cy - 32}
                  width={160}
                  height={52}
                  rx={8}
                  fill="rgba(0,0,0,0.85)"
                />
                <text x={cx + r + 14} y={cy - 14} fontSize="11" fill="#fff" fontWeight="600">
                  {c.name}
                </text>
                <text x={cx + r + 14} y={cy + 2} fontSize="10" fill="#ccc">
                  Score: {c.score} · {c.firewallCount} firewalls
                </text>
                <text x={cx + r + 14} y={cy + 14} fontSize="10" fill="#ccc">
                  {c.daysSinceAssessment}d ago · {c.criticalFindings} critical
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

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

function PortfolioInsightsInner() {
  const { user, org, isGuest } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  void user;

  const [portfolio, setPortfolio] = useState<Customer[]>(DEMO_PORTFOLIO);
  const [trendData, setTrendData] = useState(TREND_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) {
      setPortfolio(DEMO_PORTFOLIO);
      setTrendData(TREND_DATA);
      setLoading(false);
      return;
    }
    let cancelled = false;
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
        } else {
          setPortfolio([]);
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
          if (trend.length > 0) setTrendData(trend);
        }
      } catch (err) {
        console.warn("[PortfolioInsights] load failed", err);
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-40 border-b border-[#10037C]/20 bg-[radial-gradient(circle_at_top_left,rgba(0,237,255,0.10),transparent_18%),radial-gradient(circle_at_top_right,rgba(32,6,247,0.20),transparent_24%),linear-gradient(90deg,#00163d_0%,#001A47_42%,#10037C_100%)] shadow-panel backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <nav className="mb-3 flex items-center gap-2 text-xs text-white/50">
            <Link to="/" className="flex items-center gap-1 hover:text-white/80 transition-colors">
              <ArrowLeft className="h-3 w-3" />
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-white/80">Portfolio Intelligence</span>
          </nav>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                <PieChart className="h-5 w-5 text-[#00EDFF]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Portfolio Intelligence
                </h1>
                <p className="text-sm text-white/60">
                  Cross-customer risk analytics and strategic insights
                </p>
              </div>
            </div>
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
          </div>
        </div>
      </header>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading portfolio data…
        </div>
      )}

      <main className={`mx-auto max-w-7xl space-y-8 px-6 py-8 ${loading ? "hidden" : ""}`}>
        {org?.id && !isGuest && <WorkspaceSettingsStrip variant="insights" />}
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

        {/* ---- Scatter Plot (centrepiece) ---- */}
        <section className={glassCard + " overflow-hidden"}>
          <div className="border-b border-border/40 px-6 py-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5 text-[#2006F7]" />
              Portfolio Risk Scatter
            </h2>
            <p className="text-sm text-muted-foreground">
              Bubble size = firewall count · Colour = grade
            </p>
          </div>
          <div className="px-4 py-6">
            <ScatterPlot customers={portfolio} />
          </div>
        </section>

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
              {sectorAverages.map(({ sector, avg }) => {
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
              })}
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
                {atRiskCustomers.map((c) => {
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
                          className={c.criticalFindings >= 5 ? "font-semibold text-[#EA0022]" : ""}
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
                })}
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
