/**
 * Deterministic config analysis — ported from the FireComply web app.
 *
 * This is a simplified version that covers the core analysis checks.
 * The full analysis logic (1000+ lines) should be copied from
 * src/lib/analyse-config.ts in the web app with import paths adjusted.
 *
 * For now, this provides the essential structure and key checks
 * so the agent can produce meaningful scores and findings.
 */

import type { ExtractedSections, AnalysisResult, Finding, ConfigStats, InspectionPosture } from "./types";

let findingCounter = 0;
function nextId(): string {
  return `f-${++findingCounter}`;
}

function getRows(sections: ExtractedSections, name: string): Record<string, string>[] {
  return sections[name]?.tables?.[0]?.rows ?? [];
}

function getHeaders(sections: ExtractedSections, name: string): string[] {
  return sections[name]?.tables?.[0]?.headers ?? [];
}

export function analyseConfig(sections: ExtractedSections): AnalysisResult {
  findingCounter = 0;
  const findings: Finding[] = [];
  const sectionNames = Object.keys(sections);

  const fwRules = getRows(sections, "Firewall Rules");
  const natRules = getRows(sections, "NAT Rules");
  const hosts = getRows(sections, "Networks");
  const zones = getRows(sections, "Zones");
  const interfaces = getRows(sections, "Interfaces & Ports");

  const stats: ConfigStats = {
    totalRules: fwRules.length,
    totalSections: sectionNames.length,
    totalHosts: hosts.length,
    totalNatRules: natRules.length,
    interfaces: interfaces.length,
    populatedSections: sectionNames.filter((n) => {
      const s = sections[n];
      return (s.tables[0]?.rows.length ?? 0) > 0 || s.text.length > 0 || s.details.length > 0;
    }).length,
    emptySections: 0,
    sectionNames,
  };
  stats.emptySections = stats.totalSections - stats.populatedSections;

  // Identify WAN-bound rules
  const wanZones = new Set(["WAN", "wan"]);
  const wanRules = fwRules.filter((r) => {
    const dest = r["Destination Zone"] ?? "";
    return wanZones.has(dest) || dest.toLowerCase().includes("wan");
  });

  const enabledWan = wanRules.filter((r) => (r["Status"] ?? "").toLowerCase() !== "disable");
  const disabledRules = fwRules.filter((r) => (r["Status"] ?? "").toLowerCase() === "disable");

  const httpServices = /http|https|any|web/i;
  const webFilterable = enabledWan.filter((r) => httpServices.test(r["Service"] ?? "ANY"));
  const withWebFilter = webFilterable.filter((r) => r["Web Filter"] && r["Web Filter"] !== "None" && r["Web Filter"] !== "");
  const withIps = enabledWan.filter((r) => r["IPS Policy"] && r["IPS Policy"] !== "None" && r["IPS Policy"] !== "");

  const sslRules = getRows(sections, "SSL/TLS Inspection Rules");
  const sslDecrypt = sslRules.filter((r) => (r["Action"] ?? "").toLowerCase().includes("decrypt"));

  const inspectionPosture: InspectionPosture = {
    totalWanRules: wanRules.length,
    enabledWanRules: enabledWan.length,
    disabledWanRules: wanRules.length - enabledWan.length,
    webFilterableRules: webFilterable.length,
    withWebFilter: withWebFilter.length,
    withoutWebFilter: webFilterable.length - withWebFilter.length,
    withAppControl: 0,
    withIps: withIps.length,
    withSslInspection: sslRules.length,
    sslDecryptRules: sslDecrypt.length,
    sslExclusionRules: sslRules.length - sslDecrypt.length,
    sslRules: [],
    sslUncoveredZones: [],
    wanRuleNames: enabledWan.map((r) => r["Rule Name"] ?? ""),
    totalDisabledRules: disabledRules.length,
    dpiEngineEnabled: sslDecrypt.length > 0,
  };

  // ── Core findings ──

  if (disabledRules.length > 0) {
    findings.push({
      id: nextId(),
      severity: "low",
      title: `${disabledRules.length} disabled firewall rule${disabledRules.length > 1 ? "s" : ""} detected`,
      detail: `Disabled rules add complexity without providing protection. Review and remove rules that are no longer needed.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  const anyServiceRules = enabledWan.filter((r) => (r["Service"] ?? "").toLowerCase() === "any");
  if (anyServiceRules.length > 0) {
    findings.push({
      id: nextId(),
      severity: "high",
      title: `${anyServiceRules.length} WAN rule${anyServiceRules.length > 1 ? "s" : ""} with "ANY" service`,
      detail: `Rules allowing all services to the WAN create an unnecessarily large attack surface.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  if (inspectionPosture.withoutWebFilter > 0) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${inspectionPosture.withoutWebFilter} WAN rule${inspectionPosture.withoutWebFilter > 1 ? "s" : ""} missing web filtering`,
      detail: `Web-bound traffic without web filtering bypasses URL categorisation and malware scanning.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  const noIpsCount = enabledWan.length - withIps.length;
  if (noIpsCount > 0 && enabledWan.length > 0) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${noIpsCount} WAN rule${noIpsCount > 1 ? "s" : ""} without IPS policy`,
      detail: `Traffic to the WAN without Intrusion Prevention is not inspected for known attack patterns.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  const noLogRules = enabledWan.filter((r) => {
    const log = (r["Log"] ?? "").toLowerCase();
    return log === "disable" || log === "off" || log === "no";
  });
  if (noLogRules.length > 0) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${noLogRules.length} WAN rule${noLogRules.length > 1 ? "s" : ""} with logging disabled`,
      detail: `Disabled logging reduces visibility into traffic patterns and security events.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  // NAT: DNAT without IPS
  const dnatRules = natRules.filter((r) => (r["Rule Type"] ?? "").toLowerCase().includes("dnat"));
  if (dnatRules.length > 0) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${dnatRules.length} DNAT rule${dnatRules.length > 1 ? "s" : ""} exposing services to WAN`,
      detail: `DNAT rules expose internal services to the internet. Ensure IPS is applied to corresponding firewall rules.`,
      section: "NAT Rules",
      confidence: "medium",
    });
  }

  // SSL/TLS
  if (sslRules.length === 0 && enabledWan.length > 0) {
    findings.push({
      id: nextId(),
      severity: "high",
      title: "No SSL/TLS inspection rules configured",
      detail: "Without SSL/TLS inspection, encrypted traffic cannot be scanned for threats. Over 90% of web traffic is encrypted.",
      section: "SSL/TLS Inspection Rules",
      confidence: "high",
    });
  }

  // Local Service ACL — admin exposure
  const aclRows = getRows(sections, "Local Service ACL");
  const exposedAdmin = aclRows.filter((r) => {
    const service = (r["Service"] ?? r["ServiceType"] ?? "").toLowerCase();
    const zone = (r["Zone"] ?? r["SourceZone"] ?? "").toLowerCase();
    return (service.includes("https") || service.includes("ssh")) && zone.includes("wan");
  });
  if (exposedAdmin.length > 0) {
    findings.push({
      id: nextId(),
      severity: "critical",
      title: "Admin services (HTTPS/SSH) exposed to WAN",
      detail: `${exposedAdmin.length} local service ACL rule${exposedAdmin.length > 1 ? "s" : ""} allow admin access from the WAN zone.`,
      section: "Local Service ACL",
      confidence: "high",
    });
  }

  return { stats, findings, inspectionPosture, ruleColumns: getHeaders(sections, "Firewall Rules") };
}
