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

export interface InspectionPosture {
  totalWanRules: number;
  enabledWanRules: number;
  disabledWanRules: number;
  withWebFilter: number;
  withoutWebFilter: number;
  withAppControl: number;
  withIps: number;
  withSslInspection: number;
  wanRuleNames: string[];
  totalDisabledRules: number;
  dpiEngineEnabled: boolean | null;
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  section: string;
  remediation?: string;
}

export interface AnalysisResult {
  stats: ConfigStats;
  findings: Finding[];
  inspectionPosture: InspectionPosture;
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
  const dz = (row["Destination Zone"] ?? row["Dest Zone"] ?? row["DestZone"] ?? row["Dest zone"] ?? "").toLowerCase();
  return dz === "wan";
}

function isWebService(row: Record<string, string>): boolean {
  const svc = (row["Service"] ?? row["Services"] ?? row["service"] ?? "").toLowerCase();
  return svc.includes("http") || svc.includes("https") || svc === "any";
}

function hasWebFilter(row: Record<string, string>): boolean {
  const wf = (
    row["Web Filter"] ?? row["Web Filter Policy"] ?? row["WebFilter"] ?? ""
  ).toLowerCase().trim();
  return wf !== "" && wf !== "none" && wf !== "not specified" && wf !== "-";
}

function isLoggingOff(row: Record<string, string>): boolean {
  const log = (row["Log"] ?? row["Logging"] ?? row["logging"] ?? "").toLowerCase().trim();
  return log === "disabled" || log === "off" || log === "disable" || log === "no";
}

function isRuleDisabled(row: Record<string, string>): boolean {
  const status = (
    row["Status"] ?? row["Rule Status"] ?? row["Enabled"] ?? row["Active"] ?? ""
  ).toLowerCase().trim();
  return status === "disabled" || status === "off" || status === "inactive" || status === "no" || status === "false";
}

function isAnyService(row: Record<string, string>): boolean {
  const svc = (row["Service"] ?? row["Services"] ?? row["service"] ?? "").toLowerCase().trim();
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
  const ac = (row["Application Control"] ?? row["App Control"] ?? row["AppControl"] ?? "").toLowerCase().trim();
  return ac !== "" && ac !== "none" && ac !== "not specified" && ac !== "-";
}

function hasIps(row: Record<string, string>): boolean {
  const ips = (row["IPS"] ?? row["Intrusion Prevention"] ?? row["IPS Policy"] ?? "").toLowerCase().trim();
  return ips !== "" && ips !== "none" && ips !== "not specified" && ips !== "-" && ips !== "disabled" && ips !== "off";
}

function ruleSignature(row: Record<string, string>): string {
  const src = (row["Source Networks"] ?? row["Source"] ?? row["Src Networks"] ?? "").toLowerCase().trim();
  const dst = (row["Destination Networks"] ?? row["Destination"] ?? row["Dest Networks"] ?? "").toLowerCase().trim();
  const svc = (row["Service"] ?? row["Services"] ?? row["service"] ?? "").toLowerCase().trim();
  const srcZ = (row["Source Zone"] ?? row["Src Zone"] ?? "").toLowerCase().trim();
  const dstZ = (row["Destination Zone"] ?? row["Dest Zone"] ?? row["DestZone"] ?? "").toLowerCase().trim();
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

function findDpiEngineStatus(sections: ExtractedSections): boolean | null {
  const DPI_PATTERN = /dpi|deep\s*packet|scan\s*engine|security\s*engine/i;

  for (const key of Object.keys(sections)) {
    if (!DPI_PATTERN.test(key)) continue;
    const section = sections[key];

    for (const t of section.tables) {
      for (const row of t.rows) {
        const allValues = Object.values(row);
        const hasDpiRef = allValues.some((v) => DPI_PATTERN.test(v));
        if (hasDpiRef) {
          const statusVal = allValues.find((v) =>
            /^(enabled|disabled|on|off|active|inactive|yes|no)$/i.test(v.trim())
          );
          if (statusVal) {
            const s = statusVal.toLowerCase().trim();
            return s === "enabled" || s === "on" || s === "active" || s === "yes";
          }
        }

        for (const [k, v] of Object.entries(row)) {
          if (DPI_PATTERN.test(k)) {
            const val = v.toLowerCase().trim();
            if (val === "enabled" || val === "on" || val === "active" || val === "yes") return true;
            if (val === "disabled" || val === "off" || val === "inactive" || val === "no") return false;
          }
        }
      }
    }

    for (const d of section.details) {
      for (const [k, v] of Object.entries(d.fields)) {
        if (DPI_PATTERN.test(k)) {
          const val = v.toLowerCase().trim();
          if (val === "enabled" || val === "on" || val === "active" || val === "yes") return true;
          if (val === "disabled" || val === "off" || val === "inactive" || val === "no") return false;
        }
      }
    }

    if (section.text) {
      const t = section.text.toLowerCase();
      if (/dpi.*enabled|engine.*enabled|deep.*packet.*enabled/i.test(t)) return true;
      if (/dpi.*disabled|engine.*disabled|deep.*packet.*disabled/i.test(t)) return false;
    }
  }
  return null;
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
  const interfaces = countRows(sections, /interface|port|vlan/i);

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
    withWebFilter: 0, withoutWebFilter: 0,
    withAppControl: 0, withIps: 0, withSslInspection: 0, wanRuleNames: [],
    totalDisabledRules: 0, dpiEngineEnabled: null,
  };

  if (!rulesTable || totalRules === 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "info",
      title: "No firewall rules found",
      detail: "The parser did not extract any firewall rules from this configuration export.",
      section: "Firewall Rules",
    });
    return { stats, findings, inspectionPosture: emptyPosture };
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

  let withWebFilter = 0, withoutWebFilter = 0, withAppControl = 0, withIps = 0, withSslInspection = 0;
  for (const { row, enabled } of wanRules) {
    if (!enabled) continue; // only score enabled rules
    if (hasWebFilter(row)) withWebFilter++; else withoutWebFilter++;
    if (hasAppControl(row)) withAppControl++;
    if (hasIps(row)) withIps++;
  }
  // SSL/TLS inspection rules (from dedicated section)
  for (const key of Object.keys(sections)) {
    if (/ssl.*tls.*inspection|tls.*inspection/i.test(key)) {
      for (const t of sections[key].tables) withSslInspection += t.rows.length;
    }
  }

  const dpiEngineEnabled = findDpiEngineStatus(sections);

  const inspectionPosture: InspectionPosture = {
    totalWanRules: wanRules.length,
    enabledWanRules: enabledWanRules.length,
    disabledWanRules: disabledWanRules.length,
    withWebFilter, withoutWebFilter, withAppControl, withIps, withSslInspection,
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
      remediation: "Review disabled WAN rules. If no longer needed, delete them to reduce clutter. If they should be active, re-enable them and ensure proper DPI features are applied.",
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

  // --- DPI engine check ---
  if (dpiEngineEnabled === false) {
    findings.push({
      id: `f${++fid}`,
      severity: "critical",
      title: "DPI engine is disabled",
      detail: "The Deep Packet Inspection engine is turned off. Without DPI, web filtering, IPS, application control, and SSL/TLS inspection cannot function regardless of rule-level settings.",
      section: "DPI Engine",
      remediation: "Navigate to System → Administration → Device Access or Protection → Inspection Settings and enable the DPI engine. Note: this may increase CPU utilisation — monitor after enabling.",
    });
  }

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
      remediation: "Apply a Web Filter policy to all WAN-facing rules that permit HTTP, HTTPS, or ANY services. Use the default or a custom policy aligned to your organisation's acceptable use standards.",
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
      remediation: "Enable logging on all firewall rules. At minimum, enable \"Log when connection is established\" for critical traffic paths to support incident response and compliance auditing.",
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
      remediation: "Replace \"ANY\" service with specific service objects or groups that match the actual traffic requirements. Start by reviewing traffic logs to identify which protocols are in use.",
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
      remediation: "Restrict source and destination to named network or host objects. Avoid \"Any-to-Any\" rules — use zone-based segmentation and explicit network groups.",
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
        remediation: "Enable OTP/MFA for all administrator and VPN user access. Configure TOTP tokens via Sophos Authenticator or a compatible authenticator app for all admin accounts.",
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
      remediation: "Review overlapping rules and consolidate where possible. Remove shadowed rules that will never be matched. Use rule ordering to ensure the most specific rules are evaluated first.",
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
      remediation: "Apply an IPS policy to all WAN-facing firewall rules. Use the recommended Sophos IPS policy as a baseline and tune for false positives after deployment.",
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
      remediation: "Enable Application Control on WAN-facing rules to gain visibility into application-level traffic and enforce acceptable use policies.",
    });
  }

  // --- SSL/TLS inspection coverage ---
  if (withSslInspection === 0 && wanRules.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "medium",
      title: "No SSL/TLS inspection rules configured",
      detail: "No SSL/TLS inspection rules were found. Without TLS decryption, the firewall cannot inspect encrypted traffic for threats, significantly reducing security coverage for web-based attacks.",
      section: "SSL/TLS Inspection",
      remediation: "Configure SSL/TLS inspection rules for outbound web traffic. Deploy the Sophos CA certificate to managed endpoints. Start with a permissive exclusion list and tighten over time.",
    });
  }

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

  return { stats, findings, inspectionPosture };
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
