/**
 * Deterministic pre-AI analysis of extracted Sophos firewall config.
 * Produces repeatable findings without calling any LLM — runs entirely
 * in the browser on the extracted section data.
 */

import type { ExtractedSections, SectionData, TableData } from "./extract-sections";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  section: string;
}

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

export interface AnalysisResult {
  stats: ConfigStats;
  findings: Finding[];
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

function isAnyService(row: Record<string, string>): boolean {
  const svc = (row["Service"] ?? row["Services"] ?? row["service"] ?? "").toLowerCase().trim();
  return svc === "any";
}

function isBroadSource(row: Record<string, string>): boolean {
  const src = (row["Source Networks"] ?? row["Source"] ?? row["Src Networks"] ?? "").toLowerCase().trim();
  return src === "any" || src === "";
}

function isBroadDest(row: Record<string, string>): boolean {
  const dst = (row["Destination Networks"] ?? row["Destination"] ?? row["Dest Networks"] ?? "").toLowerCase().trim();
  return dst === "any" || dst === "";
}

function ruleName(row: Record<string, string>): string {
  return row["Rule Name"] ?? row["Name"] ?? row["Rule"] ?? row["col1"] ?? "Unnamed";
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

  if (!rulesTable || totalRules === 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "info",
      title: "No firewall rules found",
      detail: "The parser did not extract any firewall rules from this configuration export.",
      section: "Firewall Rules",
    });
    return { stats, findings };
  }

  // --- WAN rules with no web filtering ---
  const wanNoFilter: string[] = [];
  for (const row of rulesTable.rows) {
    if (isWanDest(row) && isWebService(row) && !hasWebFilter(row)) {
      wanNoFilter.push(ruleName(row));
    }
  }
  if (wanNoFilter.length > 0) {
    findings.push({
      id: `f${++fid}`,
      severity: "critical",
      title: `${wanNoFilter.length} WAN rule${wanNoFilter.length > 1 ? "s" : ""} missing web filtering`,
      detail: `Rules with Destination Zone WAN and Service HTTP/HTTPS/ANY have no Web Filter applied: ${wanNoFilter.slice(0, 8).join(", ")}${wanNoFilter.length > 8 ? ` (+${wanNoFilter.length - 8} more)` : ""}. This is a KCSIE/DfE compliance gap.`,
      section: "Firewall Rules",
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
      });
    }
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

  return { stats, findings };
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
