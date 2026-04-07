import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";
import { displayDeviceLabelForCentralAlert } from "@/lib/central-alert-display";
import { resolveCustomerName } from "@/lib/customer-name";
import {
  formatFirewallSummaryFromPackage,
  loadSavedReportsCloud,
  normalizeReportEntries,
} from "@/lib/saved-reports";
import { mapAlertToMissionControlAxes } from "@/lib/portfolio-threat-from-central";
import {
  centralAlertRaisedAt,
  getCachedFirewalls,
  getEffectiveTenantDisplayName,
  type MissionAlertsBundle,
} from "@/lib/sophos-central";
import { useMissionAlertsBundleQuery } from "./use-mission-alerts-bundle-query";
import { queryKeys } from "./keys";
import { useCustomerDirectoryQuery } from "./use-customer-directory-query";
import { useFleetCommandQuery } from "./use-fleet-command-query";
import type { FleetFirewall } from "@/lib/fleet-command-data";
import type {
  FleetHealthSlice,
  MissionAlertRow,
  RecentDocCard,
  SparklinePoint,
  ThreatActivityDay,
  TopRiskCustomer,
} from "@/lib/mock-data";

type CentralAlertRow = MissionAlertsBundle["items"][number];

/** YYYY-MM-DD when `iso` is a non-empty parseable date string; otherwise null (Central payloads can omit or garble dates). */
function parseIsoDateDay(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const trimmed = iso.trim();
  if (trimmed.length < 10) return null;
  const t = new Date(trimmed).getTime();
  if (Number.isNaN(t)) return null;
  return trimmed.slice(0, 10);
}

function bucketCountsByDay(timestamps: string[], days = 90): SparklinePoint[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, 0);
  for (const ts of timestamps) {
    const day = parseIsoDateDay(ts);
    if (!day || !counts.has(day)) continue;
    counts.set(day, counts.get(day)! + 1);
  }
  return keys.map((day) => ({ day, value: counts.get(day) ?? 0 }));
}

function mapSeverity(raw: string): MissionAlertRow["severity"] {
  const u = String(raw).toUpperCase();
  if (u.includes("CRITICAL")) return "CRITICAL";
  if (u.includes("HIGH")) return "HIGH";
  if (u.includes("MEDIUM")) return "MEDIUM";
  return "LOW";
}

function isHighTriageSeverity(raw: string): boolean {
  const s = mapSeverity(raw);
  return s === "CRITICAL" || s === "HIGH";
}

/** One-line alert summary for tables (Central description, category, product). */
function alertSummary(a: CentralAlertRow): string {
  const desc = (a.description ?? "").trim();
  if (desc) return desc.length > 160 ? `${desc.slice(0, 157)}…` : desc;
  const cat = (a.category ?? "").trim();
  const prod = (a.product ?? "").trim();
  if (cat && prod) return `${prod} · ${cat}`;
  return cat || prod || "Open alert";
}

function buildFirewallHostnameMap(
  rows: Awaited<ReturnType<typeof getCachedFirewalls>>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const fw of rows) {
    const host = (fw.hostname ?? "").trim() || (fw.name ?? "").trim();
    if (fw.firewallId && host) m.set(fw.firewallId, host);
  }
  return m;
}

/** Mission control chart: Sophos Central `product` must be firewall (not ZTNA, email, endpoint, …). */
function centralAlertIsFirewallProduct(a: CentralAlertRow): boolean {
  const prod = `${a.product ?? ""}`.trim().toLowerCase();
  const agentType = `${a.managedAgent?.type ?? ""}`.trim().toLowerCase();
  return prod === "firewall" || (!prod && agentType === "utm");
}

/** Two-line chart: threat-style vs operational; “web” bucket (e.g. URL wording) still counts as firewall strip. */
function mapMcFirewallThreatAxis(a: CentralAlertRow): "ips" | "blocked" {
  const axis = mapAlertToMissionControlAxes(a);
  if (axis === "ips") return "ips";
  return "blocked";
}

function buildThreatFromAlerts(alerts: CentralAlertRow[]): ThreatActivityDay[] {
  const now = new Date();
  const days: ThreatActivityDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(5, 10), blocked: 0, ips: 0, web: 0 });
  }
  const idxByKey = new Map(days.map((x, i) => [x.date, i] as const));

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  for (const a of alerts) {
    if (!centralAlertIsFirewallProduct(a)) continue;
    const day = parseIsoDateDay(centralAlertRaisedAt(a));
    if (!day) continue;
    const tMs = new Date(day).getTime();
    if (tMs < cutoff.getTime()) continue;
    const key = day.slice(5, 10);
    const idx = idxByKey.get(key);
    if (idx == null) continue;
    const row = days[idx];
    const branch = mapMcFirewallThreatAxis(a);
    if (branch === "ips") row.ips += 1;
    else row.blocked += 1;
  }
  return days;
}

function buildThreatFromAssessments(timestamps: string[]): ThreatActivityDay[] {
  const now = new Date();
  const days: ThreatActivityDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(5, 10), blocked: 0, ips: 0, web: 0 });
  }
  const idxByKey = new Map(days.map((x, i) => [x.date, i] as const));
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  for (const ts of timestamps) {
    const day = parseIsoDateDay(ts);
    if (!day) continue;
    const t = new Date(day);
    if (t < cutoff) continue;
    const key = day.slice(5, 10);
    const idx = idxByKey.get(key);
    if (idx == null) continue;
    days[idx].blocked += 1;
  }
  return days;
}

function fleetHealthFromRows(rows: FleetFirewall[]): FleetHealthSlice[] {
  let online = 0;
  let offline = 0;
  let warning = 0;
  let unknown = 0;
  for (const r of rows) {
    if (r.status === "online") online++;
    else if (r.status === "offline") offline++;
    else if (r.status === "stale") warning++;
    else unknown++;
  }
  return [
    { name: "Online", value: online, color: "#22c55e" },
    { name: "Offline", value: offline, color: "#64748b" },
    { name: "Warning", value: warning, color: "#f59e0b" },
    { name: "Unknown", value: unknown, color: "#a855f7" },
  ];
}

export interface MissionControlLiveModel {
  customersCount: number;
  devicesCount: number;
  criticalAlertsCount: number;
  complianceAvg: number;
  complianceSample: number;
  customerSubline: string;
  deviceSubline: string;
  alertSubline: string;
  complianceFootnote: string;
  customerSparkline: SparklinePoint[];
  deviceSparkline: SparklinePoint[];
  alertSparkline: SparklinePoint[];
  threatActivity: ThreatActivityDay[];
  threatChartSource: "central" | "assessments";
  missionAlerts: MissionAlertRow[];
  topRiskCustomers: TopRiskCustomer[];
  fleetHealth: FleetHealthSlice[];
  recentDocs: RecentDocCard[];
  kpisReady: boolean;
  /** First fetch with no hydrated cache yet — show table loading, not “no alerts”. */
  alertsLoading: boolean;
  /** Background refetch while cached rows are shown. */
  alertsRefreshing: boolean;
  hasCentralTenants: boolean;
  /** True when the risk bar chart ranks by merged Central alert counts (not score fallback). */
  topRiskByCentralAlerts: boolean;
}

export function useMissionControlLiveQuery(
  orgId: string | undefined,
  orgDisplayName: string | undefined,
  enabled: boolean,
): MissionControlLiveModel {
  const directoryQuery = useCustomerDirectoryQuery(
    enabled ? orgId : undefined,
    enabled ? orgDisplayName : undefined,
  );
  const fleetQuery = useFleetCommandQuery(
    enabled ? orgId : undefined,
    enabled ? orgDisplayName : undefined,
  );

  const missionAlertsBundleQuery = useMissionAlertsBundleQuery(orgId, Boolean(enabled && orgId), {
    refetchIntervalMs: 120_000,
  });

  const bundleTenants = missionAlertsBundleQuery.data?.tenants ?? [];

  const tenantNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of bundleTenants) {
      m.set(t.id, getEffectiveTenantDisplayName(t, orgDisplayName) || t.name);
    }
    return m;
  }, [bundleTenants, orgDisplayName]);

  /** Resolve alert `managedAgent.id` → hostname from synced Central inventory. */
  const cachedFirewallsQuery = useQuery({
    queryKey: orgId
      ? queryKeys.central.cachedFirewalls(orgId, "all")
      : ["central", "firewalls", "none"],
    queryFn: () => getCachedFirewalls(orgId!),
    enabled: Boolean(enabled && orgId),
    staleTime: 60_000,
  });

  const assessmentTrendQuery = useQuery({
    queryKey: orgId
      ? (["org", orgId, "mission_control", "assessment_days"] as const)
      : ["disabled"],
    queryFn: async ({ signal }) => {
      const since = new Date();
      since.setDate(since.getDate() - 89);
      const q = supabaseWithAbort(
        supabase
          .from("assessments")
          .select("created_at")
          .eq("org_id", orgId!)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true }),
        signal,
      );
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => r.created_at as string);
    },
    enabled: Boolean(enabled && orgId),
    staleTime: 60_000,
  });

  const savedReportsQuery = useQuery({
    queryKey: orgId ? (["org", orgId, "mission_control", "saved_reports"] as const) : ["disabled"],
    queryFn: ({ signal }) => loadSavedReportsCloud(signal),
    enabled: Boolean(enabled && orgId),
    staleTime: 30_000,
  });

  return useMemo((): MissionControlLiveModel => {
    const entries = directoryQuery.data ?? [];
    const customersCount = entries.length;
    const scored = entries.filter((e) => e.score > 0);
    const complianceAvg =
      scored.length > 0 ? Math.round(scored.reduce((s, e) => s + e.score, 0) / scored.length) : 0;
    const complianceSample = scored.length;

    const fleetRows = fleetQuery.data ?? [];
    const devicesCount = fleetRows.length;

    const alerts = missionAlertsBundleQuery.data?.items ?? [];
    const hostByFwId = buildFirewallHostnameMap(cachedFirewallsQuery.data ?? []);
    const criticalAlertsCount = alerts.filter((a) => isHighTriageSeverity(a.severity)).length;

    const assessmentTs = assessmentTrendQuery.data ?? [];
    const customerSparkline = bucketCountsByDay(assessmentTs, 90);

    const alertDayKeys = bucketCountsByDay(
      alerts.map((a) => centralAlertRaisedAt(a)),
      90,
    );
    const alertSparkline = alertDayKeys;

    const deviceSparkline: SparklinePoint[] = customerSparkline.map((p) => ({
      ...p,
      value: devicesCount,
    }));

    const threatFromCentral = buildThreatFromAlerts(alerts);
    const centralThreatTotal = threatFromCentral.reduce((s, d) => s + d.blocked + d.ips + d.web, 0);
    const threatFromAssess = buildThreatFromAssessments(assessmentTs);
    const assessThreatTotal = threatFromAssess.reduce((s, d) => s + d.blocked, 0);

    const useCentralThreat = centralThreatTotal > 0;
    const threatActivity = useCentralThreat ? threatFromCentral : threatFromAssess;
    const threatChartSource: "central" | "assessments" = useCentralThreat
      ? "central"
      : "assessments";

    const missionAlerts: MissionAlertRow[] = alerts.slice(0, 12).map((a) => {
      const tsRaw = centralAlertRaisedAt(a);
      const ts = parseIsoDateDay(tsRaw) ? tsRaw : "";
      return {
        id: a.id,
        severity: mapSeverity(a.severity),
        summary: alertSummary(a),
        customer: tenantNameById.get(a.tenantId) ?? "Tenant",
        device: displayDeviceLabelForCentralAlert(a, hostByFwId),
        ts,
      };
    });

    const alertsByTenant = new Map<string, number>();
    for (const a of alerts) {
      alertsByTenant.set(a.tenantId, (alertsByTenant.get(a.tenantId) ?? 0) + 1);
    }
    const topRiskCustomers: TopRiskCustomer[] = [...alertsByTenant.entries()]
      .map(([tid, n]) => ({ name: tenantNameById.get(tid) ?? tid, alerts: n }))
      .sort((a, b) => b.alerts - a.alerts)
      .slice(0, 6);

    const topRiskFallback: TopRiskCustomer[] = [...entries]
      .filter((e) => e.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 6)
      .map((e) => ({
        name: e.name.length > 18 ? `${e.name.slice(0, 16)}…` : e.name,
        alerts: Math.max(0, 100 - e.score) + e.unassessedCount * 5,
      }));

    const topRiskByCentralAlerts = topRiskCustomers.length > 0;
    const topRisk = topRiskByCentralAlerts ? topRiskCustomers : topRiskFallback;

    const fleetHealth = fleetHealthFromRows(fleetRows);

    const onlineN = fleetRows.filter((r) => r.status === "online").length;

    const recentPkgs = savedReportsQuery.data ?? [];
    const orgLabel = (orgDisplayName ?? "").trim();
    const recentDocs: RecentDocCard[] = recentPkgs.slice(0, 8).map((pkg) => ({
      id: pkg.id,
      customer: resolveCustomerName(pkg.customerName, orgLabel),
      firewalls: formatFirewallSummaryFromPackage(pkg),
      date: new Date(pkg.createdAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      pages: normalizeReportEntries(pkg.reports).length,
    }));

    const assessedCustomers = scored.length;
    const customerSubline =
      assessedCustomers > 0
        ? `${assessedCustomers} with risk score`
        : customersCount > 0
          ? "Awaiting first assessment"
          : "No customers yet";

    const deviceSubline =
      devicesCount > 0
        ? `${onlineN} online${devicesCount !== onlineN ? ` · ${devicesCount - onlineN} not online` : ""}`
        : "No fleet rows yet";

    const alertSubline =
      bundleTenants.length === 0
        ? "Sync Central tenants for live alerts"
        : missionAlertsBundleQuery.isLoading
          ? "Loading from Central…"
          : alerts.length === 0
            ? "No open alerts in Central"
            : `${alerts.length} open (showing latest)`;

    const complianceFootnote =
      complianceSample > 0
        ? `Across ${complianceSample} assessed customer${complianceSample === 1 ? "" : "s"} in your directory.`
        : "Add assessments to compute a portfolio average.";

    const kpisReady = !directoryQuery.isPending && !fleetQuery.isPending;

    return {
      customersCount,
      devicesCount,
      criticalAlertsCount,
      complianceAvg,
      complianceSample,
      customerSubline,
      deviceSubline,
      alertSubline,
      complianceFootnote,
      customerSparkline,
      deviceSparkline,
      alertSparkline,
      threatActivity,
      threatChartSource,
      missionAlerts,
      topRiskCustomers: topRisk,
      fleetHealth,
      recentDocs,
      kpisReady,
      alertsLoading: missionAlertsBundleQuery.isLoading,
      alertsRefreshing: missionAlertsBundleQuery.isFetching && !missionAlertsBundleQuery.isLoading,
      hasCentralTenants: bundleTenants.length > 0,
      topRiskByCentralAlerts,
    };
  }, [
    directoryQuery.data,
    directoryQuery.isPending,
    fleetQuery.data,
    fleetQuery.isPending,
    missionAlertsBundleQuery.data,
    missionAlertsBundleQuery.isLoading,
    missionAlertsBundleQuery.isFetching,
    cachedFirewallsQuery.data,
    assessmentTrendQuery.data,
    savedReportsQuery.data,
    tenantNameById,
    bundleTenants.length,
    orgDisplayName,
  ]);
}
