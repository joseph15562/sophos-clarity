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

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  section: string;
  remediation?: string;
}

export interface AtpStatus {
  enabled: boolean;
  policy: string;
}

export interface AnalysisResult {
  stats: ConfigStats;
  findings: Finding[];
  inspectionPosture: InspectionPosture;
  /** Column headers found in the firewall rules table — useful for diagnosing detection gaps */
  ruleColumns?: string[];
  /** Firewall hostname extracted from Admin Settings > Hostname Settings */
  hostname?: string;
  /** Advanced Threat Protection (Sophos X-Ops) status from config */
  atpStatus?: AtpStatus;
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
  // Real Sophos exports use "✓ On" / "✗ Off" or "✓ Enabled" / "✗ Disabled"
  if (status.includes("off") || status.includes("disabled") || status.includes("inactive")) return true;
  if (status === "no" || status === "false") return true;
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
  return ips !== "" && ips !== "none" && ips !== "not specified" && ips !== "-" && ips !== "disabled" && ips !== "off" && ips !== "n/a";
}

function ruleSignature(row: Record<string, string>): string {
  const src = (row["Source Networks"] ?? row["Source"] ?? row["Src Networks"] ?? "").toLowerCase().trim();
  const dst = (row["Destination Networks"] ?? row["Destination"] ?? row["Dest Networks"] ?? "").toLowerCase().trim();
  const svc = (row["Service"] ?? row["Services"] ?? row["Services/Ports"] ?? row["service"] ?? "").toLowerCase().trim();
  const srcZ = (row["Source Zone"] ?? row["Source Zones"] ?? row["Src Zone"] ?? "").toLowerCase().trim();
  const dstZ = (row["Destination Zone"] ?? row["Destination Zones"] ?? row["Dest Zone"] ?? row["DestZone"] ?? "").toLowerCase().trim();
  return `${srcZ}|${src}|${dstZ}|${dst}|${svc}`;
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
          enabled: !status.includes("off") && !status.includes("disabled") && !status.includes("inactive"),
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

/**
 * Run deterministic analysis on a single firewall's extracted sections.
 */
export function analyseConfig(sections: ExtractedSections): AnalysisResult {
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
    });
  }

  // --- ANY service rules ---
  const anySvc: string[] = [];
  for (const row of rulesTable.rows) {
    if (isAnyService(row)) anySvc.push(ruleName(row));
  }
  if (anySvc.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: `${anySvc.length} rule${anySvc.length > 1 ? "s" : ""} using "ANY" service`,
      detail: `Rules permitting all services: ${anySvc.slice(0, 8).join(", ")}${anySvc.length > 8 ? ` (+${anySvc.length - 8} more)` : ""}. Broad service rules increase attack surface — restrict to required protocols where possible.`,
      section: "Firewall Rules",
      remediation: "Review traffic logs via the Log viewer (upper-right corner) to identify which protocols are in use. Create specific service objects under Hosts and services > Services. Edit each rule to replace 'Any' with specific services.",
    });
  }

  // --- Broad source/destination rules ---
  const broadRules: string[] = [];
  for (const row of rulesTable.rows) {
    if (isBroadSource(row) && isBroadDest(row)) broadRules.push(ruleName(row));
  }
  if (broadRules.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: `${broadRules.length} rule${broadRules.length > 1 ? "s" : ""} with broad source and destination`,
      detail: `Rules with both Source and Destination set to "Any" or blank: ${broadRules.slice(0, 6).join(", ")}${broadRules.length > 6 ? ` (+${broadRules.length - 6} more)` : ""}. Consider restricting to specific networks.`,
      section: "Firewall Rules",
      remediation: "Create specific IP host or IP host group objects under Hosts and services. Edit each broad rule under Rules and policies > Firewall rules to replace 'Any' source/destination with named network objects.",
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
    });
  } else if (withSslInspection > 0 && sslDecryptRules === 0 && wanRules.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "critical",
      title: `${withSslInspection} SSL/TLS rule${withSslInspection !== 1 ? "s" : ""} but none decrypt traffic (DPI inactive)`,
      detail: `All ${withSslInspection} SSL/TLS inspection rules are exclusions ("Do not decrypt"). Without at least one Decrypt rule, no encrypted traffic is being inspected — web filtering, IPS, and application control cannot operate on HTTPS traffic.`,
      section: "SSL/TLS Inspection",
      remediation: "Go to Rules and policies > SSL/TLS inspection rules. Add a Decrypt rule for LAN→WAN traffic below the exclusion rules. Download the signing CA from SSL/TLS inspection settings and deploy to endpoints.",
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
  analyseHA(sections, findings, () => ++fid);

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
    });
  }

  const atpStatus = extractAtpStatus(sections);

  return { stats, findings, inspectionPosture, ruleColumns: rulesTable.headers, hostname: extractHostname(sections), atpStatus };
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
      });
    }
    if (sshWan.length > 0) {
      findings.push({
        id: `f${nextId()}`, severity: "critical",
        title: "SSH accessible from WAN",
        detail: `SSH is enabled on the WAN zone. This allows remote command-line access from the internet — a high-value target for attackers using credential stuffing and exploit attacks.`,
        section: "Local Service ACL",
        remediation: "Go to Administration > Device access. Disable SSH for the WAN zone. Use VPN for remote CLI access. If SSH must remain, restrict to specific IP addresses and ensure MFA is enabled.",
      });
    }
    if (snmpExposed.length > 0) {
      findings.push({
        id: `f${nextId()}`, severity: "high",
        title: `SNMP exposed to ${snmpExposed.map((e) => e.zones).join(", ")}`,
        detail: `SNMP is enabled on ${snmpExposed.map((e) => e.zones).join(", ")}. SNMP (especially v1/v2c) leaks device information and can be used for reconnaissance. If v3 is not enforced, community strings are sent in cleartext.`,
        section: "Local Service ACL",
        remediation: "Go to Administration > Device access. Disable SNMP on untrusted zones. If monitoring is needed, use SNMPv3 with authentication and encryption, and restrict to management VLANs only.",
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

  if (dnatRules.length > 0) {
    findings.push({
      id: `f${nextId()}`, severity: "high",
      title: `${dnatRules.length} DNAT/port forwarding rule${dnatRules.length > 1 ? "s" : ""} expose internal services`,
      detail: `DNAT rules forward inbound traffic to internal servers: ${dnatRules.slice(0, 6).join(", ")}${dnatRules.length > 6 ? ` (+${dnatRules.length - 6} more)` : ""}. Each forwarded port is an entry point — ensure IPS, web filtering, and logging are enabled on the corresponding firewall rules.`,
      section: "NAT Rules",
      remediation: "Review each DNAT rule under Rules and policies > NAT rules. Ensure the matching firewall rule has IPS enabled to detect exploits against the exposed service. Consider restricting source IPs where possible (geo-IP or known partner ranges).",
    });
  }
  if (broadNat.length > 0) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: `${broadNat.length} NAT rule${broadNat.length > 1 ? "s" : ""} with broad source/destination`,
      detail: `NAT rules with overly broad scope: ${broadNat.slice(0, 6).join(", ")}${broadNat.length > 6 ? ` (+${broadNat.length - 6} more)` : ""}. Broad NAT rules can unintentionally expose services or masquerade traffic.`,
      section: "NAT Rules",
      remediation: "Go to Rules and policies > NAT rules. Restrict original source and destination to specific network objects rather than 'Any'. This reduces the blast radius if the rule is misconfigured.",
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
  let hasRules = false;
  for (const t of ipsSection.tables) {
    totalPolicies += t.rows.length;
    for (const row of t.rows) {
      const ruleCount = row["Rules"] ?? row["Rule Count"] ?? row["Signatures"] ?? "";
      if (ruleCount && parseInt(ruleCount) > 0) hasRules = true;
      const action = (row["Action"] ?? row["Default Action"] ?? "").toLowerCase();
      if (action.includes("allow") || action.includes("permit")) {
        findings.push({
          id: `f${nextId()}`, severity: "medium",
          title: `IPS policy "${row["Name"] ?? row["Policy Name"] ?? "Unknown"}" default action is Allow`,
          detail: `An IPS policy is configured with a default action of Allow/Permit. This means unclassified traffic bypasses IPS inspection. Consider setting the default action to Drop for WAN-facing rules.`,
          section: "IPS Policies",
          remediation: "Go to Intrusion prevention > IPS policies. Edit the policy and set the default action to 'Drop' for maximum protection. Review IPS alerts and add exceptions only for verified false positives.",
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
    });
  }

  if (sandboxFound && !sandboxEnabled) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: "Sandboxing / Zero-day protection not enabled",
      detail: "The Sophos Sandstorm (sandboxing) feature is available but not enabled. Without sandboxing, zero-day malware that evades signature-based detection will not be caught. This requires a valid Sophos Central / Sandstorm licence.",
      section: "Virus Scanning",
      remediation: "Go to Protection > Web protection > Enable Sophos Sandstorm analysis. This sends suspicious files to the cloud sandbox for detonation analysis. Requires an active Sandstorm licence.",
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Device Hardening – Sophos Health Check detectable items            */
/* ------------------------------------------------------------------ */

function getSettingValue(sections: ExtractedSections, sectionPattern: RegExp, key: RegExp): string | null {
  const section = findSection(sections, sectionPattern);
  if (!section) return null;
  for (const t of section.tables) {
    for (const row of t.rows) {
      for (const [k, v] of Object.entries(row)) {
        if (key.test(k)) return v;
      }
    }
  }
  const text = section.text ?? "";
  const m = text.match(new RegExp(key.source + "\\s*[=:]?\\s*(\\S+)", "i"));
  return m ? m[1] : null;
}

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
    });
  }
}

function analyseBackupRestore(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^BackupRestore$/i) ?? findSection(sections, /backup/i);
  if (!section) return;

  const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");
  const freq = text.match(/BackupFrequency[^}]*?[":]?\s*(Never|Daily|Weekly|Monthly)/i)?.[1] ??
    text.match(/Frequency[^}]*?[":]?\s*(Never|Daily|Weekly|Monthly)/i)?.[1];

  if (!freq || /never/i.test(freq)) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: "Automated backups not scheduled",
      detail: "No scheduled backup configuration detected. Without regular backups, configuration recovery after failure is at risk.",
      section: "Backup & Restore",
      remediation: "Go to System services > Backup & firmware > Schedule automated backups (daily or weekly). Send to email or Sophos Central.",
    });
  }
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
    });
  }
}

function analyseAuthServers(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^AuthenticationServer$/i) ?? findSection(sections, /authentication.?server/i);
  if (!section) return;

  const unencrypted: string[] = [];
  for (const t of section.tables) {
    for (const row of t.rows) {
      const name = row["Server Name"] ?? row["Name"] ?? row["col1"] ?? "";
      const security = (row["Connection Security"] ?? row["ConnectionSecurity"] ?? "").toLowerCase();
      if (name && security && (security === "simple" || security === "plain" || security === "none")) {
        unencrypted.push(name);
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
    });
  }
}

function analyseSyncAppControl(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^ApplicationClassification$/i) ?? findSection(sections, /application.?classification$/i);
  if (!section) return;

  const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");

  const enabled = /ACTION[^}]*?Enable/i.test(text) || /Enabled/i.test(text);
  if (!enabled) {
    findings.push({
      id: `f${nextId()}`, severity: "medium",
      title: "Synchronized Application Control disabled",
      detail: "Synchronized Application Control is not enabled. This feature uses Security Heartbeat data from endpoints to identify and classify unknown application traffic.",
      section: "Application Classification",
      remediation: "Go to Applications > Synchronized Application Control > Enable the feature. Requires Security Heartbeat and Sophos Endpoint.",
    });
  }
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
    });
    return;
  }

  const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") + " " + (section.text ?? "");

  const deviceMode = text.match(/Device[^}]*?[":]?\s*(Active[_\s]?Passive|Active[_\s]?Active|Standalone)/i)?.[1];
  const nodeName = text.match(/NodeName[^}]*?[":]?\s*(\w+)/i)?.[1];
  const clusterId = text.match(/ClusterID[^}]*?[":]?\s*(\d+)/i)?.[1];

  if (deviceMode) {
    const mode = deviceMode.replace(/_/g, "-");
    const clusterInfo = clusterId != null ? ` Cluster ID: ${clusterId}.` : "";
    findings.push({
      id: `f${nextId()}`, severity: "info",
      title: `HA configured: ${mode}${nodeName ? ` (${nodeName})` : ""}`,
      detail: `High Availability is configured in ${mode} mode.${nodeName ? ` This node is "${nodeName}".` : ""}${clusterInfo}`,
      section: "High Availability",
    });
  }
}

/**
 * Aggregate analysis across multiple firewalls.
 */
export function analyseMultiConfig(
  configs: Record<string, ExtractedSections>,
): { perFirewall: Record<string, AnalysisResult>; totalFindings: number; totalRules: number } {
  const perFirewall: Record<string, AnalysisResult> = {};
  let totalFindings = 0;
  let totalRules = 0;

  for (const [label, sections] of Object.entries(configs)) {
    const result = analyseConfig(sections);
    perFirewall[label] = result;
    totalFindings += result.findings.length;
    totalRules += result.stats.totalRules;
  }

  return { perFirewall, totalFindings, totalRules };
}
