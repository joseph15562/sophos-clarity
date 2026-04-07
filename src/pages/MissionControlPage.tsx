import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  FileText,
  LayoutDashboard,
  Plus,
  Shield,
  Users,
} from "lucide-react";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { useMissionControlLiveQuery } from "@/hooks/queries/use-mission-control-live-query";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import { Button } from "@/components/ui/button";
import { useResolvedIsDark } from "@/hooks/use-resolved-appearance";
import { useCountUp } from "@/hooks/use-count-up";
import {
  MOCK_ALERT_SPARKLINE,
  MOCK_CUSTOMER_SPARKLINE,
  MOCK_DEVICE_SPARKLINE,
  MOCK_FLEET_HEALTH,
  MOCK_MISSION_ALERTS,
  MOCK_RECENT_DOCS,
  MOCK_THREAT_ACTIVITY,
  MOCK_TOP_RISK_CUSTOMERS,
  type MissionAlertRow,
  type ThreatActivityDay,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type McThreatTooltipVariant = "demo" | "central" | "assessments";

type McThreatTooltipPayload = ReadonlyArray<{
  dataKey?: string | number;
  value?: number;
  color?: string;
  payload?: unknown;
}>;

function MissionThreatActivityTooltip({
  active,
  payload,
  label,
  variant,
}: {
  active?: boolean;
  payload?: McThreatTooltipPayload;
  label?: string;
  variant: McThreatTooltipVariant;
}) {
  if (!active || !payload?.length) return null;

  if (variant === "assessments") {
    const row = payload[0]?.payload as ThreatActivityDay | undefined;
    const n = row?.blocked ?? 0;
    return (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-[var(--shadow-elevated)] max-w-[260px]">
        <p className="font-medium text-foreground mb-1">{label}</p>
        <p className="tabular-nums text-primary">
          <span className="text-muted-foreground">Assessment runs</span>: {n}
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
          Count of new rows in your org&apos;s{" "}
          <span className="text-foreground/80">assessments</span> table for this day — not threats
          blocked on the firewall.
        </p>
      </div>
    );
  }

  const keyLabels =
    variant === "demo"
      ? { blocked: "Blocked threats", ips: "IPS triggers", web: "Web filter hits" }
      : { blocked: "Other / firewall", ips: "IPS / threat", web: "Web / filter" };

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-[var(--shadow-elevated)]">
      <p className="font-medium text-foreground mb-1.5">{label}</p>
      <ul className="space-y-0.5">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? "");
          const name = keyLabels[key as keyof typeof keyLabels] ?? key;
          return (
            <li key={key} className="flex justify-between gap-6 tabular-nums">
              <span style={{ color: entry.color }}>{name}</span>
              <span className="text-foreground">{entry.value ?? 0}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SEVERITY_STYLES: Record<MissionAlertRow["severity"], string> = {
  CRITICAL: "bg-destructive/15 text-destructive border-destructive/30",
  HIGH: "bg-[hsl(var(--severity-high))]/12 text-[hsl(var(--severity-high))] border-[hsl(var(--severity-high))]/25",
  MEDIUM:
    "bg-[hsl(var(--severity-medium))]/12 text-[hsl(var(--severity-medium))] border-[hsl(var(--severity-medium))]/25",
  LOW: "bg-muted text-muted-foreground border-border",
};

/** Matches workspace hub cards (Customers, Reports) with a subtle top accent. */
const mcPanel =
  "relative overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-[var(--shadow-card)] transition-[box-shadow,border-color] before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:rounded-full before:bg-gradient-to-r before:from-transparent before:via-primary/40 before:to-transparent dark:border-border/70 dark:shadow-[0_0_0_1px_hsl(var(--border)/0.35)] dark:hover:border-primary/25";
const mcPanelHover = "hover:border-primary/30 hover:shadow-[var(--shadow-elevated)]";

function safeDistanceToNow(iso: string): string {
  if (!iso.trim()) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  return formatDistanceToNow(t, { addSuffix: true });
}

function MiniSparkline({
  data,
  color,
  idSuffix,
}: {
  data: { day: string; value: number }[];
  color: string;
  idSuffix: string;
}) {
  const chartData = useMemo(() => data.map((d, i) => ({ i, v: d.value })), [data]);
  return (
    <div className="h-12 w-full mt-2 opacity-90">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComplianceRing({ pct }: { pct: number }) {
  const v = useCountUp(pct, { durationMs: 900 });
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (v / 100) * circumference;
  return (
    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80" aria-hidden>
        <circle cx="40" cy="40" r="36" className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r="36"
          className="fill-none stroke-primary transition-all duration-300"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums text-primary">{v}%</span>
    </div>
  );
}

function MissionControlInner() {
  const { org, isGuest } = useAuth();
  const isDark = useResolvedIsDark();

  const useDemo = !org?.id || isGuest;
  const live = useMissionControlLiveQuery(org?.id, org?.name, Boolean(org?.id && !isGuest));

  const customersN = useCountUp(useDemo ? 47 : live.kpisReady ? live.customersCount : 0, {});
  const devicesN = useCountUp(useDemo ? 1284 : live.kpisReady ? live.devicesCount : 0, {});
  const criticalN = useCountUp(useDemo ? 12 : live.kpisReady ? live.criticalAlertsCount : 0, {});
  const complianceTarget = useDemo ? 87 : live.complianceSample > 0 ? live.complianceAvg : 0;

  const customerSpark = useDemo ? MOCK_CUSTOMER_SPARKLINE : live.customerSparkline;
  const deviceSpark = useDemo ? MOCK_DEVICE_SPARKLINE : live.deviceSparkline;
  const alertSpark = useDemo ? MOCK_ALERT_SPARKLINE : live.alertSparkline;
  const threatData = useDemo ? MOCK_THREAT_ACTIVITY : live.threatActivity;
  const missionAlerts = useDemo ? MOCK_MISSION_ALERTS : live.missionAlerts;
  const topRiskData = useDemo ? MOCK_TOP_RISK_CUSTOMERS : live.topRiskCustomers;
  const fleetHealthData = useDemo ? MOCK_FLEET_HEALTH : live.fleetHealth;
  const recentDocs = useDemo ? MOCK_RECENT_DOCS : live.recentDocs;

  const fleetTotal = fleetHealthData.reduce((s, x) => s + x.value, 0);

  const threatTooltipVariant: McThreatTooltipVariant = useDemo
    ? "demo"
    : live.threatChartSource === "central"
      ? "central"
      : "assessments";
  const assessOnlyChart = !useDemo && live.threatChartSource === "assessments";

  const chartUi = useMemo(
    () =>
      isDark
        ? {
            grid: "hsl(215 40% 26%)",
            tick: "hsl(210 20% 58%)",
            tooltipBg: "hsl(215 60% 14%)",
            tooltipBorder: "hsl(215 40% 28%)",
            tooltipFg: "hsl(210 20% 92%)",
            barCursor: "rgba(255,255,255,0.05)",
          }
        : {
            grid: "hsl(214 24% 88%)",
            tick: "hsl(214 28% 42%)",
            tooltipBg: "hsl(0 0% 100%)",
            tooltipBorder: "hsl(214 24% 84%)",
            tooltipFg: "hsl(215 52% 14%)",
            barCursor: "rgba(32, 6, 247, 0.08)",
          },
    [isDark],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <FireComplyWorkspaceHeader loginShell={isGuest} />

      <WorkspacePrimaryNav
        pageActions={
          <Button size="sm" className="gap-1.5 shadow-sm" asChild>
            <Link to="/">New assessment</Link>
          </Button>
        }
      />

      <main
        id="main-content"
        className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 space-y-6 animate-in fade-in duration-200 assist-chrome-pad-bottom"
        data-tour="tour-page-mission-control"
      >
        <p className="-mt-1 text-xs text-muted-foreground">
          {org?.name ? `${org.name} · ` : ""}
          Workspace overview — live posture, fleet, and Central signals
        </p>
        {/* KPI row */}
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          data-tour="tour-mc-kpis"
        >
          <div className={cn(mcPanel, mcPanelHover, "p-4 pt-5")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Total customers
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{customersN}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {useDemo ? (
                    <>
                      <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(var(--success))]" /> +3 this
                      month
                    </>
                  ) : (
                    <span>{live.customerSubline}</span>
                  )}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <MiniSparkline data={customerSpark} color="hsl(var(--primary))" idSuffix="c" />
          </div>

          <div className={cn(mcPanel, mcPanelHover, "p-4 pt-5")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Fleet devices
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{devicesN}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {useDemo ? (
                    <>
                      <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(var(--success))]" /> Trending
                      up
                    </>
                  ) : (
                    <span>{live.deviceSubline}</span>
                  )}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--severity-info))]/15 text-[hsl(var(--severity-info))]">
                <Shield className="h-5 w-5" />
              </div>
            </div>
            <MiniSparkline data={deviceSpark} color="hsl(var(--severity-info))" idSuffix="d" />
          </div>

          <div
            className={cn(
              mcPanel,
              mcPanelHover,
              "p-4 pt-5 ring-1 ring-destructive/20 border-destructive/25 dark:ring-destructive/30",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Critical alerts
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-destructive">{criticalN}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {useDemo ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-40" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                      </span>
                      <span className="text-destructive/90">Needs triage</span>
                    </>
                  ) : live.alertsLoading ? (
                    <span className="text-muted-foreground">Refreshing…</span>
                  ) : (
                    <span>{live.alertSubline}</span>
                  )}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <MiniSparkline data={alertSpark} color="hsl(var(--destructive))" idSuffix="a" />
          </div>

          <div className={cn(mcPanel, mcPanelHover, "p-4 pt-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Compliance score
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {useDemo ? (
                    <>
                      <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(var(--success))]" /> Portfolio
                      avg
                    </>
                  ) : (
                    <span>Directory aggregate</span>
                  )}
                </p>
              </div>
              <ComplianceRing pct={complianceTarget} />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {useDemo
                ? "Blended across assessed customers (demo aggregate)."
                : live.complianceFootnote}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className={cn(mcPanel, "p-4 pt-5 sm:p-5 sm:pt-6")} data-tour="tour-mc-activity">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Activity className="h-4 w-4" />
                  </span>
                  {useDemo || live.threatChartSource === "central"
                    ? "Threat activity"
                    : "Workspace activity"}
                </h2>
                <span className="text-[11px] text-muted-foreground">
                  {useDemo
                    ? "Last 30 days (demo)"
                    : live.threatChartSource === "central"
                      ? "Last 30 days · Sophos Central"
                      : "Last 30 days · assessments"}
                </span>
              </div>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={threatData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mcBlocked" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="mcIps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="mcWeb" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartUi.grid} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: chartUi.tick }}
                      stroke={chartUi.grid}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: chartUi.tick }}
                      stroke={chartUi.grid}
                      width={44}
                    />
                    <Tooltip
                      content={(props) => (
                        <MissionThreatActivityTooltip
                          active={props.active}
                          payload={props.payload as McThreatTooltipPayload | undefined}
                          label={props.label as string | undefined}
                          variant={threatTooltipVariant}
                        />
                      )}
                    />
                    <Area
                      type="monotone"
                      dataKey="blocked"
                      name={assessOnlyChart ? "Assessment runs" : undefined}
                      stackId={assessOnlyChart ? undefined : "1"}
                      stroke="#3b82f6"
                      fill="url(#mcBlocked)"
                    />
                    {!assessOnlyChart ? (
                      <>
                        <Area
                          type="monotone"
                          dataKey="ips"
                          stackId="2"
                          stroke="#06b6d4"
                          fill="url(#mcIps)"
                        />
                        <Area
                          type="monotone"
                          dataKey="web"
                          stackId="3"
                          stroke="#8b5cf6"
                          fill="url(#mcWeb)"
                        />
                      </>
                    ) : null}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                {useDemo ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500" /> Blocked threats
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-cyan-500" /> IPS triggers
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-violet-500" /> Web filter hits
                    </span>
                  </>
                ) : live.threatChartSource === "central" ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500" /> Other / firewall
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-cyan-500" /> IPS / threat
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-violet-500" /> Web / filter
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" /> Assessment runs (daily)
                  </span>
                )}
              </div>
            </div>

            <div className={cn(mcPanel, "overflow-hidden p-0")} data-tour="tour-mc-alerts">
              <div className="border-b border-border/80 bg-muted/30 px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold text-foreground">Recent alerts</h2>
                <p className="text-[11px] text-muted-foreground">
                  {useDemo
                    ? "Synthetic feed for layout — sign in to see Central alerts."
                    : live.alertsLoading
                      ? "Loading alerts from Sophos Central…"
                      : live.alertsRefreshing
                        ? "Updating alerts from Sophos Central…"
                        : live.hasCentralTenants
                          ? "Open alerts from Sophos Central (latest first)."
                          : "Sync Sophos Central tenants to load live alerts here."}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/80 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2 font-medium sm:px-5">Severity</th>
                      <th className="px-4 py-2 font-medium sm:px-5 min-w-[200px]">Alert</th>
                      <th className="px-4 py-2 font-medium sm:px-5">Customer</th>
                      <th className="px-4 py-2 font-medium sm:px-5">Device</th>
                      <th className="px-4 py-2 font-medium sm:px-5">Time</th>
                      <th className="px-4 py-2 font-medium sm:px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!useDemo && live.alertsLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center sm:px-5">
                          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
                            <span>Loading alerts from Sophos Central…</span>
                          </div>
                        </td>
                      </tr>
                    ) : missionAlerts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5"
                        >
                          {useDemo
                            ? "Demo alerts appear when browsing as a guest."
                            : "No alerts to show."}
                        </td>
                      </tr>
                    ) : (
                      missionAlerts.map((row) => (
                        <tr key={row.id} className="border-b border-border/50 hover:bg-muted/40">
                          <td className="px-4 py-2.5 sm:px-5">
                            <span
                              className={cn(
                                "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold",
                                SEVERITY_STYLES[row.severity],
                              )}
                            >
                              {row.severity}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-foreground sm:px-5 max-w-[min(420px,55vw)]">
                            <span
                              className="line-clamp-2 text-[13px] leading-snug"
                              title={row.summary}
                            >
                              {row.summary}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-foreground sm:px-5">{row.customer}</td>
                          <td
                            className="px-4 py-2.5 text-sm text-muted-foreground sm:px-5"
                            title={row.device}
                          >
                            {row.device}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground sm:px-5 tabular-nums">
                            {safeDistanceToNow(row.ts)}
                          </td>
                          <td className="px-4 py-2.5 text-right sm:px-5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary"
                              asChild
                            >
                              <Link to="/central/alerts">Investigate</Link>
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={cn(mcPanel, mcPanelHover, "p-4 pt-5")} data-tour="tour-mc-top-risk">
              <h2 className="text-sm font-semibold text-foreground mb-3">Top customers by risk</h2>
              <p className="text-[10px] text-muted-foreground mb-2">
                {useDemo
                  ? "Demo ranking"
                  : live.topRiskByCentralAlerts
                    ? "By Central alert count"
                    : "By posture score (lower = higher risk)"}
              </p>
              <div className="h-[200px]">
                {topRiskData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground px-2 text-center">
                    No ranking data yet — add customers or connect Central.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topRiskData} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartUi.grid}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: chartUi.tick }}
                        stroke={chartUi.grid}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 10, fill: chartUi.tick }}
                        stroke={chartUi.grid}
                      />
                      <Tooltip
                        cursor={{ fill: chartUi.barCursor }}
                        contentStyle={{
                          backgroundColor: chartUi.tooltipBg,
                          border: `1px solid ${chartUi.tooltipBorder}`,
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: chartUi.tooltipFg,
                        }}
                      />
                      <Bar
                        dataKey="alerts"
                        fill="hsl(var(--severity-medium))"
                        radius={[0, 4, 4, 0]}
                        isAnimationActive
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className={cn(mcPanel, mcPanelHover, "p-4 pt-5")} data-tour="tour-mc-fleet-health">
              <h2 className="text-sm font-semibold text-foreground mb-2">Fleet health</h2>
              <div className="h-[180px] flex items-center">
                {fleetTotal === 0 ? (
                  <p className="w-full text-center text-xs text-muted-foreground px-2">
                    {useDemo ? "No demo fleet slice." : "No fleet devices in your workspace yet."}
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fleetHealthData as unknown as Record<string, unknown>[]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        isAnimationActive
                      >
                        {fleetHealthData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartUi.tooltipBg,
                          border: `1px solid ${chartUi.tooltipBorder}`,
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: chartUi.tooltipFg,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <ul className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                {fleetHealthData.map((s) => (
                  <li key={s.name} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name} ({s.value})
                  </li>
                ))}
              </ul>
            </div>

            <div
              className={cn(mcPanel, mcPanelHover, "p-4 pt-5")}
              data-tour="tour-mc-quick-actions"
            >
              <h2 className="text-sm font-semibold text-foreground mb-3">Quick actions</h2>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/"
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/35 p-4 text-center transition-colors hover:border-primary/35 hover:bg-primary/5"
                >
                  <LayoutDashboard className="h-6 w-6 text-primary transition-transform group-hover:scale-105" />
                  <span className="text-xs font-medium text-foreground">New assessment</span>
                </Link>
                <Link
                  to="/reports"
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/35 p-4 text-center transition-colors hover:border-primary/35 hover:bg-primary/5"
                >
                  <FileText className="h-6 w-6 text-[hsl(var(--severity-info))] transition-transform group-hover:scale-105" />
                  <span className="text-xs font-medium text-foreground">Generate report</span>
                </Link>
                <Link
                  to="/customers"
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/35 p-4 text-center transition-colors hover:border-primary/35 hover:bg-primary/5"
                >
                  <Plus className="h-6 w-6 text-[hsl(var(--success))] transition-transform group-hover:scale-105" />
                  <span className="text-xs font-medium text-foreground">Add customer</span>
                </Link>
                <Link
                  to="/playbooks"
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/35 p-4 text-center transition-colors hover:border-primary/35 hover:bg-primary/5"
                >
                  <BookOpen className="h-6 w-6 text-[hsl(var(--brand-violet))] transition-transform group-hover:scale-105" />
                  <span className="text-xs font-medium text-foreground">Run playbook</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <section data-tour="tour-mc-recent-docs">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Recent documents</h2>
          {recentDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {useDemo
                ? "Demo report cards appear in guest mode."
                : "No saved reports yet — generate one from Assess or Reports."}
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {recentDocs.map((doc) => {
                const hasFirewall = doc.firewalls.trim() !== "" && doc.firewalls !== "—";
                const title = hasFirewall ? doc.firewalls : doc.customer;
                const titleTitle = hasFirewall ? doc.firewalls : doc.customer;
                return (
                  <div
                    key={doc.id}
                    className={cn(
                      mcPanel,
                      mcPanelHover,
                      "min-w-[240px] max-w-[280px] shrink-0 p-4 pt-5",
                    )}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {hasFirewall ? "Firewall" : "Customer"}
                    </p>
                    <p
                      className="font-semibold text-foreground text-sm line-clamp-2 mt-0.5"
                      title={titleTitle}
                    >
                      {title}
                    </p>
                    {hasFirewall ? (
                      <p
                        className="mt-1 text-[11px] text-muted-foreground line-clamp-1"
                        title={doc.customer}
                      >
                        {doc.customer}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {doc.date} · {doc.pages} {doc.pages === 1 ? "section" : "sections"}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-border bg-transparent"
                        asChild
                      >
                        <Link to={`/reports/saved/${doc.id}`}>View</Link>
                      </Button>
                      <Button size="sm" variant="secondary" className="h-7 text-xs" asChild>
                        <Link to="/reports">Library</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function MissionControlPage() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <MissionControlInner />
    </AuthProvider>
  );
}
