import { supabase } from "@/integrations/supabase/client";
import { agentCustomerGroupingKey, agentFleetCustomerLabel } from "@/lib/agent-customer-bucket";

/** Country shown in chips / Assess when the firewall row has no override. */
export function fleetEffectiveComplianceCountry(fw: FleetFirewall): string {
  return (fw.complianceCountry || fw.customerComplianceCountry || "").trim();
}

/** Fleet row shape used by Fleet Command (central + agent merged view). */
export interface FleetFirewall {
  id: string;
  hostname: string;
  customer: string;
  score: number;
  grade: string;
  findings: number;
  criticalFindings: number;
  lastAssessed: string | null;
  status: "online" | "offline" | "stale" | "suspended";
  firmware: string;
  model: string;
  serialNumber: string;
  haRole?: string;
  haClusterId?: string;
  tenantId?: string;
  tenantName?: string;
  source: "central" | "agent" | "both";
  configLinked: boolean;
  latestReportId?: string;
  latestReportDate?: string;
  /** MSP compliance context (persisted on central_firewalls or agents). */
  complianceCountry: string;
  complianceState: string;
  /**
   * Default country for this customer (Sophos tenant or agent bucket). Firewalls may leave
   * `complianceCountry` empty to inherit.
   */
  customerComplianceCountry: string;
  /**
   * Sector for framework defaults — stored per Sophos tenant or agent customer bucket,
   * surfaced on each row for that customer.
   */
  complianceEnvironment: string;
  /** Agent-only: key for customer-scoped environment (`agent_customer_compliance_environment`). */
  agentCustomerBucketKey?: string;
}

/** `id` refers to `agents.id` when agent-only; otherwise `central_firewalls.id`. */
export function fleetPersistenceTarget(fw: FleetFirewall): "central" | "agent" {
  return fw.source === "agent" ? "agent" : "central";
}

export function gradeFromScore(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

type CentralFwRow = {
  id: string;
  hostname?: string | null;
  name?: string | null;
  firewall_id: string;
  firmware_version: string;
  model: string;
  serial_number: string;
  synced_at: string;
  cluster_json?: { id?: string; mode?: string; status?: string } | null;
  status_json?: { connected?: boolean; suspended?: boolean } | null;
  central_tenant_id?: string | null;
  compliance_country?: string | null;
  compliance_state?: string | null;
  compliance_environment?: string | null;
};

type AgentRow = {
  id: string;
  firewall_host?: string | null;
  name?: string | null;
  customer_name?: string | null;
  assigned_customer_name?: string | null;
  tenant_name?: string | null;
  last_score?: number | null;
  last_grade?: string | null;
  last_seen_at?: string | null;
  status?: string | null;
  firmware_version?: string | null;
  hardware_model?: string | null;
  serial_number?: string | null;
  compliance_country?: string | null;
  compliance_state?: string | null;
  compliance_environment?: string | null;
};

function complianceFromCentral(fw: CentralFwRow) {
  return {
    complianceCountry: (fw.compliance_country ?? "").trim(),
    complianceState: (fw.compliance_state ?? "").trim(),
    complianceEnvironment: (fw.compliance_environment ?? "").trim(),
  };
}

function complianceFromAgent(ag: AgentRow) {
  return {
    complianceCountry: (ag.compliance_country ?? "").trim(),
    complianceState: (ag.compliance_state ?? "").trim(),
    complianceEnvironment: (ag.compliance_environment ?? "").trim(),
  };
}

/**
 * Loads central firewalls, assessments, agents, links, tenants, and saved_reports;
 * merges into `FleetFirewall[]`. Pass `signal` for TanStack Query cancellation.
 */
export async function fetchFleetBundle(
  orgId: string,
  orgDisplayName: string | undefined,
  options?: { signal?: AbortSignal },
): Promise<FleetFirewall[]> {
  const signal = options?.signal;

  const fwQ = supabase.from("central_firewalls").select("*").eq("org_id", orgId);
  const assessQ = supabase
    .from("assessments")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  const agentQ = supabase.from("agents").select("*").eq("org_id", orgId);
  const linksQ = supabase.from("firewall_config_links").select("*").eq("org_id", orgId);
  const tenantQ = supabase.from("central_tenants").select("*").eq("org_id", orgId);
  const agentCustEnvQ = supabase
    .from("agent_customer_compliance_environment")
    .select("customer_bucket_key, compliance_environment, compliance_country")
    .eq("org_id", orgId);
  const reportsQ = supabase
    .from("saved_reports")
    .select("id, customer_name, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const [fwRes, assessRes, agentRes, linksRes, tenantRes, reportsRes, agentCustEnvRes] =
    await Promise.all([
      signal ? fwQ.abortSignal(signal) : fwQ,
      signal ? assessQ.abortSignal(signal) : assessQ,
      signal ? agentQ.abortSignal(signal) : agentQ,
      signal ? linksQ.abortSignal(signal) : linksQ,
      signal ? tenantQ.abortSignal(signal) : tenantQ,
      signal ? reportsQ.abortSignal(signal) : reportsQ,
      signal ? agentCustEnvQ.abortSignal(signal) : agentCustEnvQ,
    ]);

  if (fwRes.error) throw fwRes.error;
  if (assessRes.error) throw assessRes.error;
  if (agentRes.error) throw agentRes.error;
  if (linksRes.error) throw linksRes.error;
  if (tenantRes.error) throw tenantRes.error;
  if (reportsRes.error) throw reportsRes.error;
  if (agentCustEnvRes.error) throw agentCustEnvRes.error;

  const firewalls = (fwRes.data ?? []) as CentralFwRow[];
  const assessments = assessRes.data ?? [];
  const agents = (agentRes.data ?? []) as AgentRow[];
  const links = linksRes.data ?? [];
  const tenants = tenantRes.data ?? [];
  const reports = reportsRes.data ?? [];

  const configLinkMap = new Map<string, string>();
  const configLinkedIds = new Set<string>();
  for (const link of links) {
    const fwId = (link as Record<string, unknown>).central_firewall_id as string | undefined;
    const hostname = (link as Record<string, unknown>).config_hostname as string | undefined;
    if (fwId && hostname) {
      configLinkMap.set(fwId, hostname);
      configLinkedIds.add(fwId);
    }
  }

  const scoreByLabel = new Map<
    string,
    { score: number; grade: string; date: string; findings: number }
  >();
  for (const a of assessments) {
    const fws = a.firewalls as Array<{
      label?: string;
      hostname?: string;
      riskScore?: { overall: number; grade: string; categories?: unknown[] };
      totalFindings?: number;
      findingCount?: number;
    }> | null;
    if (fws) {
      for (const f of fws) {
        const label = f.label ?? f.hostname ?? a.customer_name;
        if (!scoreByLabel.has(label)) {
          scoreByLabel.set(label, {
            score: f.riskScore?.overall ?? a.overall_score ?? 0,
            grade:
              f.riskScore?.grade ?? a.overall_grade ?? gradeFromScore(f.riskScore?.overall ?? 0),
            date: a.created_at,
            findings: f.totalFindings ?? f.findingCount ?? 0,
          });
        }
      }
    }
    if (!scoreByLabel.has(a.customer_name)) {
      scoreByLabel.set(a.customer_name, {
        score: a.overall_score ?? 0,
        grade: a.overall_grade ?? gradeFromScore(a.overall_score ?? 0),
        date: a.created_at,
        findings: 0,
      });
    }
  }

  const tenantMap = new Map<string, string>();
  const tenantEnvMap = new Map<string, string>();
  const tenantCountryMap = new Map<string, string>();
  for (const t of tenants) {
    const tid = (t as Record<string, unknown>).central_tenant_id as string;
    const name = (t as Record<string, unknown>).name as string;
    const env = ((t as Record<string, unknown>).compliance_environment as string | undefined) ?? "";
    const ctry = ((t as Record<string, unknown>).compliance_country as string | undefined) ?? "";
    if (tid && name) tenantMap.set(tid, name);
    if (tid && env.trim()) tenantEnvMap.set(tid, env.trim());
    if (tid && ctry.trim()) tenantCountryMap.set(tid, ctry.trim());
  }

  const agentBucketEnvMap = new Map<string, string>();
  const agentBucketCountryMap = new Map<string, string>();
  for (const row of agentCustEnvRes.data ?? []) {
    const k = (row as { customer_bucket_key?: string }).customer_bucket_key;
    const e = (row as { compliance_environment?: string }).compliance_environment;
    const c = (row as { compliance_country?: string }).compliance_country;
    if (k && (e ?? "").trim()) agentBucketEnvMap.set(k, (e ?? "").trim());
    if (k && (c ?? "").trim()) agentBucketCountryMap.set(k, (c ?? "").trim());
  }

  function effectiveSectorEnvironment(
    tenantId: string | undefined,
    source: FleetFirewall["source"],
    agentBucketKey: string | undefined,
    legacyRowEnv: string,
  ): string {
    const legacy = (legacyRowEnv ?? "").trim();
    if (tenantId) {
      const fromTenant = tenantEnvMap.get(tenantId);
      if (fromTenant) return fromTenant;
    }
    if (source === "agent" && agentBucketKey) {
      const fromBucket = agentBucketEnvMap.get(agentBucketKey);
      if (fromBucket) return fromBucket;
    }
    return legacy;
  }

  function customerDefaultCountry(
    tenantId: string | undefined,
    source: FleetFirewall["source"],
    agentBucketKey: string | undefined,
  ): string {
    if (tenantId) {
      const c = tenantCountryMap.get(tenantId);
      if (c) return c;
    }
    if (source === "agent" && agentBucketKey) {
      const c = agentBucketCountryMap.get(agentBucketKey);
      if (c) return c;
    }
    return "";
  }

  const agentScoreMap = new Map<
    string,
    { score: number; grade: string; date: string; findings: number }
  >();
  for (const ag of agents) {
    const host = (ag.firewall_host || ag.name || "").split(":")[0].toLowerCase();
    if (host && ag.last_score != null) {
      agentScoreMap.set(host, {
        score: ag.last_score,
        grade: ag.last_grade ?? gradeFromScore(ag.last_score),
        date: ag.last_seen_at ?? "",
        findings: 0,
      });
    }
  }

  const latestReportMap = new Map<string, { id: string; date: string }>();
  for (const r of reports) {
    const cname = (r as Record<string, unknown>).customer_name as string;
    if (cname && !latestReportMap.has(cname)) {
      latestReportMap.set(cname, {
        id: (r as Record<string, unknown>).id as string,
        date: (r as Record<string, unknown>).created_at as string,
      });
    }
  }

  const mapped: FleetFirewall[] = [];
  const seenHostnames = new Set<string>();
  const clusterMembers = new Map<string, CentralFwRow[]>();

  for (const fw of firewalls) {
    const cluster = fw.cluster_json as { id?: string; mode?: string; status?: string } | null;
    if (cluster?.id) {
      const arr = clusterMembers.get(cluster.id) ?? [];
      arr.push(fw);
      clusterMembers.set(cluster.id, arr);
    }
  }

  const processedClusterIds = new Set<string>();
  const agentHostnames = new Set(
    agents.map((a) => (a.firewall_host || a.name || "").split(":")[0].toLowerCase()),
  );

  for (const fw of firewalls) {
    const hn = fw.hostname || fw.name || "";
    const cluster = fw.cluster_json as { id?: string; mode?: string; status?: string } | null;
    const fwTenantId = fw.central_tenant_id as string | undefined;
    const rawTenantName = fwTenantId ? tenantMap.get(fwTenantId) : undefined;
    const fwTenantName =
      rawTenantName === "(This tenant)" ? (orgDisplayName ?? rawTenantName) : rawTenantName;

    if (cluster?.id && clusterMembers.get(cluster.id)!.length > 1) {
      if (processedClusterIds.has(cluster.id)) continue;
      processedClusterIds.add(cluster.id);
      const peers = clusterMembers.get(cluster.id)!;
      const primary = peers[0];
      const primaryHn = primary.hostname || primary.name || "";
      const peerNames = peers.map((p) => p.hostname || p.name || "");
      seenHostnames.add(primaryHn.toLowerCase());
      for (const p of peers) seenHostnames.add((p.hostname || p.name || "").toLowerCase());

      const configHostname = configLinkMap.get(primary.firewall_id);
      const match =
        (configHostname ? scoreByLabel.get(configHostname) : null) ??
        scoreByLabel.get(primaryHn) ??
        scoreByLabel.get(primary.name || "") ??
        agentScoreMap.get(primaryHn.toLowerCase());

      const anyOnline = peers.some((p) => {
        const sj = p.status_json as { connected?: boolean } | null;
        return sj?.connected;
      });
      const anySuspended = peers.some((p) => {
        const sj = p.status_json as { suspended?: boolean } | null;
        return sj?.suspended;
      });
      let status: FleetFirewall["status"] = anySuspended ? "suspended" : "offline";
      if (anyOnline) {
        const syncAge = Date.now() - new Date(primary.synced_at).getTime();
        status = syncAge > 24 * 3_600_000 ? "stale" : "online";
      }

      const isLinked = peers.some((p) => configLinkedIds.has(p.firewall_id));
      const hasAgent = peerNames.some((n) => agentHostnames.has(n.toLowerCase()));
      const report = latestReportMap.get(peerNames.join(" + ")) ?? latestReportMap.get(primaryHn);

      const comp = complianceFromCentral(primary);
      const sectorEnv = effectiveSectorEnvironment(
        fwTenantId,
        hasAgent ? "both" : "central",
        undefined,
        comp.complianceEnvironment,
      );
      const custCountry = customerDefaultCountry(
        fwTenantId,
        hasAgent ? "both" : "central",
        undefined,
      );
      mapped.push({
        id: primary.id,
        hostname: `${primaryHn} (HA ${peers.length}-node)`,
        customer: peerNames.join(" + "),
        score: match?.score ?? 0,
        grade: match ? (match.grade ?? gradeFromScore(match.score)) : "—",
        findings: match?.findings ?? 0,
        criticalFindings: 0,
        lastAssessed: match?.date ?? null,
        status,
        firmware: primary.firmware_version,
        model: primary.model,
        serialNumber: peers.map((p) => p.serial_number).join(", "),
        haRole: (cluster.mode ?? "cluster").toUpperCase(),
        haClusterId: cluster.id,
        tenantId: fwTenantId,
        tenantName: fwTenantName,
        source: hasAgent ? "both" : "central",
        configLinked: isLinked,
        latestReportId: report?.id,
        latestReportDate: report?.date,
        ...comp,
        customerComplianceCountry: custCountry,
        complianceEnvironment: sectorEnv,
      });
      continue;
    }

    seenHostnames.add(hn.toLowerCase());

    const configHostname = configLinkMap.get(fw.firewall_id);
    const match =
      (configHostname ? scoreByLabel.get(configHostname) : null) ??
      scoreByLabel.get(hn) ??
      scoreByLabel.get(fw.name || "") ??
      agentScoreMap.get(hn.toLowerCase());

    const statusJson = fw.status_json as { connected?: boolean; suspended?: boolean } | null;
    let status: FleetFirewall["status"] = statusJson?.suspended ? "suspended" : "offline";
    if (statusJson?.connected) {
      const syncAge = Date.now() - new Date(fw.synced_at).getTime();
      status = syncAge > 24 * 3_600_000 ? "stale" : "online";
    }

    const hasAgent = agentHostnames.has(hn.toLowerCase());
    const report = latestReportMap.get(fw.name || hn) ?? latestReportMap.get(hn);

    const compSingle = complianceFromCentral(fw);
    const sectorEnvSingle = effectiveSectorEnvironment(
      fwTenantId,
      hasAgent ? "both" : "central",
      undefined,
      compSingle.complianceEnvironment,
    );
    const custCountrySingle = customerDefaultCountry(
      fwTenantId,
      hasAgent ? "both" : "central",
      undefined,
    );
    mapped.push({
      id: fw.id,
      hostname: hn,
      customer: fw.name || fw.hostname || "",
      score: match?.score ?? 0,
      grade: match ? (match.grade ?? gradeFromScore(match.score)) : "—",
      findings: match?.findings ?? 0,
      criticalFindings: 0,
      lastAssessed: match?.date ?? null,
      status,
      firmware: fw.firmware_version,
      model: fw.model,
      serialNumber: fw.serial_number,
      tenantId: fwTenantId,
      tenantName: fwTenantName,
      source: hasAgent ? "both" : "central",
      configLinked: configLinkedIds.has(fw.firewall_id),
      latestReportId: report?.id,
      latestReportDate: report?.date,
      ...compSingle,
      customerComplianceCountry: custCountrySingle,
      complianceEnvironment: sectorEnvSingle,
    });
  }

  for (const ag of agents) {
    const hn = ag.firewall_host || ag.name || "";
    if (seenHostnames.has(hn.toLowerCase())) continue;
    seenHostnames.add(hn.toLowerCase());
    let status: FleetFirewall["status"] = "offline";
    if (ag.status === "online") status = "online";
    else if (ag.last_seen_at) {
      const age = Date.now() - new Date(ag.last_seen_at).getTime();
      status = age > 24 * 3_600_000 ? "stale" : "online";
    }
    const custLabel = agentFleetCustomerLabel(ag, orgDisplayName);
    const report =
      latestReportMap.get(custLabel) ?? latestReportMap.get(ag.customer_name || ag.name || hn);
    const compAg = complianceFromAgent(ag);
    const bucketKey = agentCustomerGroupingKey(ag);
    const sectorEnvAgent = effectiveSectorEnvironment(
      undefined,
      "agent",
      bucketKey,
      compAg.complianceEnvironment,
    );
    const custCountryAgent = customerDefaultCountry(undefined, "agent", bucketKey);
    mapped.push({
      id: ag.id,
      hostname: hn,
      customer: custLabel,
      score: ag.last_score ?? 0,
      grade: ag.last_score != null ? (ag.last_grade ?? gradeFromScore(ag.last_score)) : "—",
      findings: 0,
      criticalFindings: 0,
      lastAssessed: ag.last_score != null ? (ag.last_seen_at ?? null) : null,
      status,
      firmware: ag.firmware_version ?? "Unknown",
      model: ag.hardware_model ?? "Agent",
      serialNumber: ag.serial_number ?? "",
      source: "agent",
      configLinked: false,
      latestReportId: report?.id,
      latestReportDate: report?.date,
      ...compAg,
      customerComplianceCountry: custCountryAgent,
      complianceEnvironment: sectorEnvAgent,
      agentCustomerBucketKey: bucketKey,
    });
  }

  return mapped.length > 0 ? mapped : [];
}
