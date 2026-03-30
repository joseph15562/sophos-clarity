import { supabase } from "@/integrations/supabase/client";
import { resolveCustomerName } from "@/lib/customer-name";

export type HealthStatus = "Healthy" | "At Risk" | "Critical" | "Overdue";

/** Row shape for Customer Management / Fleet customer cards (matches page `DemoCustomer`). */
export interface CustomerDirectoryEntry {
  id: string;
  name: string;
  sector: string;
  country: string;
  countryFlag: string;
  score: number;
  grade: string;
  firewallCount: number;
  unassessedCount: number;
  lastAssessed: string;
  daysAgo: number;
  frameworks: string[];
  health: HealthStatus;
  portalSlug: string;
  tenantNameRaw: string | null;
  originalNames?: string[];
}

type AssessmentRow = {
  id: string;
  customer_name: string;
  created_at: string;
  firewalls: unknown;
  overall_score: number;
  overall_grade: string;
  environment?: string | null;
};

type FirewallSnapshot = { riskScore?: { overall?: number } };

function gradeFromNumericScore(s: number): string {
  return s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : s >= 40 ? "D" : "F";
}

function metricsFromAssessmentSnapshot(a: AssessmentRow) {
  const fws = a.firewalls as FirewallSnapshot[] | null;
  if (!Array.isArray(fws) || fws.length === 0) {
    const assessed = a.overall_score > 0;
    return {
      score: assessed ? a.overall_score : 0,
      grade: assessed ? a.overall_grade : "F",
      snapshotFwCount: 1,
      unassessedInSnapshot: assessed ? 0 : 1,
    };
  }
  const positives: number[] = [];
  let unassessed = 0;
  for (const f of fws) {
    const o = f.riskScore?.overall;
    if (o != null && o > 0) positives.push(o);
    else unassessed++;
  }
  const assessedCount = positives.length;
  const score =
    assessedCount > 0 ? Math.round(positives.reduce((sum, x) => sum + x, 0) / assessedCount) : 0;
  const grade = assessedCount > 0 ? gradeFromNumericScore(score) : "F";
  return {
    score,
    grade,
    snapshotFwCount: fws.length,
    unassessedInSnapshot: unassessed,
  };
}

function daysAgoLabel(daysSince: number) {
  if (daysSince === 0) return "Today";
  if (daysSince === 1) return "Yesterday";
  return `${daysSince} days ago`;
}

/**
 * Loads tenant / assessment / agent / portal rows and builds customer cards for Customer Management.
 */
export async function fetchCustomerDirectory(
  orgId: string,
  orgDisplayName: string,
): Promise<CustomerDirectoryEntry[]> {
  const [assessRes, tenantRes, agentRes, fwRes, portalRes] = await Promise.all([
    supabase
      .from("assessments")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("central_tenants").select("central_tenant_id, name").eq("org_id", orgId),
    supabase
      .from("agents")
      .select(
        "id, name, firewall_host, customer_name, tenant_name, last_score, last_grade, last_seen_at, status, hardware_model",
      )
      .eq("org_id", orgId),
    supabase
      .from("central_firewalls")
      .select("central_tenant_id, hostname, name, firmware_version, model, status_json")
      .eq("org_id", orgId),
    supabase.from("portal_config").select("slug, tenant_name").eq("org_id", orgId),
  ]);

  const assessments = (assessRes.data ?? []) as AssessmentRow[];
  const tenants = tenantRes.data ?? [];
  const agents = agentRes.data ?? [];
  const firewalls = fwRes.data ?? [];
  const portalRows = portalRes.data ?? [];

  const gradeFor = (s: number) =>
    s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : s >= 40 ? "D" : "F";

  const slugByResolvedName = new Map<string, { slug: string; rawTenantName: string }>();
  const portalSorted = [...portalRows].sort((a, b) => {
    const as = String(a.slug ?? "").length > 0 ? 1 : 0;
    const bs = String(b.slug ?? "").length > 0 ? 1 : 0;
    return bs - as;
  });
  for (const row of portalSorted) {
    const raw = row.tenant_name as string | null;
    if (!raw) continue;
    const resolved = resolveCustomerName(raw, orgDisplayName);
    if (slugByResolvedName.has(resolved)) continue;
    slugByResolvedName.set(resolved, {
      slug: String(row.slug ?? ""),
      rawTenantName: raw,
    });
  }

  const namesByResolved = new Map<string, Set<string>>();
  const latestByResolved = new Map<string, AssessmentRow>();
  for (const a of assessments) {
    const resolved = resolveCustomerName(a.customer_name, orgDisplayName);
    if (!namesByResolved.has(resolved)) namesByResolved.set(resolved, new Set());
    namesByResolved.get(resolved)!.add(a.customer_name);
    const prev = latestByResolved.get(resolved);
    if (!prev || new Date(a.created_at) > new Date(prev.created_at)) {
      latestByResolved.set(resolved, a);
    }
  }

  const customerMap = new Map<string, CustomerDirectoryEntry>();

  for (const t of tenants) {
    const tName = resolveCustomerName(t.name || "", orgDisplayName);
    if (!tName || customerMap.has(tName)) continue;
    const tFws = firewalls.filter((fw) => fw.central_tenant_id === t.central_tenant_id);
    customerMap.set(tName, {
      id: t.central_tenant_id,
      name: tName,
      sector: "Private Sector",
      country: "United Kingdom",
      countryFlag: "🇬🇧",
      score: 0,
      grade: "F",
      firewallCount: tFws.length,
      unassessedCount: tFws.length,
      lastAssessed: "Not assessed",
      daysAgo: 999,
      frameworks: [],
      health: "Overdue",
      portalSlug: "",
      tenantNameRaw: t.name || null,
    });
  }

  for (const [resolvedName, latest] of latestByResolved) {
    const m = metricsFromAssessmentSnapshot(latest);
    const daysSince = Math.floor((Date.now() - new Date(latest.created_at).getTime()) / 86_400_000);
    let health: HealthStatus;
    if (latest.overall_score < 40) health = "Critical";
    else if (daysSince > 90) health = "Overdue";
    else if (latest.overall_score < 60 || daysSince > 60) health = "At Risk";
    else health = "Healthy";

    const orig = Array.from(namesByResolved.get(resolvedName) ?? []);
    const existing = customerMap.get(resolvedName);
    const totalFw = existing
      ? Math.max(existing.firewallCount, m.snapshotFwCount)
      : m.snapshotFwCount;
    const extraOutsideSnapshot = Math.max(0, totalFw - m.snapshotFwCount);
    const unassessedCount = m.unassessedInSnapshot + extraOutsideSnapshot;

    if (existing) {
      existing.originalNames = orig;
      existing.score = m.score;
      existing.grade = m.grade;
      existing.firewallCount = totalFw;
      existing.unassessedCount = unassessedCount;
      existing.sector = latest.environment || existing.sector;
      existing.lastAssessed = daysAgoLabel(daysSince);
      existing.daysAgo = daysSince;
      existing.health = health;
      existing.tenantNameRaw = latest.customer_name;
    } else {
      customerMap.set(resolvedName, {
        id: latest.id,
        name: resolvedName,
        sector: latest.environment || "Private Sector",
        country: "United Kingdom",
        countryFlag: "🇬🇧",
        score: m.score,
        grade: m.grade,
        firewallCount: totalFw,
        unassessedCount,
        lastAssessed: daysAgoLabel(daysSince),
        daysAgo: daysSince,
        frameworks: [],
        health,
        portalSlug: "",
        tenantNameRaw: latest.customer_name,
        originalNames: orig,
      });
    }
  }

  for (const ag of agents) {
    const rawAgName = ag.tenant_name || ag.customer_name || ag.name;
    const resolvedName = resolveCustomerName(rawAgName, orgDisplayName);
    const existing = customerMap.get(resolvedName);
    if (existing) {
      if (existing.score === 0 && ag.last_score != null && ag.last_score > 0) {
        existing.score = ag.last_score;
        existing.grade = ag.last_grade || gradeFor(ag.last_score);
        existing.unassessedCount = 0;
        const daysSince = ag.last_seen_at
          ? Math.floor((Date.now() - new Date(ag.last_seen_at).getTime()) / 86_400_000)
          : 999;
        existing.lastAssessed = daysAgoLabel(daysSince);
        existing.daysAgo = daysSince;
        if (ag.last_score < 40) existing.health = "Critical";
        else if (ag.last_score < 60) existing.health = "At Risk";
        else existing.health = "Healthy";
      }
      if (!existing.tenantNameRaw) existing.tenantNameRaw = rawAgName;
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
      const assessed = ag.last_score != null && ag.last_score > 0;
      customerMap.set(resolvedName, {
        id: ag.id,
        name: resolvedName,
        sector: "Private Sector",
        country: "United Kingdom",
        countryFlag: "🇬🇧",
        score: ag.last_score ?? 0,
        grade: ag.last_grade || gradeFor(ag.last_score ?? 0),
        firewallCount: 1,
        unassessedCount: assessed ? 0 : 1,
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
        portalSlug: "",
        tenantNameRaw: rawAgName,
      });
    }
  }

  for (const c of customerMap.values()) {
    const info = slugByResolvedName.get(c.name);
    if (info?.slug) c.portalSlug = info.slug;
    if (info?.rawTenantName) c.tenantNameRaw = info.rawTenantName;
  }

  return customerMap.size > 0 ? Array.from(customerMap.values()) : [];
}
