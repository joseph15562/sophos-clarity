/**
 * Deterministic pre-AI analysis of extracted Sophos firewall config.
 * Synced from the web app (src/lib/analyse-config.ts).
 */

import type { ExtractedSections } from "./types";
import type {
  ConfigStats,
  InspectionPosture,
  Finding,
  AnalysisResult,
  AnalyseOptions,
} from "./types";

import {
  isWanDest,
  isWebService,
  hasWebFilter,
  isAllowAllWebPolicy,
  getWebFilterPolicyDisplayName,
  isLoggingOff,
  isRuleDisabled,
  isAnyService,
  isBroadSource,
  isBroadDest,
  ruleName,
  hasAppControl,
  hasIps,
  ruleSignature,
} from "./rule-predicates";
import {
  findFirewallRulesTable,
  countRows,
  countInterfaceRows,
  extractHostname,
  extractManagementIp,
} from "./section-meta";
import { parseSslTlsRules, findUncoveredZones, findUncoveredNetworks } from "./ssl-tls-inspection";
import {
  extractAtpStatus,
  analyseATP,
  analyseMdrFeed,
  analyseNdrEssentials,
  analyseSecurityHeartbeat,
  analyseSyncAppControl,
} from "./domains/atp-services";
import { analyseNatRules as analyseNatRulesDomain } from "./domains/nat";
import { analyseLocalServiceAcl, analyseWebFilterPolicies } from "./domains/web-filter";
import { analyseIpsPolicies, analyseVirusScanning } from "./domains/ips-av";
import {
  analyseAdminSettings,
  analyseBackupRestore,
  analyseNotificationSettings,
  analysePatternDownload,
  analyseTimeSettings,
  analyseAuthServers,
  analyseHotfix,
  analyseOtpSettings,
  analyseAdminProfiles,
} from "./domains/admin-hardening";
import {
  analyseVpnSecurity,
  analyseDoSProtection,
  analyseSyslogServers,
  analyseWirelessSecurity,
  analyseSnmpCommunity,
  analyseDnsSecurity,
  analyseRedSecurity,
} from "./domains/vpn-network";
import {
  analyseRuleOrdering,
  analyseUserGroupRules,
  analyseWafPolicies,
  analyseAppFilterPolicies,
} from "./domains/rules-waf";
import {
  analyseCertificates,
  analyseHotspots,
  analyseInterfaceSecurity,
  analyseZtna,
  analyseFirmwareVersion,
  analyseLicenceUsage,
} from "./domains/infra";
import { analyseHA } from "./domains/ha";

export { analyseThreatStatus } from "./threat-status-findings";

export function analyseConfig(
  sections: ExtractedSections,
  options?: AnalyseOptions,
): AnalysisResult {
  const findings: Finding[] = [];
  let fid = 0;

  const sectionNames = Object.keys(sections);
  const totalSections = sectionNames.length;
  const rulesTable = findFirewallRulesTable(sections);
  const totalRules = rulesTable ? rulesTable.rows.length : 0;
  const totalHosts = countRows(sections, /hosts?|networks?/i, /wireless|groups?/i);
  const totalNatRules = countRows(sections, /nat/i);
  const interfaces = countInterfaceRows(sections);

  let populatedSections = 0;
  let emptySectionCount = 0;
  for (const data of Object.values(sections)) {
    if (data.tables.length > 0 || data.details.length > 0 || data.text) {
      populatedSections++;
    } else {
      emptySectionCount++;
    }
  }

  const stats: ConfigStats = {
    totalRules,
    totalSections,
    totalHosts,
    totalNatRules,
    interfaces,
    populatedSections,
    emptySections: emptySectionCount,
    sectionNames,
  };

  const emptyPosture: InspectionPosture = {
    totalWanRules: 0,
    enabledWanRules: 0,
    disabledWanRules: 0,
    webFilterableRules: 0,
    withWebFilter: 0,
    withoutWebFilter: 0,
    withAppControl: 0,
    withIps: 0,
    withSslInspection: 0,
    sslDecryptRules: 0,
    sslExclusionRules: 0,
    sslRules: [],
    sslUncoveredZones: [],
    sslUncoveredNetworks: [],
    allWanSourceZones: [],
    allWanSourceNetworks: [],
    wanRuleNames: [],
    wanWebServiceRuleNames: [],
    wanMissingWebFilterRuleNames: [],
    totalDisabledRules: 0,
    dpiEngineEnabled: false,
  };

  if (!rulesTable || totalRules === 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "info",
      title: "No firewall rules found",
      detail: "The parser did not extract any firewall rules from this configuration export.",
      section: "Firewall Rules",
      confidence: "medium",
      evidence: "No table matching 'firewall rules' section found in parsed HTML",
    });
    return {
      stats,
      findings,
      inspectionPosture: emptyPosture,
      ruleColumns: [],
      hostname: extractHostname(sections),
      managementIp: extractManagementIp(sections),
      atpStatus: extractAtpStatus(sections),
    };
  }

  let totalDisabledRules = 0;
  for (const row of rulesTable.rows) {
    if (isRuleDisabled(row)) totalDisabledRules++;
  }

  const wanRules: Array<{ name: string; row: Record<string, string>; enabled: boolean }> = [];
  for (const row of rulesTable.rows) {
    if (isWanDest(row)) {
      wanRules.push({ name: ruleName(row), row, enabled: !isRuleDisabled(row) });
    }
  }
  const enabledWanRules = wanRules.filter((r) => r.enabled);
  const disabledWanRules = wanRules.filter((r) => !r.enabled);

  const wfExempt = new Set(
    (options?.webFilterExemptRuleNames ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean),
  );

  let webFilterableRules = 0,
    withWebFilter = 0,
    withoutWebFilter = 0;
  let withAppControl = 0,
    withIps = 0,
    withSslInspection = 0;
  for (const { name, row, enabled } of wanRules) {
    if (!enabled) continue;
    if (isWebService(row)) {
      if (!wfExempt.has(name.toLowerCase().trim())) {
        webFilterableRules++;
        if (hasWebFilter(row)) withWebFilter++;
        else withoutWebFilter++;
      }
    }
    if (hasAppControl(row)) withAppControl++;
    if (hasIps(row)) withIps++;
  }

  const sslRules = parseSslTlsRules(sections);
  withSslInspection = sslRules.length;
  const sslDecryptRules = sslRules.filter((r) => r.action === "decrypt" && r.enabled).length;
  const sslExclusionRules = sslRules.filter((r) => r.action === "exclude").length;
  const dpiEngineEnabled = sslDecryptRules > 0;
  const { uncovered: sslUncoveredZones, allWanSourceZones } = findUncoveredZones(
    wanRules,
    sslRules,
    options?.dpiExemptZones,
  );
  const { uncoveredNetworks: sslUncoveredNetworks, allWanSourceNetworks } = findUncoveredNetworks(
    wanRules,
    sslRules,
    options?.dpiExemptNetworks,
  );

  const wfMode = options?.webFilterComplianceMode ?? "strict";

  const wanMissingWebFilterRuleNames = wanRules
    .filter((w) => w.enabled && isWebService(w.row) && !hasWebFilter(w.row))
    .map((w) => w.name);

  const inspectionPosture: InspectionPosture = {
    totalWanRules: wanRules.length,
    enabledWanRules: enabledWanRules.length,
    disabledWanRules: disabledWanRules.length,
    webFilterableRules,
    withWebFilter,
    withoutWebFilter,
    withAppControl,
    withIps,
    withSslInspection,
    sslDecryptRules,
    sslExclusionRules,
    sslRules,
    sslUncoveredZones,
    sslUncoveredNetworks,
    allWanSourceZones,
    allWanSourceNetworks,
    wanRuleNames: wanRules.map((w) => w.name),
    wanWebServiceRuleNames: wanRules
      .filter((w) => w.enabled && isWebService(w.row))
      .map((w) => w.name),
    wanMissingWebFilterRuleNames,
    totalDisabledRules,
    dpiEngineEnabled,
  };

  if (disabledWanRules.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: `${disabledWanRules.length} WAN rule${disabledWanRules.length > 1 ? "s" : ""} disabled`,
      detail: `Disabled WAN-facing rules: ${disabledWanRules
        .map((r) => r.name)
        .slice(0, 6)
        .join(
          ", ",
        )}${disabledWanRules.length > 6 ? ` (+${disabledWanRules.length - 6} more)` : ""}. These rules provide no protection — verify if they should be re-enabled or removed.`,
      section: "Firewall Rules",
      remediation:
        "Go to Rules and policies > Firewall rules. Review disabled WAN rules — if no longer needed, delete them. If they should be active, re-enable them and configure web filtering, IPS, and app control.",
      confidence: "high",
      evidence: `Rules with Status=Off/Disabled and Destination Zone=WAN: ${disabledWanRules
        .map((r) => r.name)
        .slice(0, 4)
        .join(", ")}`,
    });
  }

  if (totalDisabledRules > 0 && totalDisabledRules !== disabledWanRules.length) {
    const nonWanDisabled = totalDisabledRules - disabledWanRules.length;
    if (nonWanDisabled > 0) {
      findings.push({
        id: `f${++fid}`,
        severity: "info",
        title: `${totalDisabledRules} total rule${totalDisabledRules > 1 ? "s" : ""} disabled across all zones`,
        detail: `${totalDisabledRules} firewall rules are in disabled state (${disabledWanRules.length} WAN, ${nonWanDisabled} other). Disabled rules add no security value and may indicate abandoned policy or incomplete changes.`,
        section: "Firewall Rules",
        confidence: "high",
        evidence: `${totalDisabledRules} rules with Status=Off/Disabled in firewall rules table`,
      });
    }
  }

  const wanNoFilter: string[] = [];
  for (const { name, row, enabled } of wanRules) {
    if (!enabled || !isWebService(row) || hasWebFilter(row)) continue;
    if (wfExempt.has(name.toLowerCase().trim())) continue;
    wanNoFilter.push(name);
  }
  if (wanNoFilter.length > 0) {
    const exemptNote =
      (options?.webFilterExemptRuleNames ?? []).filter(Boolean).length > 0
        ? ` MSP excluded ${(options?.webFilterExemptRuleNames ?? []).filter(Boolean).length} rule name(s) from this check: ${(options?.webFilterExemptRuleNames ?? []).filter(Boolean).slice(0, 6).join(", ")}${(options?.webFilterExemptRuleNames ?? []).filter(Boolean).length > 6 ? "…" : ""}.`
        : "";
    const baseDetail = `Active rules with Destination Zone WAN and Service HTTP/HTTPS/ANY have no Web Filter applied: ${wanNoFilter.slice(0, 8).join(", ")}${wanNoFilter.length > 8 ? ` (+${wanNoFilter.length - 8} more)` : ""}.`;
    findings.push({
      id: `f${++fid}`,
      severity: wfMode === "informational" ? "info" : "critical",
      title: `${wanNoFilter.length} enabled WAN rule${wanNoFilter.length > 1 ? "s" : ""} missing web filtering`,
      detail:
        wfMode === "informational"
          ? `${baseDetail} Web filter compliance mode is set to Informational — this is shown for visibility; it is not framed as a default regulatory failure. Review scope with the customer.${exemptNote}`
          : `${baseDetail} This is a KCSIE/DfE compliance gap.${exemptNote}`,
      section: "Firewall Rules",
      remediation:
        "Go to Rules and policies > Firewall rules. Edit each affected rule → expand Web filtering → set a Web policy. Manage policies under Web > Policies. Ensure the policy blocks inappropriate content for your environment.",
      confidence: "high",
      evidence: `Rules ${wanNoFilter.slice(0, 3).join(", ")} have Web Filter=none/empty with Service=HTTP/HTTPS/ANY`,
    });
  }

  const wanAllowAllWeb: string[] = [];
  for (const { name, row, enabled } of wanRules) {
    if (!enabled || !isWebService(row) || !hasWebFilter(row)) continue;
    if (isAllowAllWebPolicy(getWebFilterPolicyDisplayName(row))) wanAllowAllWeb.push(name);
  }
  if (wanAllowAllWeb.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: wfMode === "informational" ? "info" : "medium",
      title: `${wanAllowAllWeb.length} WAN rule${wanAllowAllWeb.length > 1 ? "s" : ""} use an "allow all" style web policy`,
      detail: `These enabled WAN rules have a web filter policy attached, but the policy name indicates all categories are allowed — there is no meaningful URL/category restriction for compliance purposes: ${wanAllowAllWeb.slice(0, 8).join(", ")}${wanAllowAllWeb.length > 8 ? ` (+${wanAllowAllWeb.length - 8} more)` : ""}.`,
      section: "Firewall Rules",
      remediation:
        "Go to Web > Policies and either use a restrictive policy on these rules, or remove the web policy from the rule if inspection is not required.",
      confidence: "high",
      evidence: `Rules ${wanAllowAllWeb.slice(0, 4).join(", ")} use Allow All / Permit All style web policy names`,
    });
  }

  const loggingOff: string[] = [];
  for (const row of rulesTable.rows) {
    if (isLoggingOff(row)) loggingOff.push(ruleName(row));
  }
  if (loggingOff.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "high",
      title: `${loggingOff.length} rule${loggingOff.length > 1 ? "s" : ""} with logging disabled`,
      detail: `Logging is turned off on: ${loggingOff.slice(0, 8).join(", ")}${loggingOff.length > 8 ? ` (+${loggingOff.length - 8} more)` : ""}. Disabled logging creates gaps in audit trails and monitoring.`,
      section: "Firewall Rules",
      remediation:
        "Go to Rules and policies > Firewall rules. Edit each affected rule → tick 'Log firewall traffic' (near the top, below the Action setting). To send logs externally, configure System services > Log settings.",
      confidence: "high",
      evidence: `Rules ${loggingOff.slice(0, 3).join(", ")} have Log=disabled/off`,
    });
  }

  const KNOWN_SYSTEM_RULES =
    /^(allow dns requests|auto added firewall policy for mta|auto added rule for mta)$/i;
  const fullyOpen: string[] = [];
  const anySvcOnly: string[] = [];
  const broadNetOnly: string[] = [];
  for (const row of rulesTable.rows) {
    const anyService = isAnyService(row);
    const broadNet = isBroadSource(row) && isBroadDest(row);
    const name = ruleName(row);
    if (anyService && broadNet) {
      fullyOpen.push(name);
    } else if (anyService) {
      anySvcOnly.push(name);
    } else if (broadNet && !KNOWN_SYSTEM_RULES.test(name)) {
      broadNetOnly.push(name);
    }
  }

  if (fullyOpen.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "critical",
      title: `${fullyOpen.length} fully open rule${fullyOpen.length > 1 ? "s" : ""} (any source, destination, and service)`,
      detail: `These rules permit all traffic from any source to any destination on any service: ${fullyOpen.slice(0, 6).join(", ")}${fullyOpen.length > 6 ? ` (+${fullyOpen.length - 6} more)` : ""}. Fully open rules effectively bypass firewall protection.`,
      section: "Firewall Rules",
      remediation:
        "Review each rule under Rules and policies > Firewall rules. Restrict source/destination to specific network objects and replace 'Any' service with specific protocols.",
      confidence: "high",
      evidence: `Rules ${fullyOpen.slice(0, 3).join(", ")} have Source=Any, Destination=Any, Service=ANY`,
    });
  }

  if (anySvcOnly.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: `${anySvcOnly.length} rule${anySvcOnly.length > 1 ? "s" : ""} using "ANY" service`,
      detail: `Rules permitting all services but with specific source/destination: ${anySvcOnly.slice(0, 8).join(", ")}${anySvcOnly.length > 8 ? ` (+${anySvcOnly.length - 8} more)` : ""}.`,
      section: "Firewall Rules",
      remediation:
        "Review traffic logs via the Log viewer to identify which protocols are in use. Edit each rule to replace 'Any' with specific services.",
      confidence: "high",
      evidence: `Rules ${anySvcOnly.slice(0, 3).join(", ")} have Service=ANY`,
    });
  }

  if (broadNetOnly.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: `${broadNetOnly.length} rule${broadNetOnly.length > 1 ? "s" : ""} with broad source and destination`,
      detail: `Rules with both Source and Destination set to "Any" but with specific services: ${broadNetOnly.slice(0, 6).join(", ")}${broadNetOnly.length > 6 ? ` (+${broadNetOnly.length - 6} more)` : ""}.`,
      section: "Firewall Rules",
      confidence: "high",
      evidence: `Rules ${broadNetOnly.slice(0, 3).join(", ")} have Source=Any and Destination=Any`,
    });
  }

  analyseOtpSettings(sections, findings, () => ++fid);

  const sigMap = new Map<string, string[]>();
  for (const row of rulesTable.rows) {
    const sig = ruleSignature(row);
    if (!sig || sig === "||||" || sig === "*|*|*|*|*") continue;
    const name = ruleName(row);
    const existing = sigMap.get(sig);
    if (existing) existing.push(name);
    else sigMap.set(sig, [name]);
  }
  const duplicateGroups = [...sigMap.values()].filter((g) => g.length > 1);
  if (duplicateGroups.length > 0) {
    const totalDupes = duplicateGroups.reduce((s, g) => s + g.length, 0);
    const examples = duplicateGroups
      .slice(0, 3)
      .map((g) => g.join(" / "))
      .join("; ");
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: `${totalDupes} rules in ${duplicateGroups.length} overlapping group${duplicateGroups.length > 1 ? "s" : ""}`,
      detail: `Rules with identical source zone, source network, destination zone, destination network, and service: ${examples}${duplicateGroups.length > 3 ? ` (+${duplicateGroups.length - 3} more groups)` : ""}.`,
      section: "Firewall Rules",
      confidence: "high",
      evidence: `Identical rule signatures: ${duplicateGroups
        .slice(0, 2)
        .map((g) => g.join("/"))
        .join("; ")}`,
    });
  }

  const wanNoIps: string[] = [];
  for (const { name, row, enabled } of wanRules) {
    if (enabled && !hasIps(row)) wanNoIps.push(name);
  }
  if (wanNoIps.length > 0 && enabledWanRules.length > 0) {
    const pct = Math.round((wanNoIps.length / enabledWanRules.length) * 100);
    findings.push({
      id: `f${++fid}`,
      severity: pct > 50 ? "high" : "low",
      title: `${wanNoIps.length} enabled WAN rule${wanNoIps.length > 1 ? "s" : ""} without IPS`,
      detail: `Intrusion Prevention is not applied on active rules: ${wanNoIps.slice(0, 6).join(", ")}${wanNoIps.length > 6 ? ` (+${wanNoIps.length - 6} more)` : ""}.`,
      section: "Intrusion Prevention",
      confidence: "high",
      evidence: `Rules ${wanNoIps.slice(0, 3).join(", ")} have IPS=none/empty`,
    });
  }

  const wanNoApp: string[] = [];
  for (const { name, row, enabled } of wanRules) {
    if (enabled && !hasAppControl(row)) wanNoApp.push(name);
  }
  if (wanNoApp.length > 0 && enabledWanRules.length > 0) {
    const pct = Math.round((wanNoApp.length / enabledWanRules.length) * 100);
    findings.push({
      id: `f${++fid}`,
      severity: pct > 75 ? "medium" : "low",
      title: `${wanNoApp.length} enabled WAN rule${wanNoApp.length > 1 ? "s" : ""} without Application Control`,
      detail: `Application Control is not enabled on active rules: ${wanNoApp.slice(0, 6).join(", ")}${wanNoApp.length > 6 ? ` (+${wanNoApp.length - 6} more)` : ""}.`,
      section: "Application Control",
      confidence: "high",
      evidence: `Rules ${wanNoApp.slice(0, 3).join(", ")} have Application Control=none/empty`,
    });
  }

  if (withSslInspection === 0 && wanRules.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "critical",
      title: "No SSL/TLS inspection rules configured (DPI inactive)",
      detail:
        "No SSL/TLS inspection rules were found. Without DPI, the firewall cannot decrypt and inspect HTTPS traffic for threats.",
      section: "SSL/TLS Inspection",
      confidence: "medium",
      evidence: "No SSL/TLS inspection rules section found in parsed config",
    });
  } else if (withSslInspection > 0 && sslDecryptRules === 0 && wanRules.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "critical",
      title: `${withSslInspection} SSL/TLS rule${withSslInspection !== 1 ? "s" : ""} but none decrypt traffic (DPI inactive)`,
      detail: `All ${withSslInspection} SSL/TLS inspection rules are exclusions. Without at least one Decrypt rule, no encrypted traffic is being inspected.`,
      section: "SSL/TLS Inspection",
      confidence: "medium",
      evidence: `All ${withSslInspection} SSL/TLS rules have Action=Do-not-decrypt`,
    });
  }

  if (sslUncoveredZones.length > 0 && sslDecryptRules > 0) {
    const zoneList = sslUncoveredZones.map((z) => z.toUpperCase()).join(", ");
    findings.push({
      id: `f${++fid}`,
      severity: "high",
      title: `${sslUncoveredZones.length} managed zone${sslUncoveredZones.length > 1 ? "s" : ""} not covered by SSL/TLS Decrypt rules`,
      detail: `Firewall rules send traffic from ${zoneList} to WAN, but no SSL/TLS Decrypt rule covers ${sslUncoveredZones.length > 1 ? "these zones" : "this zone"}.`,
      section: "SSL/TLS Inspection",
      confidence: "high",
      evidence: `WAN rules from zones ${zoneList} have no matching SSL/TLS Decrypt rule`,
    });
  }

  if (sslUncoveredNetworks.length > 0 && sslDecryptRules > 0) {
    const netList = sslUncoveredNetworks.join(", ");
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: `${sslUncoveredNetworks.length} source network${sslUncoveredNetworks.length > 1 ? "s" : ""} not covered by SSL/TLS Decrypt rules`,
      detail: `DPI is active but SSL/TLS Decrypt rules specify source networks that do not cover: ${netList}.`,
      section: "SSL/TLS Inspection",
      confidence: "medium",
      evidence: `WAN rules reference source networks ${netList} with no matching SSL/TLS Decrypt rule coverage`,
    });
  }

  analyseLocalServiceAcl(sections, findings, () => ++fid);
  analyseNatRulesDomain(sections, findings, () => ++fid);
  analyseWebFilterPolicies(sections, findings, () => ++fid);
  analyseIpsPolicies(sections, findings, () => ++fid);
  analyseVirusScanning(sections, findings, () => ++fid);
  analyseAdminSettings(sections, findings, () => ++fid);
  analyseBackupRestore(sections, findings, () => ++fid);
  analyseNotificationSettings(sections, findings, () => ++fid);
  analysePatternDownload(sections, findings, () => ++fid);
  analyseTimeSettings(sections, findings, () => ++fid);
  analyseAuthServers(sections, findings, () => ++fid);
  analyseHotfix(sections, findings, () => ++fid);
  analyseSyncAppControl(sections, findings, () => ++fid);
  analyseATP(sections, findings, () => ++fid);
  analyseMdrFeed(sections, findings, () => ++fid);
  analyseNdrEssentials(sections, findings, () => ++fid);
  analyseSecurityHeartbeat(sections, findings, () => ++fid, rulesTable);
  analyseVpnSecurity(sections, findings, () => ++fid);
  analyseSyslogServers(sections, findings, () => ++fid, options);
  analyseWirelessSecurity(sections, findings, () => ++fid);
  analyseSnmpCommunity(sections, findings, () => ++fid);
  analyseDnsSecurity(sections, findings, () => ++fid);
  analyseRedSecurity(sections, findings, () => ++fid);
  analyseDoSProtection(sections, findings, () => ++fid);
  analyseCertificates(sections, findings, () => ++fid);
  analyseHotspots(sections, findings, () => ++fid);
  analyseAppFilterPolicies(sections, findings, () => ++fid);
  analyseInterfaceSecurity(sections, findings, () => ++fid);
  analyseRuleOrdering(sections, findings, () => ++fid);
  analyseUserGroupRules(sections, findings, () => ++fid);
  analyseWafPolicies(sections, findings, () => ++fid);
  analyseZtna(sections, findings, () => ++fid);
  analyseFirmwareVersion(sections, findings, () => ++fid);
  analyseLicenceUsage(sections, findings, () => ++fid, options);

  const emptySections: string[] = [];
  for (const [key, data] of Object.entries(sections)) {
    if (data.tables.length === 0 && data.details.length === 0 && !data.text) {
      emptySections.push(key);
    }
  }
  if (emptySections.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "info",
      title: `${emptySections.length} section${emptySections.length > 1 ? "s" : ""} extracted with no data`,
      detail: `These sections were found but contained no parseable data: ${emptySections.join(", ")}.`,
      section: "Extraction",
      confidence: "medium",
      evidence: `Sections ${emptySections.slice(0, 5).join(", ")} have no tables/details/text`,
    });
  }

  const atpStatus = extractAtpStatus(sections);

  return {
    stats,
    findings,
    inspectionPosture,
    ruleColumns: rulesTable.headers,
    hostname: extractHostname(sections),
    managementIp: extractManagementIp(sections),
    atpStatus,
  };
}
