/**
 * Deterministic pre-AI analysis of extracted Sophos firewall config.
 * Produces repeatable findings without calling any LLM — runs entirely
 * in the browser on the extracted section data.
 */

import type { ExtractedSections, SectionData, TableData } from "./extract-sections";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface ConfigStats {
  totalRules: number;
  totalSections: number;
  totalHosts: number;
  totalNatRules: number;
  interfaces: number;
  populatedSections: number;
  emptySections: number;
  sectionNames: string[];
}

export interface SslTlsRule {
  name: string;
  action: "decrypt" | "exclude";
  sourceZones: string[];
  destZones: string[];
  enabled: boolean;
}

export interface InspectionPosture {
  totalWanRules: number;
  enabledWanRules: number;
  disabledWanRules: number;
  /** Enabled WAN rules with HTTP/HTTPS/ANY service that should have web filtering */
  webFilterableRules: number;
  withWebFilter: number;
  withoutWebFilter: number;
  withAppControl: number;
  withIps: number;
  /** Total SSL/TLS inspection rules (Decrypt + Do-not-decrypt) */
  withSslInspection: number;
  /** Only Decrypt rules (actual inspection) */
  sslDecryptRules: number;
  /** Do-not-decrypt exclusion rules */
  sslExclusionRules: number;
  /** Parsed SSL/TLS rules with zone/action detail */
  sslRules: SslTlsRule[];
  /** Firewall WAN source zones not covered by any SSL/TLS Decrypt rule */
  sslUncoveredZones: string[];
  wanRuleNames: string[];
  totalDisabledRules: number;
  /** true when at least one SSL/TLS Decrypt rule exists (DPI active on Sophos XGS) */
  dpiEngineEnabled: boolean;
}

export type Confidence = "high" | "medium" | "low";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  section: string;
  remediation?: string;
  confidence?: Confidence;
  evidence?: string;
}

export interface AtpStatus {
  enabled: boolean;
  policy: string;
}

export interface ThreatStatus {
  firmwareVersion: string;
  atp: { enabled: boolean; policy: string; inspectContent: string } | null;
  mdr: { enabled: boolean; policy: string; connected: boolean } | null;
  ndr: {
    enabled: boolean;
    interfaces: string[];
    dataCenter: string;
    minThreatScore: string;
    iocCount?: number;
  } | null;
  thirdPartyFeeds: Array<{
    name: string;
    syncStatus: string;
    lastSync?: string;
  }> | null;
  collectedAt: string;
}

export interface AnalysisResult {
  stats: ConfigStats;
  findings: Finding[];
  inspectionPosture: InspectionPosture;
  ruleColumns?: string[];
  hostname?: string;
  atpStatus?: AtpStatus;
  threatStatus?: ThreatStatus;
}

const SEVERITY_ICON: Record<Severity, string> = {
  critical: "\u{1F534}",
  high: "\u{1F7E0}",
  medium: "\u{1F7E1}",
  low: "\u{1F7E2}",
  info: "\u{1F535}",
};

export function severityIcon(s: Severity): string {
  return SEVERITY_ICON[s];
}

function isWanDest(row: Record<string, string>): boolean {
  // Prefer detail-block "Destination Zones" over main-table "Destination" (which may also be zone)
  const dz = (
    row["Destination Zones"] ?? row["Destination Zone"] ?? row["Dest Zone"] ??
    row["DestZone"] ?? row["Dest zone"] ?? row["Destination zone"] ?? row["DstZone"] ??
    row["Destination"] ?? ""
  ).toLowerCase().trim();
  return dz === "wan" || dz.includes("wan");
}

function isWebService(row: Record<string, string>): boolean {
  const svc = (
    row["Service"] ?? row["Services"] ?? row["Services/Ports"] ??
    row["service"] ?? row["Services Used"] ?? ""
  ).toLowerCase().trim();
  if (!svc) return false;
  // Exclude protocols that never carry web traffic
  const nonWebOnly = /^(dns|ntp|smtp|smtps|snmp|syslog|ldap|ldaps|radius|ssh|telnet|icmp|ping|ftp|sip|imap|imaps|pop3|pop3s|bgp|ospf|rip|dhcp|tftp|kerberos|nfs|smb|cifs|ipsec|gre|l2tp|pptp|netbios)$/i;
  if (nonWebOnly.test(svc)) return false;
  if (svc === "any") return true;
  if (svc.includes("http")) return true;
  if (svc.includes("web")) return true;
  if (/\b(80|443|8080|8443)\b/.test(svc)) return true;
  return false;
}

function hasWebFilter(row: Record<string, string>): boolean {
  const wf = (
    row["Web Filter"] ?? row["Web Filter Policy"] ?? row["WebFilter"] ??
    row["Web Policy"] ?? row["Web Filtering"] ?? row["Content Filter"] ??
    row["Web filter"] ?? ""
  ).toLowerCase().trim();
  return wf !== "" && wf !== "none" && wf !== "not specified" && wf !== "-" && wf !== "n/a";
}

function isLoggingOff(row: Record<string, string>): boolean {
  const log = (
    row["Log"] ?? row["Log Traffic"] ?? row["Logging"] ?? row["logging"] ?? ""
  ).toLowerCase().trim();
  return log === "disabled" || log === "off" || log === "disable" || log === "no";
}

function isRuleDisabled(row: Record<string, string>): boolean {
  const status = (
    row["Status"] ?? row["Rule Status"] ?? row["Enabled"] ?? row["Active"] ?? ""
  ).toLowerCase().trim();
  if (status.includes("off") || status.includes("disable") || status.includes("inactive")) return true;
  if (status === "no" || status === "false" || status === "0") return true;
  return false;
}

function isAnyService(row: Record<string, string>): boolean {
  const svc = (
    row["Service"] ?? row["Services"] ?? row["Services/Ports"] ?? row["service"] ?? ""
  ).toLowerCase().trim();
  return svc === "any";
}

function isBroadSource(row: Record<string, string>): boolean {
  const raw = row["Source Networks"] ?? row["Source"] ?? row["Src Networks"];
  if (raw === undefined) return false;
  const src = raw.toLowerCase().trim();
  return src === "any";
}

function isBroadDest(row: Record<string, string>): boolean {
  const raw = row["Destination Networks"] ?? row["Destination"] ?? row["Dest Networks"];
  if (raw === undefined) return false;
  const dst = raw.toLowerCase().trim();
  return dst === "any";
}

function ruleName(row: Record<string, string>): string {
  return row["Rule Name"] ?? row["Name"] ?? row["Rule"] ?? row["#"] ?? "Unnamed";
}

function hasAppControl(row: Record<string, string>): boolean {
  const ac = (
    row["Application Control"] ?? row["App Control"] ?? row["AppControl"] ??
    row["Application Filter"] ?? row["Application filter"] ?? row["App Filter"] ?? ""
  ).toLowerCase().trim();
  return ac !== "" && ac !== "none" && ac !== "not specified" && ac !== "-" && ac !== "n/a";
}

function hasIps(row: Record<string, string>): boolean {
  const ips = (
    row["IPS"] ?? row["Intrusion Prevention"] ?? row["IPS Policy"] ??
    row["IPS policy"] ?? row["Intrusion prevention"] ?? ""
  ).toLowerCase().trim();
  return ips !== "" && ips !== "none" && ips !== "not specified" && ips !== "-" && !ips.includes("disable") && ips !== "off" && ips !== "n/a";
}

function ruleSignature(row: Record<string, string>): string {
  const src = (row["Source Networks"] ?? row["Source"] ?? row["Src Networks"] ?? "").toLowerCase().trim();
  const dst = (row["Destination Networks"] ?? row["Destination"] ?? row["Dest Networks"] ?? "").toLowerCase().trim();
  const svc = (row["Service"] ?? row["Services"] ?? row["Services/Ports"] ?? row["service"] ?? "").toLowerCase().trim();
  const srcZ = (row["Source Zone"] ?? row["Source Zones"] ?? row["Src Zone"] ?? "").toLowerCase().trim();
  const dstZ = (row["Destination Zone"] ?? row["Destination Zones"] ?? row["Dest Zone"] ?? row["DestZone"] ?? "").toLowerCase().trim();
  return `${srcZ}|${src}|${dstZ}|${dst}|${svc}`;
}

function isSubsetOrEqual(specific: string, broad: string): boolean {
  if (broad.toLowerCase() === "any") return true;
  return specific.toLowerCase() === broad.toLowerCase();
}

function findFirewallRulesTable(sections: ExtractedSections): TableData | null {
  for (const key of Object.keys(sections)) {
    if (/firewall\s*rules?/i.test(key)) {
      const tables = sections[key].tables;
      if (tables.length > 0) return tables[0];
    }
  }
  return null;
}

function findOtpSection(sections: ExtractedSections): SectionData | null {
  for (const key of Object.keys(sections)) {
    if (/otp|authentication/i.test(key)) return sections[key];
  }
  return null;
}

/** Parse SSL/TLS inspection rules with action (Decrypt vs Do-not-decrypt) and zone coverage. */
function parseSslTlsRules(sections: ExtractedSections): SslTlsRule[] {
  const rules: SslTlsRule[] = [];
  for (const key of Object.keys(sections)) {
    if (!/ssl.*tls.*inspection|tls.*inspection/i.test(key)) continue;
    for (const t of sections[key].tables) {
      // Skip Setting/Value tables (grid-extracted key-value pairs, not rules)
      if (t.headers.length === 2 && t.headers.includes("Setting") && t.headers.includes("Value")) continue;
      for (const row of t.rows) {
        // Only process rows that have rule-relevant columns
        const hasRuleColumns = row["Decrypt Action"] || row["Action"] || row["Decrypt action"] ||
          row["Source Zone"] || row["Dest Zone"] || row["Source Zones"] || row["Destination Zones"];
        if (!hasRuleColumns) continue;

        const name = row["Rule Name"] ?? row["Name"] ?? row["Rule"] ?? "Unnamed";
        const actionRaw = (
          row["Decrypt Action"] ?? row["Action"] ?? row["Decrypt action"] ?? ""
        ).toLowerCase().trim();
        const source = (
          row["Source"] ?? row["Source Zones"] ?? row["Source Zone"] ??
          row["Src Zone"] ?? row["Src Zones"] ?? ""
        ).trim();
        const dest = (
          row["Destination"] ?? row["Destination Zones"] ?? row["Destination Zone"] ??
          row["Dest Zone"] ?? row["Dest Zones"] ?? ""
        ).trim();
        const status = (row["Status"] ?? "").toLowerCase().trim();

        const isExclude = actionRaw.includes("do not") || actionRaw.includes("don't") || actionRaw.includes("bypass");
        const splitZones = (z: string) =>
          z.toLowerCase() === "any" ? ["any"] : z.split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);

        rules.push({
          name,
          action: isExclude ? "exclude" : "decrypt",
          sourceZones: splitZones(source),
          destZones: splitZones(dest),
          enabled: !status.includes("off") && !status.includes("disable") && !status.includes("inactive") && status !== "0",
        });
      }
    }
  }
  return rules;
}

/**
 * Cross-reference firewall WAN rules with SSL/TLS Decrypt rules.
 * Returns source zones that have firewall rules going to WAN
 * but are NOT covered by any enabled Decrypt SSL/TLS rule.
 */
function findUncoveredZones(
  wanRules: Array<{ name: string; row: Record<string, string>; enabled: boolean }>,
  sslRules: SslTlsRule[],
): string[] {
  const decryptRules = sslRules.filter((r) => r.action === "decrypt" && r.enabled);
  if (decryptRules.length === 0) return [];

  // Build set of source zones used by enabled firewall WAN rules
  const fwSourceZones = new Set<string>();
  for (const { row, enabled } of wanRules) {
    if (!enabled) continue;
    const sz = (
      row["Source Zones"] ?? row["Source Zone"] ?? row["Src Zone"] ?? row["Source"] ?? ""
    ).toLowerCase().trim();
    if (sz && sz !== "any") {
      sz.split(/[,;]/).forEach((z) => {
        const trimmed = z.trim();
        if (trimmed) fwSourceZones.add(trimmed);
      });
    }
  }

  if (fwSourceZones.size === 0) return [];

  // Check which FW source zones are covered by a Decrypt rule destined for WAN
  const uncovered: string[] = [];
  for (const zone of fwSourceZones) {
    const isCovered = decryptRules.some((r) => {
      const srcMatch = r.sourceZones.includes("any") || r.sourceZones.includes(zone);
      const dstMatch = r.destZones.includes("any") || r.destZones.some((d) => d.includes("wan"));
      return srcMatch && dstMatch;
    });
    if (!isCovered) uncovered.push(zone);
  }
  return uncovered;
}

function countRows(sections: ExtractedSections, pattern: RegExp): number {
  let count = 0;
  for (const key of Object.keys(sections)) {
    if (pattern.test(key)) {
      for (const t of sections[key].tables) count += t.rows.length;
    }
  }
  return count;
}

/** Count interface rows from the ports/VLANs section only, excluding Setting/Value grid noise. */
function countInterfaceRows(sections: ExtractedSections): number {
  for (const key of Object.keys(sections)) {
    if (!/interface|port|vlan/i.test(key)) continue;
    for (const t of sections[key].tables) {
      if (t.headers.includes("Interface / VLAN")) {
        return t.rows.length;
      }
    }
  }
  return 0;
}

/** Extract the firewall hostname from Admin Settings > Hostname Settings. */
function extractHostname(sections: ExtractedSections): string | undefined {
  const section = findSection(sections, /^AdminSettings$/i) ?? findSection(sections, /admin.?settings/i);
  if (!section) return undefined;
  const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");
  const m = text.match(/Host\s*Name["\s:]+([^\s",}]+)/i);
  return m?.[1] || undefined;
}

export interface AnalyseOptions {
  /** True when the firewall is linked to Sophos Central (logs forwarded automatically). */
  centralLinked?: boolean;
}

/**
 * Run deterministic analysis on a single firewall's extracted sections.
 */
export function analyseConfig(sections: ExtractedSections, options?: AnalyseOptions): AnalysisResult {
  const findings: Finding[] = [];
  let fid = 0;

  const sectionNames = Object.keys(sections);
  const totalSections = sectionNames.length;
  const rulesTable = findFirewallRulesTable(sections);
  const totalRules = rulesTable ? rulesTable.rows.length : 0;
  const totalHosts = countRows(sections, /hosts?|networks?/i);
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
    totalRules, totalSections, totalHosts, totalNatRules, interfaces,
    populatedSections, emptySections: emptySectionCount, sectionNames,
  };

  const emptyPosture: InspectionPosture = {
    totalWanRules: 0, enabledWanRules: 0, disabledWanRules: 0,
    webFilterableRules: 0, withWebFilter: 0, withoutWebFilter: 0,
    withAppControl: 0, withIps: 0, withSslInspection: 0,
    sslDecryptRules: 0, sslExclusionRules: 0, sslRules: [], sslUncoveredZones: [],
    wanRuleNames: [], totalDisabledRules: 0, dpiEngineEnabled: false,
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
    return { stats, findings, inspectionPosture: emptyPosture, ruleColumns: [], hostname: extractHostname(sections), atpStatus: extractAtpStatus(sections) };
  }

  // --- Track disabled rules across all rules ---
  let totalDisabledRules = 0;
  for (const row of rulesTable.rows) {
    if (isRuleDisabled(row)) totalDisabledRules++;
  }

  // --- Build inspection posture for WAN rules ---
  const wanRules: Array<{ name: string; row: Record<string, string>; enabled: boolean }> = [];
  for (const row of rulesTable.rows) {
    if (isWanDest(row)) {
      wanRules.push({ name: ruleName(row), row, enabled: !isRuleDisabled(row) });
    }
  }
  const enabledWanRules = wanRules.filter((r) => r.enabled);
  const disabledWanRules = wanRules.filter((r) => !r.enabled);

  let webFilterableRules = 0, withWebFilter = 0, withoutWebFilter = 0;
  let withAppControl = 0, withIps = 0, withSslInspection = 0;
  for (const { row, enabled } of wanRules) {
    if (!enabled) continue; // only score enabled rules
    if (isWebService(row)) {
      webFilterableRules++;
      if (hasWebFilter(row)) withWebFilter++; else withoutWebFilter++;
    }
    if (hasAppControl(row)) withAppControl++;
    if (hasIps(row)) withIps++;
  }
  // SSL/TLS inspection rules = DPI engine on Sophos XGS
  const sslRules = parseSslTlsRules(sections);
  withSslInspection = sslRules.length;
  const sslDecryptRules = sslRules.filter((r) => r.action === "decrypt" && r.enabled).length;
  const sslExclusionRules = sslRules.filter((r) => r.action === "exclude").length;
  const dpiEngineEnabled = sslDecryptRules > 0;
  const sslUncoveredZones = findUncoveredZones(wanRules, sslRules);

  const inspectionPosture: InspectionPosture = {
    totalWanRules: wanRules.length,
    enabledWanRules: enabledWanRules.length,
    disabledWanRules: disabledWanRules.length,
    webFilterableRules, withWebFilter, withoutWebFilter,
    withAppControl, withIps, withSslInspection,
    sslDecryptRules, sslExclusionRules, sslRules, sslUncoveredZones,
    wanRuleNames: wanRules.map((w) => w.name),
    totalDisabledRules,
    dpiEngineEnabled,
  };

  // --- Disabled WAN rules ---
  if (disabledWanRules.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: `${disabledWanRules.length} WAN rule${disabledWanRules.length > 1 ? "s" : ""} disabled`,
      detail: `Disabled WAN-facing rules: ${disabledWanRules.map((r) => r.name).slice(0, 6).join(", ")}${disabledWanRules.length > 6 ? ` (+${disabledWanRules.length - 6} more)` : ""}. These rules provide no protection — verify if they should be re-enabled or removed.`,
      section: "Firewall Rules",
      remediation: "Go to Rules and policies > Firewall rules. Review disabled WAN rules — if no longer needed, delete them. If they should be active, re-enable them and configure web filtering, IPS, and app control.",
      confidence: "high",
      evidence: `Rules with Status=Off/Disabled and Destination Zone=WAN: ${disabledWanRules.map((r) => r.name).slice(0, 4).join(", ")}`,
    });
  }

  // --- Disabled rules estate-wide ---
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

  // (SSL/TLS inspection = DPI engine — covered in the SSL/TLS finding below)

  // --- WAN rules with no web filtering (enabled rules only) ---
  const wanNoFilter: string[] = [];
  for (const { name, row, enabled } of wanRules) {
    if (enabled && isWebService(row) && !hasWebFilter(row)) wanNoFilter.push(name);
  }
  if (wanNoFilter.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "critical",
      title: `${wanNoFilter.length} enabled WAN rule${wanNoFilter.length > 1 ? "s" : ""} missing web filtering`,
      detail: `Active rules with Destination Zone WAN and Service HTTP/HTTPS/ANY have no Web Filter applied: ${wanNoFilter.slice(0, 8).join(", ")}${wanNoFilter.length > 8 ? ` (+${wanNoFilter.length - 8} more)` : ""}. This is a KCSIE/DfE compliance gap.`,
      section: "Firewall Rules",
      remediation: "Go to Rules and policies > Firewall rules. Edit each affected rule → expand Web filtering → set a Web policy. Manage policies under Web > Policies. Ensure the policy blocks inappropriate content for your environment.",
      confidence: "high",
      evidence: `Rules ${wanNoFilter.slice(0, 3).join(", ")} have Web Filter=none/empty with Service=HTTP/HTTPS/ANY`,
    });
  }

  // --- Logging disabled ---
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
      remediation: "Go to Rules and policies > Firewall rules. Edit each affected rule → tick 'Log firewall traffic' (near the top, below the Action setting). To send logs externally, configure System services > Log settings.",
      confidence: "high",
      evidence: `Rules ${loggingOff.slice(0, 3).join(", ")} have Log=disabled/off`,
    });
  }

  // --- Classify rules by openness: fully open vs ANY service only vs broad network only ---
  const KNOWN_SYSTEM_RULES = /^(allow dns requests|auto added firewall policy for mta|auto added rule for mta)$/i;
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
      remediation: "Review each rule under Rules and policies > Firewall rules. Restrict source/destination to specific network objects and replace 'Any' service with specific protocols. Use the Log viewer to identify actual traffic patterns before tightening.",
      confidence: "high",
      evidence: `Rules ${fullyOpen.slice(0, 3).join(", ")} have Source=Any, Destination=Any, Service=ANY`,
    });
  }

  if (anySvcOnly.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: `${anySvcOnly.length} rule${anySvcOnly.length > 1 ? "s" : ""} using "ANY" service`,
      detail: `Rules permitting all services but with specific source/destination: ${anySvcOnly.slice(0, 8).join(", ")}${anySvcOnly.length > 8 ? ` (+${anySvcOnly.length - 8} more)` : ""}. Broad service rules increase attack surface.`,
      section: "Firewall Rules",
      remediation: "Review traffic logs via the Log viewer to identify which protocols are in use. Create specific service objects under Hosts and services > Services. Edit each rule to replace 'Any' with specific services.",
      confidence: "high",
      evidence: `Rules ${anySvcOnly.slice(0, 3).join(", ")} have Service=ANY`,
    });
  }

  if (broadNetOnly.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: `${broadNetOnly.length} rule${broadNetOnly.length > 1 ? "s" : ""} with broad source and destination`,
      detail: `Rules with both Source and Destination set to "Any" but with specific services: ${broadNetOnly.slice(0, 6).join(", ")}${broadNetOnly.length > 6 ? ` (+${broadNetOnly.length - 6} more)` : ""}. Consider restricting to specific networks.`,
      section: "Firewall Rules",
      remediation: "Create specific IP host or IP host group objects under Hosts and services. Edit each broad rule under Rules and policies > Firewall rules to replace 'Any' source/destination with named network objects.",
      confidence: "high",
      evidence: `Rules ${broadNetOnly.slice(0, 3).join(", ")} have Source=Any and Destination=Any`,
    });
  }

  // --- MFA/OTP checks ---
  const otpSection = findOtpSection(sections);
  if (otpSection) {
    const otpDisabled: string[] = [];
    for (const table of otpSection.tables) {
      for (const row of table.rows) {
        const setting = row["Setting"] ?? Object.keys(row)[0] ?? "";
        const value = (row["Value"] ?? row[setting] ?? "").toLowerCase();
        if (/otp|mfa|2fa/i.test(setting) && (value === "disabled" || value === "off" || value === "no")) {
          otpDisabled.push(setting);
        }
      }
    }
    if (otpDisabled.length > 0) {
      findings.push({
        id: `f${++fid}`,
        severity: "high",
        title: `MFA/OTP disabled for ${otpDisabled.length} area${otpDisabled.length > 1 ? "s" : ""}`,
        detail: `Multi-factor authentication is not enabled for: ${otpDisabled.join(", ")}. All admin and VPN access should require MFA.`,
        section: "Authentication & OTP",
        remediation: "Go to Authentication > Multi-factor authentication. Set One-time password to 'All users'. Select all services: Web admin console, User portal, VPN portal, SSL VPN, IPsec. Enable 'Generate OTP token with next sign-in'.",
        confidence: "high",
        evidence: `OTP/Auth section: ${otpDisabled.slice(0, 3).join(", ")} set to disabled/off`,
      });
    }
  }

  // --- Duplicate / overlapping rules ---
  const sigMap = new Map<string, string[]>();
  for (const row of rulesTable.rows) {
    const sig = ruleSignature(row);
    if (!sig || sig === "||||") continue;
    const name = ruleName(row);
    const existing = sigMap.get(sig);
    if (existing) existing.push(name);
    else sigMap.set(sig, [name]);
  }
  const duplicateGroups = [...sigMap.values()].filter((g) => g.length > 1);
  if (duplicateGroups.length > 0) {
    const totalDupes = duplicateGroups.reduce((s, g) => s + g.length, 0);
    const examples = duplicateGroups.slice(0, 3).map((g) => g.join(" / ")).join("; ");
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: `${totalDupes} rules in ${duplicateGroups.length} overlapping group${duplicateGroups.length > 1 ? "s" : ""}`,
      detail: `Rules with identical source zone, source network, destination zone, destination network, and service: ${examples}${duplicateGroups.length > 3 ? ` (+${duplicateGroups.length - 3} more groups)` : ""}. Overlapping rules may cause shadowing or redundant processing.`,
      section: "Firewall Rules",
      remediation: "Go to Rules and policies > Firewall rules. Review overlapping rule groups and consolidate or delete duplicates. Sophos Firewall evaluates rules top-down — shadowed rules never fire. Use rule groups to organise.",
      confidence: "high",
      evidence: `Identical rule signatures: ${duplicateGroups.slice(0, 2).map((g) => g.join("/")).join("; ")}`,
    });
  }

  // --- WAN rules without IPS (enabled only) ---
  const wanNoIps: string[] = [];
  for (const { name, row, enabled } of wanRules) {
    if (enabled && !hasIps(row)) wanNoIps.push(name);
  }
  if (wanNoIps.length > 0 && enabledWanRules.length > 0) {
    const pct = Math.round((wanNoIps.length / enabledWanRules.length) * 100);
    findings.push({
      id: `f${++fid}`,
      severity: pct > 50 ? "high" : "low",
      title: `${wanNoIps.length} enabled WAN rule${wanNoIps.length > 1 ? "s" : ""} without IPS (${pct}%)`,
      detail: `Intrusion Prevention is not applied on active rules: ${wanNoIps.slice(0, 6).join(", ")}${wanNoIps.length > 6 ? ` (+${wanNoIps.length - 6} more)` : ""}. WAN-facing traffic should have IPS enabled to detect exploit attempts.`,
      section: "Intrusion Prevention",
      remediation: "Go to Intrusion prevention > IPS policies and ensure IPS protection is turned on. Create or select a policy. Then edit each affected rule under Rules and policies > Firewall rules → Other security features → 'Detect and prevent exploits (IPS)'.",
      confidence: "high",
      evidence: `Rules ${wanNoIps.slice(0, 3).join(", ")} have IPS=none/empty`,
    });
  }

  // --- WAN rules without Application Control (enabled only) ---
  const wanNoApp: string[] = [];
  for (const { name, row, enabled } of wanRules) {
    if (enabled && !hasAppControl(row)) wanNoApp.push(name);
  }
  if (wanNoApp.length > 0 && enabledWanRules.length > 0) {
    const pct = Math.round((wanNoApp.length / enabledWanRules.length) * 100);
    findings.push({
      id: `f${++fid}`,
      severity: pct > 75 ? "medium" : "low",
      title: `${wanNoApp.length} enabled WAN rule${wanNoApp.length > 1 ? "s" : ""} without Application Control (${pct}%)`,
      detail: `Application Control is not enabled on active rules: ${wanNoApp.slice(0, 6).join(", ")}${wanNoApp.length > 6 ? ` (+${wanNoApp.length - 6} more)` : ""}. Application-layer visibility is limited without this feature.`,
      section: "Application Control",
      remediation: "Create an application filter policy under Applications > Application filter. Then edit each affected rule under Rules and policies > Firewall rules → Other security features → 'Identify and control applications (App control)'.",
      confidence: "high",
      evidence: `Rules ${wanNoApp.slice(0, 3).join(", ")} have Application Control=none/empty`,
    });
  }

  // --- SSL/TLS inspection (DPI engine) coverage ---
  if (withSslInspection === 0 && wanRules.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "critical",
      title: "No SSL/TLS inspection rules configured (DPI inactive)",
      detail: "No SSL/TLS inspection rules were found. On Sophos XGS, SSL/TLS inspection is the DPI engine — without it, the firewall cannot decrypt and inspect HTTPS traffic for threats, significantly reducing the effectiveness of web filtering, IPS, and application control on encrypted traffic.",
      section: "SSL/TLS Inspection",
      remediation: "Go to Rules and policies > SSL/TLS inspection rules. Add a Decrypt rule for LAN→WAN traffic. Download the signing CA from SSL/TLS inspection settings and deploy to endpoints. Add exclusion rules ('Don't decrypt') above for incompatible services.",
      confidence: "medium",
      evidence: "No SSL/TLS inspection rules section found in parsed config",
    });
  } else if (withSslInspection > 0 && sslDecryptRules === 0 && wanRules.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "critical",
      title: `${withSslInspection} SSL/TLS rule${withSslInspection !== 1 ? "s" : ""} but none decrypt traffic (DPI inactive)`,
      detail: `All ${withSslInspection} SSL/TLS inspection rules are exclusions ("Do not decrypt"). Without at least one Decrypt rule, no encrypted traffic is being inspected — web filtering, IPS, and application control cannot operate on HTTPS traffic.`,
      section: "SSL/TLS Inspection",
      remediation: "Go to Rules and policies > SSL/TLS inspection rules. Add a Decrypt rule for LAN→WAN traffic below the exclusion rules. Download the signing CA from SSL/TLS inspection settings and deploy to endpoints.",
      confidence: "medium",
      evidence: `All ${withSslInspection} SSL/TLS rules have Action=Do-not-decrypt (no Decrypt rules)`,
    });
  }

  // --- SSL/TLS zone coverage gaps ---
  if (sslUncoveredZones.length > 0 && sslDecryptRules > 0) {
    const zoneList = sslUncoveredZones.map((z) => z.toUpperCase()).join(", ");
    findings.push({
      id: `f${++fid}`,
      severity: "high",
      title: `${sslUncoveredZones.length} source zone${sslUncoveredZones.length > 1 ? "s" : ""} not covered by SSL/TLS Decrypt rules`,
      detail: `Firewall rules send traffic from ${zoneList} to WAN, but no SSL/TLS Decrypt rule covers ${sslUncoveredZones.length > 1 ? "these zones" : "this zone"}. Encrypted traffic from ${zoneList} bypasses DPI — web filtering, IPS, and app control cannot inspect it.`,
      section: "SSL/TLS Inspection",
      remediation: `Go to Rules and policies > SSL/TLS inspection rules. Add or update a Decrypt rule to include ${zoneList} as source zone${sslUncoveredZones.length > 1 ? "s" : ""}. Ensure the signing CA certificate is deployed to all endpoints in ${sslUncoveredZones.length > 1 ? "these zones" : "this zone"}.`,
      confidence: "high",
      evidence: `WAN rules from zones ${zoneList} have no matching SSL/TLS Decrypt rule`,
    });
  }

  // --- Admin Access Exposure (Local Service ACL) ---
  analyseLocalServiceAcl(sections, findings, () => ++fid);

  // --- NAT Rule Security Analysis ---
  analyseNatRules(sections, findings, () => ++fid);

  // --- Web Filter Policy Deep Dive ---
  analyseWebFilterPolicies(sections, findings, () => ++fid);

  // --- IPS Policy Deep Dive ---
  analyseIpsPolicies(sections, findings, () => ++fid);

  // --- Virus Scanning Analysis ---
  analyseVirusScanning(sections, findings, () => ++fid);

  // --- Device Hardening Analysis (Sophos Health Check items) ---
  analyseAdminSettings(sections, findings, () => ++fid);
  analyseBackupRestore(sections, findings, () => ++fid);
  analyseNotificationSettings(sections, findings, () => ++fid);
  analysePatternDownload(sections, findings, () => ++fid);
  analyseTimeSettings(sections, findings, () => ++fid);
  analyseAuthServers(sections, findings, () => ++fid);
  analyseHotfix(sections, findings, () => ++fid);
  analyseSyncAppControl(sections, findings, () => ++fid);
  analyseATP(sections, findings, () => ++fid);

  // --- Extended security analysis (VPN, DoS, SNMP, Wireless, Syslog, DNS, etc.) ---
  analyseVpnSecurity(sections, findings, () => ++fid);
  analyseDoSProtection(sections, findings, () => ++fid);
  analyseSyslogServers(sections, findings, () => ++fid, options);
  analyseWirelessSecurity(sections, findings, () => ++fid);
  analyseSnmpCommunity(sections, findings, () => ++fid);
  analyseDnsSecurity(sections, findings, () => ++fid);
  analyseRedSecurity(sections, findings, () => ++fid);

  // --- L2/L6/L7/L8: Certificates, Hotspots, App Filter, Interface Security ---
  analyseCertificates(sections, findings, () => ++fid);
  analyseHotspots(sections, findings, () => ++fid);
  analyseAppFilterPolicies(sections, findings, () => ++fid);
  analyseInterfaceSecurity(sections, findings, () => ++fid);

  // --- D1–D4: Rule hygiene, schedules, user/group, WAF ---
  analyseRuleOrdering(sections, findings, () => ++fid);
  analyseUserGroupRules(sections, findings, () => ++fid);
  analyseWafPolicies(sections, findings, () => ++fid);

  // --- D5–D7: ZTNA, firmware EOL, licence usage ---
  analyseZtna(sections, findings, () => ++fid);
  analyseFirmwareVersion(sections, findings, () => ++fid);
  analyseLicenceUsage(sections, findings, () => ++fid, options);

  // --- Empty sections warning ---
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
      detail: `These sections were found but contained no parseable data: ${emptySections.join(", ")}. This may indicate an unsupported export format or empty configuration areas.`,
      section: "Extraction",
      confidence: "medium",
      evidence: `Sections ${emptySections.slice(0, 5).join(", ")} have no tables/details/text`,
    });
  }

  const atpStatus = extractAtpStatus(sections);

  return { stats, findings, inspectionPosture, ruleColumns: rulesTable.headers, hostname: extractHostname(sections), atpStatus };
}

/**
 * Generate additional findings based on threat telemetry from agent submissions.
 * Each finding is only generated when the feature is available on the detected firmware.
 */
export function analyseThreatStatus(threatStatus: ThreatStatus): Finding[] {
  const findings: Finding[] = [];
  let fid = 9000;

  const fwMajor = parseFloat(threatStatus.firmwareVersion.replace(/^v/i, ""));

  // ATP (v19+)
  if (threatStatus.atp && fwMajor >= 19) {
    if (!threatStatus.atp.enabled) {
      findings.push({
        id: `t-${++fid}`,
        severity: "high",
        title: "Sophos X-Ops Active Threat Response is disabled",
        detail: "Active Threat Response provides real-time threat intelligence from Sophos X-Ops. Disabling it removes automatic blocking of known malicious indicators.",
        section: "Threat Protection",
        confidence: "high",
      });
    } else if (threatStatus.atp.policy.toLowerCase().includes("log only")) {
      findings.push({
        id: `t-${++fid}`,
        severity: "low",
        title: "ATP is in log-only mode — threats are not being dropped",
        detail: "Active Threat Response is enabled but set to 'Log Only'. Detected threats are logged but not blocked. Consider switching to 'Log and Drop' for active protection.",
        section: "Threat Protection",
        confidence: "high",
      });
    }
  }

  // MDR (v21+)
  if (fwMajor >= 21) {
    if (threatStatus.mdr && !threatStatus.mdr.enabled) {
      findings.push({
        id: `t-${++fid}`,
        severity: "medium",
        title: "MDR threat feed is not active",
        detail: "The Managed Detection and Response threat feed is disabled. Enable it to receive real-time threat indicators from Sophos MDR analysts.",
        section: "Threat Protection",
        confidence: "high",
      });
    }
  }

  // Third-party feeds (v21+)
  if (threatStatus.thirdPartyFeeds && fwMajor >= 21) {
    const failedFeeds = threatStatus.thirdPartyFeeds.filter(
      (f) => f.syncStatus.toLowerCase() !== "success"
    );
    if (failedFeeds.length > 0) {
      findings.push({
        id: `t-${++fid}`,
        severity: "info",
        title: `Third-party threat feed sync failure detected (${failedFeeds.length} feed${failedFeeds.length > 1 ? "s" : ""})`,
        detail: `The following feeds have sync issues: ${failedFeeds.map((f) => f.name).join(", ")}. Check feed URLs and network connectivity.`,
        section: "Threat Protection",
        confidence: "medium",
      });
    }
  }

  // NDR (v21.5+ XGS)
  if (fwMajor >= 21.5) {
    if (threatStatus.ndr && !threatStatus.ndr.enabled) {
      findings.push({
        id: `t-${++fid}`,
        severity: "medium",
        title: "NDR Essentials is not enabled",
        detail: "Network Detection and Response Essentials provides deep network traffic analysis for advanced threat detection. Enable NDR to gain visibility into lateral movement and encrypted traffic anomalies.",
        section: "Threat Protection",
        confidence: "high",
      });
    }
    if (threatStatus.ndr?.enabled && threatStatus.ndr.minThreatScore) {
      const score = parseInt(threatStatus.ndr.minThreatScore, 10);
      if (!isNaN(score) && score < 30) {
        findings.push({
          id: `t-${++fid}`,
          severity: "info",
          title: "NDR threat score threshold may generate excessive alerts",
          detail: `The minimum threat score threshold is set to ${score}. Low thresholds can result in alert fatigue. Consider raising it to 30+ unless you have capacity to triage high volumes.`,
          section: "Threat Protection",
          confidence: "low",
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Extended analysis functions — analyse sections beyond firewall rules
// ---------------------------------------------------------------------------

function findSection(sections: ExtractedSections, pattern: RegExp): SectionData | null {
  for (const key of Object.keys(sections)) {
    if (pattern.test(key)) return sections[key];
  }
  return null;
}

function extractAtpStatus(sections: ExtractedSections): AtpStatus | undefined {
  const atp = findSection(sections, /advanced\s*threat\s*protection|^atp$/i);
  if (!atp) return undefined;

  let enabled = false;
  let policy = "";

  for (const t of atp.tables) {
    for (const row of t.rows) {
      const setting = (row["Setting"] ?? "").toLowerCase();
      const value = (row["Value"] ?? "").trim();
      if (setting.includes("threatprotectionstatus") || setting.includes("status")) {
        enabled = /enabled|on|yes|true/i.test(value);
      }
      if (setting.includes("policy") || setting.includes("action")) {
        policy = value;
      }
    }
  }

  return { enabled, policy };
}

/** Admin Access Exposure — flag management services accessible from untrusted zones */
function analyseLocalServiceAcl(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const acl = findSection(sections, /local\s*service\s*acl|device\s*access|admin\s*service/i);
  if (!acl) return;

  const SENSITIVE_SERVICES = /https|ssh|admin|webadmin|gui|snmp|api|telnet/i;
  const UNTRUSTED_ZONES = /wan|any|dmz|guest|untrust|external|public/i;

  const exposed: { service: string; zones: string }[] = [];
  for (const t of acl.tables) {
    for (const row of t.rows) {
      const service = row["Service"] ?? row["Name"] ?? row["Service Name"] ?? Object.values(row)[0] ?? "";
      if (!SENSITIVE_SERVICES.test(service)) continue;

      for (const [key, val] of Object.entries(row)) {
        if (key === "Service" || key === "Name" || key === "Service Name") continue;
        const v = val.toLowerCase().trim();
        if (v === "enable" || v === "enabled" || v === "on" || v === "yes" || v === "allow" || v === "✓" || v.includes("✓")) {
          if (UNTRUSTED_ZONES.test(key)) {
            exposed.push({ service, zones: key });
          }
        }
      }
    }
  }

  if (exposed.length > 0) {
    const sshWan = exposed.filter((e) => /ssh|telnet/i.test(e.service) && /wan/i.test(e.zones));
    const adminWan = exposed.filter((e) => /https|admin|gui|webadmin|api/i.test(e.service) && /wan/i.test(e.zones));
    const snmpExposed = exposed.filter((e) => /snmp/i.test(e.service));

    if (adminWan.length > 0) {
      findings.push({
        id: `f${nextId()}`, severity: "critical",
        title: "Admin console accessible from WAN",
        detail: `Management service${adminWan.length > 1 ? "s" : ""} (${adminWan.map((e) => e.service).join(", ")}) ${adminWan.length > 1 ? "are" : "is"} enabled on the WAN zone. This exposes the firewall admin interface to the internet, allowing brute-force and exploitation attempts.`,
        section: "Local Service ACL",
        remediation: "Go to Administration > Device access. Disable HTTPS/Admin access for the WAN zone. If remote admin access is required, use an IPsec or SSL VPN tunnel instead, or restrict to specific IP addresses using the ACL exception list.",
        confidence: "high",
        evidence: `HTTPS/Admin enabled on WAN zone in Local Service ACL: ${adminWan.map((e) => e.service).join(", ")}`,
      });
    }
    if (sshWan.length > 0) {
      findings.push({
        id: `f${nextId()}`, severity: "critical",
        title: "SSH accessible from WAN",
        detail: `SSH is enabled on the WAN zone. This allows remote command-line access from the internet — a high-value target for attackers using credential stuffing and exploit attacks.`,
        section: "Local Service ACL",
        remediation: "Go to Administration > Device access. Disable SSH for the WAN zone. Use VPN for remote CLI access. If SSH must remain, restrict to specific IP addresses and ensure MFA is enabled.",
        confidence: "high",
        evidence: "SSH enabled on WAN zone in Local Service ACL",
      });
    }
    if (snmpExposed.length > 0) {
      findings.push({
        id: `f${nextId()}`, severity: "high",
        title: `SNMP exposed to ${snmpExposed.map((e) => e.zones).join(", ")}`,
        detail: `SNMP is enabled on ${snmpExposed.map((e) => e.zones).join(", ")}. SNMP (especially v1/v2c) leaks device information and can be used for reconnaissance. If v3 is not enforced, community strings are sent in cleartext.`,
        section: "Local Service ACL",
        remediation: "Go to Administration > Device access. Disable SNMP on untrusted zones. If monitoring is needed, use SNMPv3 with authentication and encryption, and restrict to management VLANs only.",
        confidence: "high",
        evidence: `SNMP enabled on ${snmpExposed.map((e) => e.zones).join(", ")} in Local Service ACL`,
      });
    }

    const otherExposed = exposed.filter(
      (e) => !adminWan.includes(e) && !sshWan.includes(e) && !snmpExposed.includes(e)
    );
    if (otherExposed.length > 0) {
      findings.push({
        id: `f${nextId()}`, severity: "medium",
        title: `${otherExposed.length} management service${otherExposed.length > 1 ? "s" : ""} exposed to untrusted zones`,
        detail: `Services exposed: ${otherExposed.map((e) => `${e.service} (${e.zones})`).join(", ")}. Minimise the attack surface by restricting management access to trusted zones only.`,
        section: "Local Service ACL",
        remediation: "Go to Administration > Device access. Review each service and disable access from untrusted zones (WAN, DMZ, Guest). Only LAN and dedicated management zones should have admin access.",
        confidence: "high",
        evidence: `Local Service ACL: ${otherExposed.slice(0, 3).map((e) => `${e.service}(${e.zones})`).join(", ")}`,
      });
    }
  }
}

/** NAT Rule Security Analysis */
function analyseNatRules(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const natSection = findSection(sections, /nat\s*rule/i);
  if (!natSection) return;

  const dnatRules: string[] = [];
  const broadNat: string[] = [];
  for (const t of natSection.tables) {
    for (const row of t.rows) {
      const name = row["Rule Name"] ?? row["Name"] ?? row["#"] ?? "Unnamed";
      const type = (
        row["Type"] ?? row["NAT Type"] ?? row["Rule Type"] ?? row["Action"] ?? ""
      ).toLowerCase().trim();
      const origDest = (
        row["Original Destination"] ?? row["Destination"] ?? row["Dest"] ?? ""
      ).toLowerCase().trim();
      const transTo = (
        row["Translated To"] ?? row["Translated Destination"] ?? row["Translation"] ?? row["Mapped To"] ?? ""
      ).toLowerCase().trim();
      const origSrc = (
        row["Original Source"] ?? row["Source"] ?? ""
      ).toLowerCase().trim();

      if (type.includes("dnat") || type.includes("destination") || type.includes("port forward") || transTo) {
        dnatRules.push(name);
      }
      if ((origSrc === "any" || origSrc === "") && (origDest === "any" || origDest === "")) {
        broadNat.push(name);
      }
    }
  }

  if (broadNat.length > 0) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: `${broadNat.length} NAT rule${broadNat.length > 1 ? "s" : ""} with broad source/destination`,
      detail: `NAT rules with overly broad scope: ${broadNat.slice(0, 6).join(", ")}${broadNat.length > 6 ? ` (+${broadNat.length - 6} more)` : ""}. Broad NAT rules can unintentionally expose services or masquerade traffic.`,
      section: "NAT Rules",
      remediation: "Go to Rules and policies > NAT rules. Restrict original source and destination to specific network objects rather than 'Any'. This reduces the blast radius if the rule is misconfigured.",
      confidence: "high",
      evidence: `NAT rules ${broadNat.slice(0, 3).join(", ")} have Original Source=Any, Dest=Any`,
    });
  }
}

/** Web Filter Policy Deep Dive */
function analyseWebFilterPolicies(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const wfSection = findSection(sections, /web\s*filter\s*polic/i);
  if (!wfSection) return;

  const RISKY_CATEGORIES = /proxy|vpn|anonymi|p2p|peer|torrent|malware|phish|spyware|botnet|crypto\s*min/i;
  const riskyAllowed: string[] = [];

  for (const t of wfSection.tables) {
    for (const row of t.rows) {
      for (const [key, val] of Object.entries(row)) {
        if (RISKY_CATEGORIES.test(key) || RISKY_CATEGORIES.test(val)) {
          const action = (val ?? "").toLowerCase().trim();
          if (action === "allow" || action === "permitted" || action === "warn" || action === "enabled") {
            riskyAllowed.push(key);
          }
        }
      }
    }
  }

  if (riskyAllowed.length > 0) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: `Web filter policy allows ${riskyAllowed.length} high-risk categor${riskyAllowed.length > 1 ? "ies" : "y"}`,
      detail: `High-risk web categories are not blocked: ${riskyAllowed.slice(0, 6).join(", ")}${riskyAllowed.length > 6 ? ` (+${riskyAllowed.length - 6} more)` : ""}. Proxy/VPN categories can bypass security controls; malware categories should always be blocked.`,
      section: "Web Filter Policies",
      remediation: "Go to Web > Policies. Edit the active policy and set high-risk categories (Proxy/VPN, Anonymizers, P2P, Malware, Phishing) to 'Block'. Consider 'Warn' for grey-area categories like social media.",
      confidence: "high",
      evidence: `Web filter policy: ${riskyAllowed.slice(0, 4).join(", ")} set to Allow`,
    });
  }
}

/** IPS Policy Deep Dive */
function analyseIpsPolicies(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const ipsSection = findSection(sections, /ips\s*polic/i);
  if (!ipsSection) return;

  let totalPolicies = 0;
  for (const t of ipsSection.tables) {
    totalPolicies += t.rows.length;
    for (const row of t.rows) {
      const action = (row["Action"] ?? row["Default Action"] ?? "").toLowerCase();
      if (action.includes("allow") || action.includes("permit")) {
        findings.push({
          id: `f${nextId()}`, severity: "medium",
          title: `IPS policy "${row["Name"] ?? row["Policy Name"] ?? "Unknown"}" default action is Allow`,
          detail: `An IPS policy is configured with a default action of Allow/Permit. This means unclassified traffic bypasses IPS inspection. Consider setting the default action to Drop for WAN-facing rules.`,
          section: "IPS Policies",
          remediation: "Go to Intrusion prevention > IPS policies. Edit the policy and set the default action to 'Drop' for maximum protection. Review IPS alerts and add exceptions only for verified false positives.",
          confidence: "high",
          evidence: `IPS policy "${row["Name"] ?? row["Policy Name"] ?? "Unknown"}" has Action=Allow`,
        });
      }
    }
  }

  if (totalPolicies === 0) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: "No IPS policies configured",
      detail: "No IPS policies were found in the export. Without IPS policies, intrusion prevention cannot be applied to firewall rules even if the IPS feature is licensed.",
      section: "IPS Policies",
      remediation: "Go to Intrusion prevention > IPS policies. Create a policy using the default template (e.g. 'lantowan_general'). Then apply it to WAN-facing firewall rules.",
      confidence: "medium",
      evidence: "No IPS policies section found or section has 0 policy rows",
    });
  }
}

/** Virus Scanning Analysis */
function analyseVirusScanning(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const vsSection = findSection(sections, /virus|malware|anti.?virus|scanning/i);
  if (!vsSection) return;

  const disabledProtocols: string[] = [];
  let sandboxFound = false;
  let sandboxEnabled = false;

  for (const t of vsSection.tables) {
    for (const row of t.rows) {
      const setting = row["Setting"] ?? row["Protocol"] ?? row["Name"] ?? Object.keys(row)[0] ?? "";
      const value = (row["Value"] ?? row["Status"] ?? row[setting] ?? "").toLowerCase().trim();

      if (/sandbox/i.test(setting)) {
        sandboxFound = true;
        if (value === "enabled" || value === "on" || value === "yes" || value.includes("✓")) {
          sandboxEnabled = true;
        }
      }

      if (/http|smtp|ftp|pop3|imap|mail/i.test(setting)) {
        if (value === "disabled" || value === "off" || value === "no" || value.includes("✗")) {
          disabledProtocols.push(setting);
        }
      }
    }
  }

  if (disabledProtocols.length > 0) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: `Virus scanning disabled for ${disabledProtocols.length} protocol${disabledProtocols.length > 1 ? "s" : ""}`,
      detail: `Anti-malware scanning is not active for: ${disabledProtocols.join(", ")}. Malware can enter the network through unscanned traffic. HTTP scanning is especially critical as it catches drive-by downloads.`,
      section: "Virus Scanning",
      remediation: "Go to Protection > Web protection (for HTTP/HTTPS) or Email protection (for SMTP/POP3/IMAP). Enable malware scanning for each protocol. Ensure the Sophos anti-malware engine is selected and up to date.",
      confidence: "high",
      evidence: `Virus scanning section: ${disabledProtocols.slice(0, 4).join(", ")} = disabled`,
    });
  }

  if (sandboxFound && !sandboxEnabled) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: "Sandboxing / Zero-day protection not enabled",
      detail: "The Sophos Sandstorm (sandboxing) feature is available but not enabled. Without sandboxing, zero-day malware that evades signature-based detection will not be caught. This requires a valid Sophos Central / Sandstorm licence.",
      section: "Virus Scanning",
      remediation: "Go to Protection > Web protection > Enable Sophos Sandstorm analysis. This sends suspicious files to the cloud sandbox for detonation analysis. Requires an active Sandstorm licence.",
      confidence: "medium",
      evidence: "Virus scanning section: Sandbox setting present but not enabled",
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Device Hardening – Sophos Health Check detectable items            */
/* ------------------------------------------------------------------ */

// getSettingValue reserved for future Device Hardening checks

function analyseAdminSettings(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^AdminSettings$/i) ?? findSection(sections, /admin.?settings/i);
  if (!section) return;

  const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");

  // Password complexity
  if (/PasswordComplexityCheck/i.test(text) && !/enable/i.test(text.match(/PasswordComplexityCheck[^}]*?(Enable|Disable)/i)?.[1] ?? "")) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: "Password complexity not enabled",
      detail: "Password complexity requirements are not enforced. Weak passwords increase brute-force risk.",
      section: "Admin Settings",
      remediation: "Go to Administration > Admin and user settings > Enable Password complexity check with minimum length 10+, alphabetic, numeric, and special characters.",
      confidence: "high",
      evidence: "Admin Settings: PasswordComplexityCheck not set to Enable",
    });
  }

  // Login lockout / brute force protection
  const blockLogin = text.match(/BlockLogin[^}]*?(Enable|Disable)/i)?.[1];
  if (blockLogin && !/enable/i.test(blockLogin)) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: "Login brute-force protection disabled",
      detail: "Login lockout after failed attempts is not enabled. Attackers can attempt unlimited password guesses.",
      section: "Admin Settings",
      remediation: "Go to Administration > Admin and user settings > Enable 'Block login' with a maximum of 5 unsuccessful attempts and a lockout duration.",
      confidence: "high",
      evidence: "Admin Settings: BlockLogin set to Disable",
    });
  }

  // Login disclaimer
  const disclaimer = text.match(/LoginDisclaimer[^}]*?(Enable|Disable)/i)?.[1] ??
    text.match(/Disclaimer[^}]*?Status[^}]*?(Enable|Disable)/i)?.[1];
  if (disclaimer && !/enable/i.test(disclaimer)) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: "Login disclaimer not enabled",
      detail: "A login disclaimer provides a legal warning banner before authentication. Required by many compliance frameworks (CIS, ISO 27001).",
      section: "Admin Settings",
      remediation: "Go to Administration > Admin settings > Enable Login disclaimer and configure an appropriate legal notice.",
      confidence: "high",
      evidence: "Admin Settings: LoginDisclaimer set to Disable",
    });
  }
}

function analyseBackupRestore(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^BackupRestore$/i) ?? findSection(sections, /backup/i);
  if (!section) return;

  const blob = sectionToBlob(section).toLowerCase();

  // Look for evidence of scheduled backup being configured:
  // - A frequency value that isn't "never" (daily, weekly, monthly)
  // - A backup mode that indicates active backup (email, ftp, local)
  const hasScheduledFreq =
    /(?:frequency|backupfrequency)[=":,\s]*(daily|weekly|monthly)/i.test(blob);
  const hasActiveMode =
    /(?:mode|backupmode)[=":,\s]*(email|ftp)/i.test(blob);

  if (hasScheduledFreq || hasActiveMode) return;

  findings.push({
    id: `f${nextId()}`, severity: "medium",
    title: "Automated backups not scheduled",
    detail: "No scheduled backup configuration detected. Without regular backups, configuration recovery after failure is at risk.",
    section: "Backup & Restore",
    remediation: "Go to System services > Backup & firmware > Schedule automated backups (daily or weekly). Send to email or Sophos Central.",
    confidence: "medium",
    evidence: "Backup section: BackupFrequency not found or set to Never",
  });
}

function analyseNotificationSettings(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^Notification$/i) ?? findSection(sections, /^Notificationlist$/i);
  if (!section) return;

  const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");

  const hasServer = /NotificationServer[^}]*?Enable/i.test(text) || /MailServer[^}]*?smtp/i.test(text);
  if (!hasServer) {
    findings.push({
      id: `f${nextId()}`, severity: "low",
      title: "Notification email not configured",
      detail: "No notification email server is configured. Security events and system alerts will not be sent to administrators.",
      section: "Notification Settings",
      remediation: "Go to Administration > Notification settings > Configure an SMTP server and recipient email for security alerts.",
      confidence: "medium",
      evidence: "Notification section: No NotificationServer/MailServer enabled or SMTP configured",
    });
  }
}

function analysePatternDownload(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^PatternDownload$/i) ?? findSection(sections, /pattern/i);
  if (!section) return;

  const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");

  const autoUpdate = text.match(/AutoUpdate[^}]*?(Enable|Disable)/i)?.[1];
  if (autoUpdate && !/enable/i.test(autoUpdate)) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: "Pattern auto-update disabled",
      detail: "Automatic pattern/signature downloads are disabled. IPS, AV, and application control signatures will become stale, reducing protection against new threats.",
      section: "Pattern Downloads",
      remediation: "Go to Administration > Updates > Enable automatic pattern updates. Set interval to at least every 2 hours.",
      confidence: "high",
      evidence: "PatternDownload section: AutoUpdate set to Disable",
    });
  }
}

function analyseTimeSettings(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^Time$/i);
  if (!section) return;

  const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");

  const ntp = text.match(/PredefinedNTPServer[^}]*?(Enable|Disable)/i)?.[1] ??
    text.match(/NTP[^}]*?(Enable|Disable)/i)?.[1];
  if (ntp && !/enable/i.test(ntp)) {
    findings.push({
      id: `f${nextId()}`, severity: "low",
      title: "NTP server not configured",
      detail: "No NTP time synchronisation is configured. Accurate time is essential for log correlation, certificate validation, and forensic analysis.",
      section: "Time Settings",
      remediation: "Go to Administration > Time > Enable NTP and select a predefined or custom NTP server.",
      confidence: "high",
      evidence: "Time section: PredefinedNTPServer/NTP set to Disable",
    });
  }
}

function analyseAuthServers(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^AuthenticationServer$/i)
    ?? findSection(sections, /^authentication\s*servers?$/i)
    ?? findSection(sections, /authentication.?server/i);
  if (!section) return;

  const UNENC_VALUES = /^(simple|plain|plaintext|none|unencrypted|no|disable|disabled|off|0)$/i;
  const unencrypted: string[] = [];

  // Check each server from details (API path) or table rows (HTML path)
  const details = section.details ?? [];
  if (details.length > 0) {
    for (const d of details) {
      const fields = d.fields ?? {};
      const name = fields["ServerName"] ?? fields["Name"] ?? d.title ?? "Unknown";
      const blob = Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(" ").toLowerCase();

      // Sophos API uses numeric ConnectionSecurity: 1=Plain, 2=SSL, 3=STARTTLS
      // AD servers use text: Simple, SSL, StartTLS
      const csVal = fields["ConnectionSecurity"] ?? "";

      // Skip if explicitly encrypted (text or numeric)
      if (/^(ssl|starttls|2|3)$/i.test(csVal.trim())) continue;
      if (/connectionsecurity[=\s]*(ssl|starttls)/i.test(blob)) continue;
      if (/encryption[=\s]*(ssl|starttls)/i.test(blob)) continue;
      if (/port[=\s]*636/i.test(blob)) continue;

      // Flag if plaintext (text: simple/plain/none, numeric: 1) or on port 389
      const isPlainCs = /^(1|simple|plain|plaintext|none)$/i.test(csVal.trim());
      const hasUnencValue = isPlainCs ||
        /encryption[=\s]*(plain|simple|none|plaintext|disable)/i.test(blob);
      const onLdapPort = /\bport[=\s]*389\b/.test(blob);

      if (hasUnencValue || onLdapPort) {
        unencrypted.push(name);
      }
    }
  }

  // Fallback: check table rows (HTML upload path)
  if (unencrypted.length === 0) {
    for (const t of section.tables) {
      for (const row of t.rows) {
        const name = row["Server Name"] ?? row["Name"] ?? row["col1"] ?? "";
        const security = (
          row["Connection Security"] ?? row["ConnectionSecurity"] ??
          row["Encryption"] ?? ""
        ).trim();
        if (name && security && UNENC_VALUES.test(security)) {
          unencrypted.push(name);
        }
      }
    }
  }

  if (unencrypted.length > 0) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: `${unencrypted.length} authentication server(s) using unencrypted connection`,
      detail: `The following auth servers use plain/unencrypted LDAP: ${unencrypted.join(", ")}. Credentials sent in cleartext can be intercepted.`,
      section: "Authentication Servers",
      remediation: "Go to Authentication > Servers > Change Connection Security to SSL (LDAPS port 636) or STARTTLS for each server.",
      confidence: "high",
      evidence: `Auth servers ${unencrypted.slice(0, 3).join(", ")} have ConnectionSecurity=simple/plain/none or Port=389`,
    });
  }
}

function analyseHotfix(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^Hotfix$/i);
  if (!section) return;

  const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");

  const enabled = /AllowAutoInstallOfHotFixes[^}]*?Enable/i.test(text) || /Enabled/i.test(text);
  if (!enabled) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: "Automatic hotfix installation disabled",
      detail: "Automatic hotfix installation is not enabled. Security patches between firmware updates address critical vulnerabilities and must be applied promptly.",
      section: "Hotfix Settings",
      remediation: "Go to Administration > Updates > Enable 'Allow automatic installation of hotfixes'. Sophos pushes critical security patches through this mechanism.",
      confidence: "medium",
      evidence: "Hotfix section: AllowAutoInstallOfHotFixes not enabled",
    });
  }
}

function analyseSyncAppControl(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^ApplicationClassification$/i) ?? findSection(sections, /application.?classification$/i);
  if (!section) return;

  const blob = sectionToBlob(section);

  // Only flag if we find an explicit indication it's disabled.
  // The API entity often omits the toggle entirely (just lists classified apps),
  // so absence of "Enable" is NOT proof it's disabled.
  const isExplicitlyDisabled =
    /action[=":,\s]*disable/i.test(blob) ||
    /status[=":,\s]*disable/i.test(blob) ||
    /action[=":,\s]*off/i.test(blob) ||
    /status[=":,\s]*off/i.test(blob);

  if (!isExplicitlyDisabled) return;

  findings.push({
    id: `f${nextId()}`, severity: "medium",
    title: "Synchronized Application Control disabled",
    detail: "Synchronized Application Control is not enabled. This feature uses Security Heartbeat data from endpoints to identify and classify unknown application traffic.",
    section: "Application Classification",
    remediation: "Go to Applications > Synchronized Application Control > Enable the feature. Requires Security Heartbeat and Sophos Endpoint.",
    confidence: "medium",
    evidence: "ApplicationClassification section: ACTION set to Disable",
  });
}

function analyseATP(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^ATP$/i) ?? findSection(sections, /advanced.?threat.?protect/i);
  if (!section) return;

  const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");

  // Check ThreatProtectionStatus
  const statusMatch = text.match(/ThreatProtectionStatus[^}]*?(Enable|Disable)/i)?.[1];
  if (statusMatch && !/enable/i.test(statusMatch)) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: "Sophos X-Ops (ATP) threat protection disabled",
      detail: "Advanced Threat Protection (Sophos X-Ops) is not enabled. ATP uses Sophos threat intelligence to detect and block communication with known command-and-control servers and malicious IPs.",
      section: "Active Threat Response",
      remediation: "Go to Active threat response > Sophos X-Ops threat feeds > Enable threat protection and set the action to 'Log and drop'.",
      confidence: "high",
      evidence: "ATP section: ThreatProtectionStatus set to Disable",
    });
  }

  // Check Policy action — should be "Log and Drop"
  const policy = text.match(/Policy[^}]*?[":]?\s*(Log and Drop|Drop|Log only|Monitor|None)/i)?.[1];
  if (policy && !/log and drop/i.test(policy)) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: `Sophos X-Ops (ATP) policy set to "${policy}" instead of "Log and Drop"`,
      detail: `The ATP/X-Ops policy is set to "${policy}". Sophos recommends "Log and Drop" to both block malicious traffic and create log entries for investigation.`,
      section: "Active Threat Response",
      remediation: "Go to Active threat response > Sophos X-Ops threat feeds > Set the Action to 'Log and drop'.",
      confidence: "high",
      evidence: `ATP section: Policy="${policy}" (recommended: Log and Drop)`,
    });
  }
}

function analyseHA(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^HAConfigure$/i) ?? findSection(sections, /high.?availability/i);
  if (!section) {
    findings.push({
      id: `f${nextId()}`, severity: "info",
      title: "No High Availability (HA) configuration detected",
      detail: "No HA configuration section was found. This firewall appears to be running as a standalone device without active-passive or active-active failover.",
      section: "High Availability",
      remediation: "Consider deploying a secondary Sophos firewall in HA mode (active-passive or active-active) for hardware redundancy and business continuity.",
      confidence: "medium",
      evidence: "No HAConfigure/High Availability section found in config",
    });
    return;
  }

  // Check details block first (API path)
  let deviceMode: string | undefined;
  let nodeName: string | undefined;
  let clusterId: string | undefined;

  for (const d of section.details ?? []) {
    const f = d.fields ?? {};
    for (const [k, v] of Object.entries(f)) {
      const kl = k.toLowerCase();
      if (!deviceMode && (kl === "device" || kl === "hamode" || kl.endsWith(".device") || kl.endsWith(".hamode"))) {
        if (/active.?passive|active.?active|standalone/i.test(v)) deviceMode = v;
      }
      if (!nodeName && (kl === "nodename" || kl.endsWith(".nodename"))) nodeName = v;
      if (!clusterId && (kl === "clusterid" || kl.endsWith(".clusterid"))) clusterId = v;
    }
  }

  // Fallback: scan table rows + text (HTML path)
  if (!deviceMode) {
    const text = sectionToBlob(section);
    deviceMode = text.match(/(?:Device|HAMode)[=":,\s]*(Active[_\s-]?Passive|Active[_\s-]?Active|Standalone)/i)?.[1];
    if (!nodeName) nodeName = text.match(/NodeName[=":,\s]*(\w+)/i)?.[1];
    if (!clusterId) clusterId = text.match(/ClusterID[=":,\s]*(\d+)/i)?.[1];
  }

  if (deviceMode) {
    const mode = deviceMode.replace(/[_\s]+/g, "-");
    const clusterInfo = clusterId != null ? ` Cluster ID: ${clusterId}.` : "";
    findings.push({
      id: `f${nextId()}`, severity: "info",
      title: `HA configured: ${mode}${nodeName ? ` (${nodeName})` : ""}`,
      detail: `High Availability is configured in ${mode} mode.${nodeName ? ` This node is "${nodeName}".` : ""}${clusterInfo}`,
      section: "High Availability",
      confidence: "high",
      evidence: `HA section: Device mode=${mode}${nodeName ? `, NodeName=${nodeName}` : ""}`,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Extended Security Analysis — VPN, DoS, SNMP, Wireless, etc.       */
/* ------------------------------------------------------------------ */

/** VPN Security — check IPSec profiles for weak encryption and SSL VPN config */
function analyseVpnSecurity(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const WEAK_CIPHERS = /des(?!3)|3des|blowfish|cast|rc4|null/i;
  const WEAK_DH = /^(1|2|5|dh1|dh2|dh5|group1|group2|group5)$/i;
  const WEAK_AUTH = /md5|sha1(?![\d])/i;

  // Build set of profile names actually referenced by IPSec connections
  const ipsecSection = findSection(sections, /vpn\s*ipsec\s*connection/i);
  const usedProfiles = new Set<string>();
  if (ipsecSection) {
    for (const t of ipsecSection.tables) {
      for (const row of t.rows) {
        const policy = (row["Policy"] ?? row["Profile"] ?? row["IPsec Profile"] ?? "").trim();
        if (policy) usedProfiles.add(policy.toLowerCase());
      }
    }
  }

  // VPN Profiles — only flag if the profile is actively used by a connection
  const profileSection = findSection(sections, /vpn\s*profile/i);
  if (profileSection) {
    const weakProfiles: string[] = [];
    const noPfs: string[] = [];
    for (const t of profileSection.tables) {
      for (const row of t.rows) {
        const name = row["Name"] ?? row["Profile Name"] ?? "Unknown";
        if (!usedProfiles.has(name.toLowerCase())) continue;

        const p1Enc = row["Phase 1 Encryption"] ?? row["IKE Encryption"] ?? "";
        const p2Enc = row["Phase 2 Encryption"] ?? row["ESP Encryption"] ?? "";
        const p1Auth = row["Phase 1 Auth"] ?? row["IKE Auth"] ?? "";
        const p2Auth = row["Phase 2 Auth"] ?? row["ESP Auth"] ?? "";
        const dh = row["Phase 1 DH Groups"] ?? row["DH Group"] ?? "";
        const pfs = row["Phase 2 PFS"] ?? row["PFS"] ?? "";

        if (WEAK_CIPHERS.test(p1Enc) || WEAK_CIPHERS.test(p2Enc) ||
            WEAK_AUTH.test(p1Auth) || WEAK_AUTH.test(p2Auth) ||
            WEAK_DH.test(dh.trim())) {
          weakProfiles.push(name);
        }
        const pfsVal = pfs.toLowerCase().trim();
        if (pfsVal === "off" || pfsVal === "disabled" || pfsVal === "no" || pfsVal === "none") {
          noPfs.push(name);
        }
      }
    }
    if (weakProfiles.length > 0) {
      findings.push({
        id: `f${nextId()}`, severity: "high",
        title: `${weakProfiles.length} active VPN profile${weakProfiles.length > 1 ? "s" : ""} using weak encryption`,
        detail: `VPN profiles in use by IPSec connections with outdated cryptography (DES, 3DES, MD5, SHA-1, or weak DH groups): ${weakProfiles.slice(0, 6).join(", ")}${weakProfiles.length > 6 ? ` (+${weakProfiles.length - 6} more)` : ""}. These algorithms are vulnerable to known attacks.`,
        section: "VPN Security",
        remediation: "Go to Configure > VPN > IPsec profiles. Update Phase 1 and Phase 2 to use AES-256 or AES-128 with SHA-256+ auth and DH Group 14 or higher. Remove DES, 3DES, MD5, and SHA-1.",
        confidence: "high",
        evidence: `Active profiles: ${weakProfiles.slice(0, 3).join(", ")} use weak ciphers/auth/DH groups`,
      });
    }
    if (noPfs.length > 0) {
      findings.push({
        id: `f${nextId()}`, severity: "medium",
        title: `${noPfs.length} active VPN profile${noPfs.length > 1 ? "s" : ""} without Perfect Forward Secrecy`,
        detail: `VPN profiles in use by IPSec connections without PFS enabled: ${noPfs.slice(0, 6).join(", ")}${noPfs.length > 6 ? ` (+${noPfs.length - 6} more)` : ""}. Without PFS, compromising a single key may allow decryption of all past traffic.`,
        section: "VPN Security",
        remediation: "Go to Configure > VPN > IPsec profiles. Edit Phase 2 settings and enable PFS (DH Group 14+).",
        confidence: "high",
        evidence: `Active profiles: ${noPfs.slice(0, 3).join(", ")} have PFS=Off/Disabled`,
      });
    }
  }

  // IPSec Connections — check for PSK auth (prefer certificates)
  // ipsecSection already resolved above
  if (ipsecSection) {
    const pskConns: string[] = [];
    for (const t of ipsecSection.tables) {
      for (const row of t.rows) {
        const name = row["Name"] ?? "Unknown";
        const authType = (row["Authentication Type"] ?? row["Auth Type"] ?? "").toLowerCase();
        if (authType.includes("preshared") || authType.includes("psk") || authType.includes("pre-shared")) {
          pskConns.push(name);
        }
      }
    }
    if (pskConns.length > 0) {
      findings.push({
        id: `f${nextId()}`, severity: "medium",
        title: `${pskConns.length} IPSec connection${pskConns.length > 1 ? "s" : ""} using pre-shared key authentication`,
        detail: `IPSec tunnels using PSK instead of digital certificates: ${pskConns.slice(0, 6).join(", ")}${pskConns.length > 6 ? ` (+${pskConns.length - 6} more)` : ""}. Certificate-based authentication is stronger and avoids PSK reuse risks.`,
        section: "VPN Security",
        remediation: "Consider migrating IPSec connections from PSK to digital certificate (X.509) or RSA key authentication for improved security.",
        confidence: "medium",
        evidence: `Connections: ${pskConns.slice(0, 3).join(", ")} use Authentication Type=PresharedKey`,
      });
    }
  }

  // SSL VPN Policies
  const sslVpnSection = findSection(sections, /ssl\s*vpn\s*polic/i);
  if (sslVpnSection) {
    let totalPolicies = 0;
    for (const t of sslVpnSection.tables) {
      totalPolicies += t.rows.length;
    }
    // Also count details entries (API path — generic table may be empty if fields are objects)
    if (totalPolicies === 0) {
      totalPolicies = (sslVpnSection.details ?? []).length;
    }
    if (totalPolicies > 0) {
      findings.push({
        id: `f${nextId()}`, severity: "info",
        title: `${totalPolicies} SSL VPN polic${totalPolicies > 1 ? "ies" : "y"} configured`,
        detail: `${totalPolicies} SSL VPN remote access ${totalPolicies > 1 ? "policies are" : "policy is"} configured. Ensure MFA is enforced for all SSL VPN users and that permitted resources follow least-privilege.`,
        section: "VPN Security",
        confidence: "high",
        evidence: `SSL VPN Policies section contains ${totalPolicies} entries`,
      });
    }
  }
}

/** DoS & Spoof Protection — flag if protection is not enabled */
function analyseDoSProtection(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const dosSection = findSection(sections, /^dos\b/i) ?? findSection(sections, /dos.*protect/i);
  const spoofSection = findSection(sections, /spoof/i);

  if (!dosSection && !spoofSection) {
    const combined = findSection(sections, /dos|spoof/i);
    if (!combined) {
      findings.push({
        id: `f${nextId()}`, severity: "medium",
        title: "No DoS & Spoof Protection configuration found",
        detail: "No DoS or spoof protection section was detected in the configuration export. Without DoS protection, the firewall is vulnerable to SYN flood, UDP flood, and ICMP flood attacks.",
        section: "DoS & Spoof Protection",
        remediation: "Go to Intrusion prevention > DoS & spoof protection. Enable SYN flood protection, UDP flood protection, ICMP flood protection, and IP spoof prevention.",
        confidence: "medium",
        evidence: "No DoS/Spoof section found in config export",
      });
      return;
    }
    analyseSingleDosSection(combined, findings, nextId);
    return;
  }

  // Check DoS (SYN flood) from details or table data
  if (dosSection) {
    const blob = sectionToBlob(dosSection);
    const details = dosSection.details ?? [];
    let synDisabled = false;

    if (details.length > 0) {
      const fields = details[0].fields ?? {};
      const synVal = (
        fields["SYNFloodProtection"] ?? fields["SynFlood"] ?? fields["Status"] ?? ""
      ).toLowerCase();
      synDisabled = synVal === "disable" || synVal === "off" || synVal === "0";
    }
    if (!synDisabled) {
      synDisabled = /syn.*?flood.*?(disable|off)/i.test(blob);
    }

    if (synDisabled) {
      findings.push({
        id: `f${nextId()}`, severity: "high",
        title: "SYN flood protection disabled",
        detail: "SYN flood protection is not active. SYN flood attacks can exhaust server connection tables, causing denial of service.",
        section: "DoS & Spoof Protection",
        remediation: "Go to Intrusion prevention > DoS & spoof protection. Enable SYN flood protection with appropriate thresholds.",
        confidence: "high",
        evidence: "DoS section: SYN flood protection set to disabled/off",
      });
    }
  }

  // Check Spoof Prevention from details or table data
  if (spoofSection) {
    const blob = sectionToBlob(spoofSection);
    const details = spoofSection.details ?? [];
    let spoofDisabled = false;

    if (details.length > 0) {
      const fields = details[0].fields ?? {};
      const spoofVal = (
        fields["Status"] ?? fields["IPSpoofPrevention"] ?? ""
      ).toLowerCase();
      spoofDisabled = spoofVal === "disable" || spoofVal === "off" || spoofVal === "0";
    }
    if (!spoofDisabled) {
      spoofDisabled = /spoof.*?prevent.*?(disable|off)/i.test(blob) || /ip\s*spoof.*?(disable|off)/i.test(blob);
    }

    if (spoofDisabled) {
      findings.push({
        id: `f${nextId()}`, severity: "high",
        title: "IP spoof prevention disabled",
        detail: "IP spoof prevention is disabled. Attackers can forge source IP addresses to bypass ACLs and launch amplification attacks.",
        section: "DoS & Spoof Protection",
        remediation: "Go to Intrusion prevention > DoS & spoof protection. Enable IP spoof prevention for all interfaces.",
        confidence: "high",
        evidence: "Spoof Prevention section: IP spoof prevention set to disabled/off",
      });
    }
  }
}

function sectionToBlob(section: SectionData): string {
  const chunks: string[] = [];
  for (const d of section.details ?? []) {
    for (const [k, v] of Object.entries(d.fields ?? {})) chunks.push(`${k}=${v}`);
  }
  for (const t of section.tables) {
    for (const r of t.rows) chunks.push(JSON.stringify(r));
  }
  if (section.text) chunks.push(section.text);
  return chunks.join(" ");
}

function analyseSingleDosSection(section: SectionData, findings: Finding[], nextId: () => number) {
  const blob = sectionToBlob(section);
  if (/spoof.*?prevent.*?(disable|off)/i.test(blob) || /ip\s*spoof.*?(disable|off)/i.test(blob)) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: "IP spoof prevention disabled",
      detail: "IP spoof prevention is disabled. Attackers can forge source IP addresses to bypass ACLs and launch amplification attacks.",
      section: "DoS & Spoof Protection",
      remediation: "Go to Intrusion prevention > DoS & spoof protection. Enable IP spoof prevention for all interfaces.",
      confidence: "high",
      evidence: "DoS section: IP spoof prevention set to disabled/off",
    });
  }
  if (/syn.*?flood.*?(disable|off)/i.test(blob)) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: "SYN flood protection disabled",
      detail: "SYN flood protection is not active. SYN flood attacks can exhaust server connection tables, causing denial of service.",
      section: "DoS & Spoof Protection",
      remediation: "Go to Intrusion prevention > DoS & spoof protection. Enable SYN flood protection with appropriate thresholds.",
      confidence: "high",
      evidence: "DoS section: SYN flood protection set to disabled/off",
    });
  }
}

/** Check if the firewall is registered to Sophos Central (logs forwarded automatically). */
function isCentralManaged(sections: ExtractedSections): boolean {
  // Admin profiles contain "Central Management: Read-Write" when Central-registered
  const adminProfiles = findSection(sections, /admin.*profile|administration\s*profile/i);
  if (adminProfiles) {
    const text = adminProfiles.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (adminProfiles.text ?? "");
    if (/central\s*management.*read.?write/i.test(text)) return true;
  }
  // Firewall rules created by Central prove connectivity
  const fwRules = findSection(sections, /firewall\s*rules?/i);
  if (fwRules) {
    for (const t of fwRules.tables) {
      for (const row of t.rows) {
        const name = (row["Rule Name"] ?? row["Name"] ?? "").toLowerCase();
        if (name.includes("central created")) return true;
      }
    }
  }
  // System services may reference Central
  const sysSvc = findSection(sections, /system\s*service/i);
  if (sysSvc) {
    const text = sysSvc.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (sysSvc.text ?? "");
    if (/central.*management.*running/i.test(text) || /central.*management.*start/i.test(text)) return true;
  }
  return false;
}

/** External logging — flag if neither syslog nor Sophos Central log forwarding is configured */
function analyseSyslogServers(
  sections: ExtractedSections, findings: Finding[], nextId: () => number, options?: AnalyseOptions,
) {
  // Sophos Central counts as external logging
  if (options?.centralLinked) return;
  if (isCentralManaged(sections)) return;

  const section = findSection(sections, /syslog\s*server/i);
  if (!section) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: "No external log forwarding configured",
      detail: "No syslog server or Sophos Central management was detected. Without external log forwarding, firewall logs are only stored locally and could be lost during a hardware failure or attack.",
      section: "Logging & Monitoring",
      remediation: "Register the firewall with Sophos Central for automatic log forwarding, or go to System services > Log settings > Syslog servers and add a remote syslog server (SIEM or log collector).",
      confidence: "medium",
      evidence: "No Syslog Servers section found and firewall is not Central-managed",
    });
    return;
  }

  let hasSyslog = false;
  for (const t of section.tables) {
    if (t.rows.length > 0) hasSyslog = true;
    for (const row of t.rows) {
      const status = (row["Status"] ?? row["Enabled"] ?? "").toLowerCase();
      if (status.includes("enable") || status.includes("on") || status.includes("✓")) {
        hasSyslog = true;
      }
    }
  }

  if (!hasSyslog) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: "No external log forwarding configured",
      detail: "The syslog server section exists but contains no active entries, and the firewall does not appear to be registered with Sophos Central. Firewall logs are only stored locally.",
      section: "Logging & Monitoring",
      remediation: "Register the firewall with Sophos Central for automatic log forwarding, or go to System services > Log settings > Syslog servers and add a remote syslog server.",
      confidence: "medium",
      evidence: "Syslog Servers section has no entries and no Central management detected",
    });
  }
}

/** Wireless Network Security — only flag if APs are actively registered to the firewall.
 *  AP6 series is Central-managed only, APX is approaching EOL — so many firewalls
 *  won't have firewall-managed wireless at all and that's perfectly fine. */
function analyseWirelessSecurity(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  // Check if any wireless access points are actually registered/online
  const apSection = findSection(sections, /wireless\s*access\s*point/i);
  let activeAps = 0;
  if (apSection) {
    for (const t of apSection.tables) {
      for (const row of t.rows) {
        const status = (row["Status"] ?? row["State"] ?? "").toLowerCase();
        if (!status.includes("offline") && !status.includes("disconnect")) activeAps++;
      }
      if (t.rows.length > 0 && !t.headers.some((h) => /status|state/i.test(h))) {
        activeAps += t.rows.length;
      }
    }
  }

  // No APs registered → wireless is not in use via this firewall, skip entirely
  if (activeAps === 0) return;

  const section = findSection(sections, /wireless\s*network(?!.*status)/i);
  if (!section) return;

  const openSsids: string[] = [];
  const weakSsids: string[] = [];

  for (const t of section.tables) {
    for (const row of t.rows) {
      const name = row["Name"] ?? row["SSID"] ?? "Unknown";
      const status = (row["Status"] ?? "").toLowerCase();
      if (status.includes("disable") || status.includes("off")) continue;

      const secMode = (row["Security Mode"] ?? row["Encryption"] ?? row["Authentication"] ?? "").toLowerCase();
      const encryption = (row["Encryption"] ?? "").toLowerCase();

      if (secMode.includes("noencryption") || secMode === "none" || secMode === "open" ||
          (secMode === "" && encryption === "-")) {
        openSsids.push(name);
      } else if (secMode.includes("wep") || secMode.includes("wpa1") ||
                 (secMode.includes("wpa") && !secMode.includes("wpa2") && !secMode.includes("wpa3"))) {
        weakSsids.push(name);
      }
    }
  }

  if (openSsids.length > 0) {
    findings.push({
      id: `f${nextId()}`, severity: "critical",
      title: `${openSsids.length} wireless network${openSsids.length > 1 ? "s" : ""} with no encryption`,
      detail: `Open/unencrypted wireless networks: ${openSsids.join(", ")}. All traffic on these networks can be intercepted. Even guest networks should use WPA2/WPA3 with a captive portal.`,
      section: "Wireless Security",
      remediation: "Go to Protect > Wireless > Wireless networks. Set Security Mode to WPA2/WPA3 Personal or Enterprise for every SSID. Use a captive portal for guest access instead of open encryption.",
      confidence: "high",
      evidence: `SSIDs ${openSsids.join(", ")} have Security Mode=NoEncryption/Open`,
    });
  }
  if (weakSsids.length > 0) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: `${weakSsids.length} wireless network${weakSsids.length > 1 ? "s" : ""} using weak encryption`,
      detail: `Wireless networks using deprecated encryption (WEP or WPA1): ${weakSsids.join(", ")}. WEP can be cracked in minutes; WPA1 has known vulnerabilities.`,
      section: "Wireless Security",
      remediation: "Go to Protect > Wireless > Wireless networks. Upgrade Security Mode to WPA2 Personal/Enterprise at minimum, preferably WPA3.",
      confidence: "high",
      evidence: `SSIDs ${weakSsids.join(", ")} use WEP/WPA1`,
    });
  }
}

/** SNMP Community — flag weak/default community strings */
function analyseSnmpCommunity(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /snmp\s*community/i);
  if (!section) return;

  const DEFAULT_STRINGS = /^(public|private|community|snmp|default|test|monitor|read|write)$/i;
  const weakCommunities: string[] = [];

  for (const t of section.tables) {
    for (const row of t.rows) {
      const name = row["Name"] ?? row["Community Name"] ?? row["Community"] ?? "";
      if (DEFAULT_STRINGS.test(name.trim())) {
        weakCommunities.push(name.trim());
      }
    }
  }

  if (weakCommunities.length > 0) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: `${weakCommunities.length} SNMP communit${weakCommunities.length > 1 ? "ies" : "y"} using default/weak strings`,
      detail: `SNMP community strings with well-known defaults: ${weakCommunities.join(", ")}. Default SNMP strings are trivially guessable and expose device configuration and network topology.`,
      section: "SNMP Security",
      remediation: "Go to Administration > SNMP. Change community strings to complex, unique values. Consider migrating to SNMPv3 which uses authentication and encryption instead of cleartext community strings.",
      confidence: "high",
      evidence: `SNMP communities: ${weakCommunities.join(", ")} are well-known defaults`,
    });
  }
}

/** DNS Security — check for DNS configuration issues */
function analyseDnsSecurity(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^dns$/i) ?? findSection(sections, /^dns\s*(?!request)/i);
  if (!section) return;

  const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");

  // Check for DNS proxy/rebinding protection
  const rebinding = text.match(/DNSRebindingProtection[^}]*?(Enable|Disable)/i)?.[1] ??
    text.match(/Rebinding[^}]*?(Enable|Disable)/i)?.[1];
  if (rebinding && !/enable/i.test(rebinding)) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: "DNS rebinding protection disabled",
      detail: "DNS rebinding protection is not enabled. This attack allows malicious websites to make requests to internal network resources through the victim's browser.",
      section: "DNS Security",
      remediation: "Go to Network > DNS. Enable DNS rebinding protection to prevent internal resource access via DNS rebinding attacks.",
      confidence: "medium",
      evidence: "DNS section: DNSRebindingProtection set to Disable",
    });
  }

  // Check DNS request routes for external DNS use
  const dnsRoutes = findSection(sections, /dns\s*request\s*route/i);
  if (dnsRoutes) {
    for (const t of dnsRoutes.tables) {
      for (const row of t.rows) {
        const target = (row["Target"] ?? row["DNS Server"] ?? row["Server"] ?? "").trim();
        if (/8\.8\.8\.8|8\.8\.4\.4|1\.1\.1\.1|1\.0\.0\.1|9\.9\.9\.9|208\.67/i.test(target)) {
          findings.push({
            id: `f${nextId()}`, severity: "info",
            title: "DNS queries routed to public resolvers",
            detail: `DNS requests are being forwarded to public resolvers (${target}). While functional, consider using DNS-over-TLS or DNS-over-HTTPS for encrypted DNS resolution, or a Sophos-managed DNS service.`,
            section: "DNS Security",
            confidence: "low",
            evidence: `DNS Request Route target includes public resolver: ${target}`,
          });
          break;
        }
      }
    }
  }
}

/** RED Security — check for unencrypted RED tunnels */
function analyseRedSecurity(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const redConfig = findSection(sections, /^red\s*config/i) ?? findSection(sections, /^red$/i);
  if (!redConfig) return;

  const text = redConfig.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (redConfig.text ?? "");

  const unlockCode = text.match(/UnlockCode[^}]*?[":]?\s*([^",}]+)/i)?.[1]?.trim();
  if (unlockCode && /default|123456|000000/i.test(unlockCode)) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: "RED device using default unlock code",
      detail: "A RED device appears to be using a default or weak unlock code. This could allow unauthorised devices to connect to the tunnel.",
      section: "RED Security",
      remediation: "Go to Configure > Site-to-site VPN > RED. Change the unlock code to a strong, unique value for each RED device.",
      confidence: "medium",
      evidence: `RED config: UnlockCode appears to be a default value`,
    });
  }
}

/** Admin Authentication & Profiles — check for overly permissive admin roles.
 *  Ignores Sophos factory-default profiles that ship on every XGS. */
const SOPHOS_DEFAULT_PROFILES = new Set([
  "super admin", "audit admin", "crypto admin", "security admin", "network admin",
  "superadmin", "auditadmin", "cryptoadmin", "securityadmin", "networkadmin",
]);

function analyseAdminProfiles(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const profileSection = findSection(sections, /admin.*profile|administration\s*profile/i);
  if (!profileSection) return;

  let fullAccessCount = 0;
  for (const t of profileSection.tables) {
    for (const row of t.rows) {
      const name = (row["Name"] ?? row["Profile Name"] ?? row["Profile"] ?? "").toLowerCase().trim();
      if (SOPHOS_DEFAULT_PROFILES.has(name)) continue;
      const allValues = Object.values(row).map((v) => v.toLowerCase());
      const readWriteCount = allValues.filter((v) => v === "readwrite" || v === "read-write" || v === "full").length;
      if (readWriteCount > 10) fullAccessCount++;
    }
  }

  if (fullAccessCount > 1) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: `${fullAccessCount} custom admin profiles with full access permissions`,
      detail: `${fullAccessCount} custom administration profiles grant full read-write access to all firewall features. Follow least-privilege principles — create role-specific profiles (e.g. read-only, network-admin, security-admin).`,
      section: "Admin Security",
      remediation: "Go to Administration > Device access > Administration profiles. Create role-specific profiles with minimum required permissions rather than granting full access to multiple profiles.",
      confidence: "medium",
      evidence: `${fullAccessCount} custom admin profiles have ReadWrite on 10+ feature areas`,
    });
  }
}

/** D1: Rule ordering — deny rules shadowed by earlier allow rules */
function analyseRuleOrdering(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const rulesTable = findFirewallRulesTable(sections);
  if (!rulesTable || rulesTable.rows.length === 0) return;

  const getAction = (row: Record<string, string>): string => {
    const a = (
      row["Action"] ?? row["Rule Action"] ?? row["Policy"] ?? ""
    ).toLowerCase().trim();
    return a;
  };
  const isDeny = (a: string) => a.includes("deny") || a.includes("drop");
  const isAllow = (a: string) => a.includes("accept") || a.includes("allow") || a === "";

  const getField = (row: Record<string, string>, keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && v !== "") return v.trim();
    }
    return "";
  };
  const srcZone = (r: Record<string, string>) =>
    getField(r, ["Source Zone", "Source Zones", "Src Zone", "Src Zones", "Source"]);
  const dstZone = (r: Record<string, string>) =>
    getField(r, ["Destination Zone", "Destination Zones", "Dest Zone", "DestZone", "Destination"]);
  const srcNet = (r: Record<string, string>) =>
    getField(r, ["Source Networks", "Source", "Src Networks", "Source Network"]);
  const dstNet = (r: Record<string, string>) =>
    getField(r, ["Destination Networks", "Destination", "Dest Networks", "Dest Network"]);
  const svc = (r: Record<string, string>) =>
    getField(r, ["Service", "Services", "Services/Ports", "Services Used"]);

  const allowMatchesDeny = (allowRow: Record<string, string>, denyRow: Record<string, string>): boolean => {
    return (
      isSubsetOrEqual(srcZone(denyRow) || "any", srcZone(allowRow) || "any") &&
      isSubsetOrEqual(dstZone(denyRow) || "any", dstZone(allowRow) || "any") &&
      isSubsetOrEqual(srcNet(denyRow) || "any", srcNet(allowRow) || "any") &&
      isSubsetOrEqual(dstNet(denyRow) || "any", dstNet(allowRow) || "any") &&
      isSubsetOrEqual(svc(denyRow) || "any", svc(allowRow) || "any")
    );
  };

  for (let i = 0; i < rulesTable.rows.length; i++) {
    const denyRow = rulesTable.rows[i];
    const action = getAction(denyRow);
    if (!isDeny(action)) continue;

    const denyName = ruleName(denyRow);
    for (let j = 0; j < i; j++) {
      const allowRow = rulesTable.rows[j];
      const allowAction = getAction(allowRow);
      if (!isAllow(allowAction)) continue;
      if (isRuleDisabled(allowRow)) continue;

      if (allowMatchesDeny(allowRow, denyRow)) {
        const allowName = ruleName(allowRow);
        findings.push({
          id: `f${nextId()}`,
          severity: "medium",
          title: "Deny rule may be shadowed by earlier allow rule",
          detail: `Rule '${denyName}' at position ${i + 1} appears to be shadowed by '${allowName}' at position ${j + 1} which matches the same or broader traffic`,
          section: "Rule Hygiene",
          remediation: `Review the ordering of rules '${allowName}' and '${denyName}'. Move the deny rule above the allow rule, or narrow the allow rule's scope to prevent unintended traffic.`,
          confidence: "high",
          evidence: `Deny rule "${denyName}" matched by earlier allow rule "${allowName}"`,
        });
        break;
      }
    }
  }
}

/** D3: User/group-based rule checks */
function analyseUserGroupRules(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const rulesTable = findFirewallRulesTable(sections);
  if (!rulesTable || rulesTable.rows.length === 0) return;

  const identityCol = rulesTable.headers.find((h) =>
    /^identity$|source\s*identity|user\s*or\s*group|source\s*user/i.test(h)
  );
  const matchIdentityCol = rulesTable.headers.find((h) =>
    /match\s*known\s*users/i.test(h)
  );
  if (!identityCol && !matchIdentityCol) return;

  const getIdentity = (row: Record<string, string>): string => {
    if (identityCol) {
      const val = (row[identityCol] ?? "").trim();
      if (val && !/^(enable|disable)$/i.test(val)) return val;
    }
    if (matchIdentityCol) {
      const match = (row[matchIdentityCol] ?? "").trim().toLowerCase();
      if (match === "enable") return row["Identity"] ?? "Known Users";
    }
    return "";
  };

  for (const row of rulesTable.rows) {
    if (isRuleDisabled(row)) continue;

    const identity = getIdentity(row);
    const name = ruleName(row);

    if (isWanDest(row) && hasIps(row) && (identity === "" || /any/i.test(identity))) {
      findings.push({
        id: `f${nextId()}`,
        severity: "info",
        title: "WAN rule with security features matches any user identity",
        detail: `Rule '${name}' applies IPS to WAN traffic but matches 'Any' user identity — consider user-aware policies for better visibility.`,
        section: "Authentication",
        confidence: "low",
        evidence: `Rule "${name}" has Source Identity=Any with IPS enabled`,
      });
    }

    if (identity && !/any/i.test(identity)) {
      // Skip Sophos auto-created SSLVPN rules — these inherently require authentication
      if (/sslvpn.*auto\s*created/i.test(name)) continue;

      findings.push({
        id: `f${nextId()}`,
        severity: "low",
        title: "User-based rule may not cover unauthenticated traffic",
        detail: `Rule '${name}' requires user authentication but there is no fallback rule for unauthenticated users`,
        section: "Authentication",
        remediation: "Add a fallback rule below user-based rules to handle unauthenticated traffic, or configure captive portal authentication for the source zone.",
        confidence: "medium",
        evidence: `Rule "${name}" has user/group matching: ${identity}`,
      });
    }
  }
}

/** D4: WAF (Web Application Firewall) checks */
function analyseWafPolicies(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const wafSection = findSection(sections, /waf|web.*application.*firewall|server.*access.*control/i);
  const natSection = findSection(sections, /nat\s*rule/i);

  const getDnatRules = (): string[] => {
    if (!natSection) return [];
    const dnat: string[] = [];
    for (const t of natSection.tables) {
      for (const row of t.rows) {
        const type = (
          row["Type"] ?? row["NAT Type"] ?? row["Rule Type"] ?? row["Action"] ?? ""
        ).toLowerCase().trim();
        const transTo = (
          row["Translated To"] ?? row["Translated Destination"] ?? row["Translation"] ?? ""
        ).toLowerCase().trim();
        if (type.includes("dnat") || type.includes("destination") || type.includes("port forward") || transTo) {
          dnat.push(row["Rule Name"] ?? row["Name"] ?? "Unnamed");
        }
      }
    }
    return dnat;
  };

  const dnatRules = getDnatRules();

  if (wafSection) {
    for (const t of wafSection.tables) {
      for (const row of t.rows) {
        const mode = (
          row["Mode"] ?? row["Action"] ?? row["Default Action"] ?? row["Policy Mode"] ?? ""
        ).toLowerCase().trim();
        if (/monitor|log\s*only|detect/i.test(mode) && !/block|drop|prevent/i.test(mode)) {
          const policyName = row["Name"] ?? row["Policy Name"] ?? row["Rule"] ?? "Unknown";
          findings.push({
            id: `f${nextId()}`,
            severity: "medium",
            title: "WAF policy in monitor-only mode",
            detail: `WAF policy '${policyName}' is configured in monitor-only mode — attacks are detected but not blocked.`,
            section: "Traffic Inspection",
            remediation: "Go to Web Application Firewall settings. Change the policy mode from Monitor to Block to actively protect web applications.",
            confidence: "high",
            evidence: `WAF policy "${policyName}" has Mode=${mode}`,
          });
        }
      }
    }
  } else if (dnatRules.length > 0) {
    findings.push({
      id: `f${nextId()}`,
      severity: "high",
      title: "Published web servers without WAF protection",
      detail: "DNAT/port-forward rules expose web services to the internet but no Web Application Firewall policies are configured to protect them",
      section: "Traffic Inspection",
      remediation: "Configure Web Application Firewall (WAF) policies to inspect and protect published web services. Go to Web Application Firewall and create policies for each DNAT-exposed web application.",
      confidence: "high",
      evidence: `${dnatRules.length} DNAT rules found but no WAF section in config`,
    });
  }
}

/** L2: Certificate Management — weak keys, SHA-1, expiry, self-signed */
function analyseCertificates(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /certificate|ca\b|ssl.*cert/i);
  if (!section) return;

  const now = new Date();
  const seenCerts = new Set<string>();

  for (const t of section.tables) {
    for (const row of t.rows) {
      const certName = row["Name"] ?? row["Certificate Name"] ?? row["Subject"] ?? row["Alias"] ?? "";
      if (!certName || seenCerts.has(certName)) continue;
      seenCerts.add(certName);
      const keySizeRaw = row["Key Size"] ?? row["Key Length"] ?? row["Bits"] ?? row["Key"] ?? "";
      const keySize = parseInt(keySizeRaw.replace(/\D/g, ""), 10);
      const sigAlg = (row["Signature Algorithm"] ?? row["Hash"] ?? row["Signature"] ?? "").toLowerCase();
      const validTo = row["Valid To"] ?? row["Expiry Date"] ?? row["Not After"] ?? row["Expires"] ?? "";
      const issuer = (row["Issuer"] ?? row["Type"] ?? "").toLowerCase();

      if (keySize > 0 && keySize < 2048) {
        findings.push({
          id: `f${nextId()}`, severity: "high",
          title: `Certificate with weak key size (${keySize}-bit): ${certName}`,
          detail: `Certificate "${certName}" uses a ${keySize}-bit key. Keys below 2048 bits are cryptographically weak and vulnerable to brute-force attacks.`,
          section: "Certificate Management",
          remediation: "Replace the certificate with one using at least a 2048-bit RSA or 256-bit ECDSA key. Go to Certificates and generate or import a new certificate.",
          confidence: "high",
          evidence: `Certificate "${certName}" has Key Size=${keySizeRaw}`,
        });
      }

      if (sigAlg && /sha-?1|sha1/i.test(sigAlg)) {
        findings.push({
          id: `f${nextId()}`, severity: "high",
          title: `Certificate using SHA-1: ${certName}`,
          detail: `Certificate "${certName}" uses SHA-1 for signing. SHA-1 is deprecated and considered cryptographically broken. Modern browsers may reject such certificates.`,
          section: "Certificate Management",
          remediation: "Replace the certificate with one signed using SHA-256 or stronger. Go to Certificates and request or import a new certificate with a modern signature algorithm.",
          confidence: "high",
          evidence: `Certificate "${certName}" has Signature Algorithm/Hash=${sigAlg}`,
        });
      }

      if (validTo) {
        const expiryDate = new Date(validTo);
        if (!isNaN(expiryDate.getTime())) {
          const daysLeft = (expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
          if (daysLeft >= 0 && daysLeft <= 30) {
            findings.push({
              id: `f${nextId()}`, severity: "high",
              title: `Certificate expiring within 30 days: ${certName}`,
              detail: `Certificate "${certName}" expires on ${validTo}. Expired certificates cause service outages and security warnings.`,
              section: "Certificate Management",
              remediation: "Renew the certificate before it expires. Go to Certificates and either request a new certificate from your CA or import a renewed certificate.",
              confidence: "high",
              evidence: `Certificate "${certName}" Valid To=${validTo}`,
            });
          } else if (daysLeft > 30 && daysLeft <= 90) {
            findings.push({
              id: `f${nextId()}`, severity: "medium",
              title: `Certificate expiring within 90 days: ${certName}`,
              detail: `Certificate "${certName}" expires on ${validTo}. Plan renewal to avoid last-minute outages.`,
              section: "Certificate Management",
              remediation: "Schedule certificate renewal. Go to Certificates and request or import a renewed certificate before the expiry date.",
              confidence: "high",
              evidence: `Certificate "${certName}" Valid To=${validTo}`,
            });
          }
        }
      }

      if (issuer && (/self.?signed|selfsigned|untrusted|internal/i.test(issuer) || issuer === "self-signed")) {
        findings.push({
          id: `f${nextId()}`, severity: "medium",
          title: `Self-signed certificate in use: ${certName}`,
          detail: `Certificate "${certName}" is self-signed or from an untrusted CA. Self-signed certificates are not validated by a trusted authority and may cause browser warnings or interoperability issues.`,
          section: "Certificate Management",
          remediation: "For production use, replace with a certificate from a trusted public CA or your organisation's internal CA. For internal-only services, ensure the CA is trusted on all client devices.",
          confidence: "high",
          evidence: `Certificate "${certName}" Issuer/Type=${issuer}`,
        });
      }
    }
  }
}

/** L6: Hotspot & Captive Portal — captive portal, terms, HTTPS, auth */
function analyseHotspots(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /hotspot|captive.*portal|guest.*access/i);
  if (!section) return;

  const seen = new Set<string>();

  for (const t of section.tables) {
    for (const row of t.rows) {
      const name = row["Name"] ?? row["Hotspot"] ?? row["Profile"] ?? row["SSID"] ?? "";
      if (!name || seen.has(name)) continue;
      seen.add(name);

      const captivePortal = (
        row["Captive Portal"] ?? row["CaptivePortal"] ?? row["Portal"] ?? row["Enable Captive Portal"] ?? ""
      ).toLowerCase().trim();
      const captiveOff = !captivePortal || captivePortal === "disabled" || captivePortal === "off" || captivePortal === "no" || captivePortal === "-";

      const termsAccept = (
        row["Terms Acceptance"] ?? row["TermsAcceptance"] ?? row["Accept Terms"] ?? row["Terms Required"] ?? ""
      ).toLowerCase().trim();
      const termsOff = !termsAccept || termsAccept === "disabled" || termsAccept === "off" || termsAccept === "no" || termsAccept === "-";

      const httpsRedirect = (
        row["HTTPS Redirect"] ?? row["HTTPSRedirect"] ?? row["Use HTTPS"] ?? row["SSL"] ?? ""
      ).toLowerCase().trim();
      const noHttps = !httpsRedirect || httpsRedirect === "disabled" || httpsRedirect === "off" || httpsRedirect === "no" || httpsRedirect === "-";

      const auth = (
        row["Authentication"] ?? row["Auth"] ?? row["Auth Required"] ?? row["Login Required"] ?? ""
      ).toLowerCase().trim();
      const noAuth = !auth || auth === "none" || auth === "disabled" || auth === "off" || auth === "open" || auth === "-";

      if (captiveOff) {
        findings.push({
          id: `f${nextId()}`, severity: "high",
          title: `Hotspot without captive portal: ${name}`,
          detail: `Hotspot "${name}" does not have a captive portal enabled. Guest users may access the network without accepting terms or being identified.`,
          section: "Hotspot & Captive Portal",
          remediation: "Go to Hotspot or Guest access settings. Enable the captive portal for this hotspot. Configure a login page and terms of use.",
          confidence: "medium",
          evidence: `Hotspot "${name}" has Captive Portal=disabled/off`,
        });
      }

      if (termsOff && !captiveOff) {
        findings.push({
          id: `f${nextId()}`, severity: "medium",
          title: `Hotspot without terms acceptance: ${name}`,
          detail: `Hotspot "${name}" does not require users to accept terms of use. This may create legal and accountability gaps for guest access.`,
          section: "Hotspot & Captive Portal",
          remediation: "Go to Hotspot settings. Enable terms acceptance and configure the terms of use text. Require users to accept before granting access.",
          confidence: "medium",
          evidence: `Hotspot "${name}" has Terms Acceptance=disabled/off`,
        });
      }

      if (noHttps) {
        findings.push({
          id: `f${nextId()}`, severity: "medium",
          title: `Captive portal not using HTTPS: ${name}`,
          detail: `Captive portal for "${name}" does not enforce HTTPS. Login credentials and session data may be transmitted in cleartext.`,
          section: "Hotspot & Captive Portal",
          remediation: "Go to Hotspot settings. Enable HTTPS redirect for the captive portal. Ensure the portal presents a valid certificate.",
          confidence: "medium",
          evidence: `Hotspot "${name}" has HTTPS Redirect=disabled/off`,
        });
      }

      if (noAuth) {
        findings.push({
          id: `f${nextId()}`, severity: "high",
          title: `Open hotspot with no authentication: ${name}`,
          detail: `Hotspot "${name}" has no authentication required. Anyone can connect without identification, increasing abuse and legal risk.`,
          section: "Hotspot & Captive Portal",
          remediation: "Go to Hotspot settings. Enable authentication (e.g. voucher, social login, or RADIUS). Require users to identify before granting access.",
          confidence: "medium",
          evidence: `Hotspot "${name}" has Authentication=none/open`,
        });
      }
    }
  }
}

/** L7: Application Filter — risky categories allowed, missing policies */
function analyseAppFilterPolicies(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /app.*filter|application.*filter|application.*control.*polic/i);
  if (!section) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: "No application filter policies configured",
      detail: "No application filter policy section was found. Without application filtering, the firewall cannot control or block high-risk applications such as file sharing, remote access tools, or anonymizers.",
      section: "Application Filter",
      remediation: "Go to Applications > Application filter. Create an application filter policy and apply it to firewall rules. Block high-risk categories (file sharing, remote access, crypto mining, anonymizers).",
      confidence: "medium",
      evidence: "No app filter / application filter policy section found in config",
    });
    return;
  }

  const RISKY_CATEGORIES = /file\s*sharing|bittorrent|edonkey|remote\s*access|teamviewer|anydesk|crypto\s*min|mining|anonymizer|tor|vpn\s*proxy|proxy/i;
  const riskyAllowed: Array<{ category: string; apps: string }> = [];
  let hasAnyPolicy = false;

  for (const t of section.tables) {
    for (const row of t.rows) {
      hasAnyPolicy = true;
      const category = (row["Category"] ?? row["Application Category"] ?? "").toLowerCase();
      const app = (row["Application"] ?? row["Apps"] ?? row["Name"] ?? "").toLowerCase();
      const action = (row["Action"] ?? row["Policy"] ?? row["Default Action"] ?? "").toLowerCase().trim();

      const isAllow = action === "allow" || action === "permit" || action === "enabled";
      const combined = `${category} ${app}`;

      if (isAllow && RISKY_CATEGORIES.test(combined)) {
        const catMatch = combined.match(RISKY_CATEGORIES)?.[0] ?? "high-risk category";
        riskyAllowed.push({ category: catMatch, apps: (row["Application"] ?? row["Apps"] ?? app) || "various" });
      }
    }
  }

  if (hasAnyPolicy && riskyAllowed.length > 0) {
    const unique = [...new Map(riskyAllowed.map((r) => [r.category + ":" + r.apps, r])).values()];
    const appsList = unique.map((u) => u.apps).join(", ");
    const categories = [...new Set(unique.map((u) => u.category))].join(", ");
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: `Application filter allows ${categories}: ${appsList}`,
      detail: `Application filter policy permits high-risk categories: ${unique.map((u) => `${u.category} (${u.apps})`).join("; ")}. These applications can bypass security controls or introduce malware.`,
      section: "Application Filter",
      remediation: "Go to Applications > Application filter. Edit the policy and set high-risk categories (file sharing, remote access, crypto mining, anonymizers) to Block or Warn.",
      confidence: "medium",
      evidence: `App filter allows: ${unique.slice(0, 3).map((u) => u.apps).join(", ")}`,
    });
  }
}

/** L8: Interface & VLAN Security — zone assignment, inter-VLAN filtering, native VLAN */
function analyseInterfaceSecurity(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const exclude = /intrusion|virus|web.*filter/i;
  let section: SectionData | null = null;
  for (const key of Object.keys(sections)) {
    if (exclude.test(key)) continue;
    if (/interface|port|vlan|network.*interface/i.test(key)) {
      section = sections[key];
      break;
    }
  }
  if (!section) return;

  const vlanFilterReported = new Set<string>();
  const seen = new Set<string>();

  for (const t of section.tables) {
    for (const row of t.rows) {
      const name = row["Name"] ?? row["Interface"] ?? row["Port"] ?? row["VLAN"] ?? "";
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const zone = (row["Zone"] ?? row["Security Zone"] ?? row["SecurityZone"] ?? "").trim();
      const zoneEmpty = !zone || zone === "-" || zone === "none" || zone.toLowerCase() === "unassigned";

      const interfaceRef = row["Interface"] ?? row["Physical Interface"] ?? row["Port"] ?? "";
      const interVlanFilter = (row["Inter-VLAN Filtering"] ?? row["InterVLAN Filtering"] ?? row["VLAN Filtering"] ?? "").toLowerCase();
      const noInterVlanFilter = interVlanFilter === "" || interVlanFilter === "disabled" || interVlanFilter === "off" || interVlanFilter === "-";

      const trunk = (row["Type"] ?? row["Mode"] ?? "").toLowerCase();
      const isTrunk = trunk.includes("trunk");
      const nativeVlan = (row["Native VLAN"] ?? row["NativeVlan"] ?? row["Default VLAN"] ?? "").trim();
      const trunkNoNative = isTrunk && (!nativeVlan || nativeVlan === "-");

      if (zoneEmpty) {
        findings.push({
          id: `f${nextId()}`, severity: "high",
          title: `Interface without zone assignment: ${name}`,
          detail: `Interface/VLAN "${name}" has no security zone assigned. Unzoned interfaces may bypass firewall policy and create unexpected traffic paths.`,
          section: "Interface & VLAN Security",
          remediation: "Go to Network > Interfaces (or Ports and VLANs). Assign a security zone to each interface. Use LAN for trusted, WAN for untrusted, and DMZ for semi-trusted segments.",
          confidence: "medium",
          evidence: `Interface "${name}" has Zone/Security Zone empty or unassigned`,
        });
      }

      const ifaceKey = interfaceRef || name;
      if (ifaceKey && noInterVlanFilter && /vlan/i.test(row["VLAN"] ?? name) && !vlanFilterReported.has(ifaceKey)) {
        vlanFilterReported.add(ifaceKey);
        findings.push({
          id: `f${nextId()}`, severity: "medium",
          title: `VLANs without inter-VLAN filtering on ${ifaceKey}`,
          detail: `VLAN(s) on interface "${ifaceKey}" do not have inter-VLAN filtering enabled. Traffic between VLANs on the same interface may bypass intended segmentation.`,
          section: "Interface & VLAN Security",
          remediation: "Go to Network > Interfaces. Enable inter-VLAN filtering for VLAN interfaces. Ensure firewall rules control traffic between VLANs.",
          confidence: "medium",
          evidence: `Interface "${ifaceKey}" has Inter-VLAN Filtering=disabled/empty`,
        });
      }

      if (trunkNoNative) {
        findings.push({
          id: `f${nextId()}`, severity: "low",
          title: `Trunk port without native VLAN configuration: ${name}`,
          detail: `Trunk port "${name}" has no explicit native VLAN configured. Untagged traffic may be assigned to an unexpected VLAN.`,
          section: "Interface & VLAN Security",
          remediation: "Go to Network > Interfaces. Set an explicit native VLAN for trunk ports to ensure untagged traffic is handled predictably.",
          confidence: "medium",
          evidence: `Trunk port "${name}" has Native VLAN empty`,
        });
      }
    }
  }
}

/** D5: ZTNA/Zero Trust checks — only flag when ZTNA is partially configured */
function analyseZtna(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const ztnaSection = findSection(sections, /ztna|zero.*trust|zero-trust/i);
  if (!ztnaSection) return;

  let hasGateway = false;
  let hasRulesOrPolicies = false;

  for (const t of ztnaSection.tables) {
    for (const row of t.rows) {
      const rowStr = JSON.stringify(row).toLowerCase();
      if (/gateway|connector|access.?gateway/i.test(rowStr)) hasGateway = true;
      if (/policy|rule|access.?control|application/i.test(rowStr)) hasRulesOrPolicies = true;
    }
  }
  const text = (ztnaSection.text ?? "").toLowerCase();
  if (/gateway|connector|access.?gateway/i.test(text)) hasGateway = true;
  if (/policy|rule|access.?control|application/i.test(text)) hasRulesOrPolicies = true;

  if (hasGateway && !hasRulesOrPolicies) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: "ZTNA gateway configured but no access policies defined",
      detail: "A ZTNA/Zero Trust gateway is configured but no access policies or rules were found. The gateway provides no protection without policies defining which applications and resources users can access.",
      section: "Access Control",
      remediation: "Go to Zero Trust Network Access settings. Define access policies that specify which applications and resources each user group can access. Apply policies to the ZTNA connector.",
      confidence: "medium",
      evidence: "ZTNA section has gateway/connector configuration but no policy/rule entries",
    });
  }
}

/** D6: Firmware version risk assessment — flag EOL firmware */
function analyseFirmwareVersion(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /device.*info|system.*info|firmware|about/i);
  if (!section) return;

  const FIRMWARE_EOL: Record<string, string> = {
    "17": "2021-04-01",
    "18": "2023-03-31",
    "19": "2024-09-30",
  };

  let version: string | null = null;
  const versionPattern = /SFOS\s*(\d+)|v(\d+)|version\s*(\d+)|firmware\s*(\d+)/i;

  for (const t of section.tables) {
    for (const row of t.rows) {
      const rowStr = JSON.stringify(row);
      const m = rowStr.match(versionPattern);
      if (m) {
        version = (m[1] ?? m[2] ?? m[3] ?? m[4]) ?? null;
        break;
      }
    }
    if (version) break;
  }
  if (!version && section.text) {
    const m = section.text.match(versionPattern);
    if (m) version = (m[1] ?? m[2] ?? m[3] ?? m[4]) ?? null;
  }
  if (!version) return;

  const eolDate = FIRMWARE_EOL[version];
  if (!eolDate) return;

  const eol = new Date(eolDate);
  if (new Date() <= eol) return;

  findings.push({
    id: `f${nextId()}`,
    severity: "critical",
    title: "Firewall running end-of-life firmware",
    detail: `Firmware version ${version} reached end of life on ${eolDate}. No further security patches are available.`,
    section: "Device Hardening",
    remediation: "Upgrade the firewall to a supported firmware version. Go to System > Firmware and check for available updates. Plan maintenance during a change window.",
    confidence: "high",
    evidence: `Firmware version ${version} detected; EOL date ${eolDate} has passed`,
  });
}

/** D7: Licence vs feature usage validation — only when Central-linked and licence data available */
function analyseLicenceUsage(
  sections: ExtractedSections, findings: Finding[], nextId: () => number, options?: AnalyseOptions,
) {
  if (!options?.centralLinked) return;

  const licenceSection = findSection(sections, /licen[cs]e|subscription|module/i);
  if (!licenceSection) return;

  const licenceText = JSON.stringify(licenceSection).toLowerCase();

  if (/web\s*protection|web\s*server\s*protection/i.test(licenceText)) {
    const wfSection = findSection(sections, /web\s*filter\s*polic/i);
    const wafSection = findSection(sections, /waf|web.*application.*firewall|server.*access.*control/i);
    const hasWebFilter = wfSection && wfSection.tables.some((t) => t.rows.length > 0);
    const hasWaf = wafSection && wafSection.tables.some((t) => t.rows.length > 0);
    if (!hasWebFilter && !hasWaf) {
      findings.push({
        id: `f${nextId()}`,
        severity: "low",
        title: "Licensed feature not in use: Web Protection",
        detail: "Web Protection or Web Server Protection is licensed but no web filter policies or WAF rules were found in the configuration.",
        section: "Licensing",
        confidence: "medium",
        evidence: "Licence section indicates Web Protection; no web filter or WAF policies configured",
      });
    }
  }

  if (/email\s*protection/i.test(licenceText)) {
    const relaySection = findSection(sections, /relay\s*setting|smarthost/i);
    const dkimSection = findSection(sections, /dkim/i);
    const hasRelay = relaySection && (relaySection.tables.some((t) => t.rows.length > 0) || relaySection.text);
    const hasDkim = dkimSection && (dkimSection.tables.some((t) => t.rows.length > 0) || dkimSection.text);
    if (!hasRelay && !hasDkim) {
      findings.push({
        id: `f${nextId()}`,
        severity: "low",
        title: "Licensed feature not in use: Email Protection",
        detail: "Email Protection is licensed but no email relay, SMTP rules, or DKIM policies were found in the configuration.",
        section: "Licensing",
        confidence: "medium",
        evidence: "Licence section indicates Email Protection; no email/SMTP or DKIM configuration found",
      });
    }
  }

  if (/sandstorm|zero.?day\s*protection/i.test(licenceText)) {
    const vsSection = findSection(sections, /virus|malware|anti.?virus|scanning/i);
    let sandboxEnabled = false;
    if (vsSection) {
      for (const t of vsSection.tables) {
        for (const row of t.rows) {
          const setting = (row["Setting"] ?? row["Protocol"] ?? Object.keys(row)[0] ?? "").toLowerCase();
          const value = (row["Value"] ?? row["Status"] ?? row[setting] ?? "").toLowerCase().trim();
          if (/sandbox|sandstorm|zero.?day/i.test(setting)) {
            if (value === "enabled" || value === "on" || value === "yes" || value.includes("✓")) {
              sandboxEnabled = true;
            }
          }
        }
      }
    }
    if (!sandboxEnabled) {
      findings.push({
        id: `f${nextId()}`,
        severity: "low",
        title: "Licensed feature not in use: Sandstorm / Zero-Day Protection",
        detail: "Sandstorm or Zero-Day Protection is licensed but sandbox scanning appears to be disabled in the virus scanning configuration.",
        section: "Licensing",
        confidence: "medium",
        evidence: "Licence section indicates Sandstorm/Zero-Day; sandbox not enabled in virus scanning",
      });
    }
  }
}

/**
 * Aggregate analysis across multiple firewalls.
 */
export function analyseMultiConfig(
  configs: Record<string, ExtractedSections>,
  optionsMap?: Record<string, AnalyseOptions>,
): { perFirewall: Record<string, AnalysisResult>; totalFindings: number; totalRules: number } {
  const perFirewall: Record<string, AnalysisResult> = {};
  let totalFindings = 0;
  let totalRules = 0;

  for (const [label, sections] of Object.entries(configs)) {
    const result = analyseConfig(sections, optionsMap?.[label]);
    perFirewall[label] = result;
    totalFindings += result.findings.length;
    totalRules += result.stats.totalRules;
  }

  return { perFirewall, totalFindings, totalRules };
}
