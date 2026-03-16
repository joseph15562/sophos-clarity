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

function getDetails(sections: ExtractedSections, name: string): Array<{ title: string; fields: Record<string, string> }> {
  return sections[name]?.details ?? [];
}

function isAnyService(row: Record<string, string>): boolean {
  const svc = (row["Service"] ?? row["Services"] ?? "").toLowerCase().trim();
  return svc === "any";
}

function isBroadSource(row: Record<string, string>): boolean {
  const raw = row["Source Networks"] ?? row["Source"];
  if (raw === undefined) return false;
  return raw.toLowerCase().trim() === "any";
}

function isBroadDest(row: Record<string, string>): boolean {
  const raw = row["Destination Networks"] ?? row["Destination"];
  if (raw === undefined) return false;
  return raw.toLowerCase().trim() === "any";
}

function ruleName(row: Record<string, string>): string {
  return row["Rule Name"] ?? row["Name"] ?? row["Rule"] ?? "Unnamed";
}

function isRuleDisabled(row: Record<string, string>): boolean {
  const status = (row["Status"] ?? "").toLowerCase().trim();
  return status.includes("off") || status.includes("disable") || status.includes("inactive") || status === "no" || status === "false" || status === "0";
}

function isLoggingOff(row: Record<string, string>): boolean {
  const log = (row["Log"] ?? row["Log Traffic"] ?? "").toLowerCase().trim();
  return log === "disabled" || log === "off" || log === "disable" || log === "no";
}

function hasAppControl(row: Record<string, string>): boolean {
  const ac = (row["Application Control"] ?? row["App Control"] ?? row["Application Filter"] ?? "").toLowerCase().trim();
  return ac !== "" && ac !== "none" && ac !== "not specified" && ac !== "-" && ac !== "n/a";
}

function hasIps(row: Record<string, string>): boolean {
  const ips = (row["IPS"] ?? row["IPS Policy"] ?? row["Intrusion Prevention"] ?? "").toLowerCase().trim();
  return ips !== "" && ips !== "none" && ips !== "not specified" && ips !== "-" && !ips.includes("disable") && ips !== "off" && ips !== "n/a";
}

function hasWebFilter(row: Record<string, string>): boolean {
  const wf = (row["Web Filter"] ?? "").toLowerCase().trim();
  return wf !== "" && wf !== "none" && wf !== "not specified" && wf !== "-" && wf !== "n/a";
}

function isWebService(row: Record<string, string>): boolean {
  const svc = (row["Service"] ?? "").toLowerCase().trim();
  return /http|https|any|web/i.test(svc);
}

function ruleSignature(row: Record<string, string>): string {
  const src = (row["Source Networks"] ?? row["Source"] ?? "").toLowerCase().trim();
  const dst = (row["Destination Networks"] ?? row["Destination"] ?? "").toLowerCase().trim();
  const svc = (row["Service"] ?? "").toLowerCase().trim();
  const srcZ = (row["Source Zone"] ?? row["Source Zones"] ?? "").toLowerCase().trim();
  const dstZ = (row["Destination Zone"] ?? row["Destination Zones"] ?? "").toLowerCase().trim();
  return `${srcZ}|${src}|${dstZ}|${dst}|${svc}`;
}

interface SslTlsRule {
  name: string;
  action: string;
  enabled: boolean;
  sourceZones: string[];
  destZones: string[];
}

function splitZones(raw: string): string[] {
  return raw.split(/[,;]/).map((z) => z.trim().toLowerCase()).filter(Boolean);
}

function parseSslRules(sections: ExtractedSections): SslTlsRule[] {
  const sslRows = getRows(sections, "SSL/TLS Inspection Rules");
  return sslRows.map((row) => {
    const action = (row["Action"] ?? row["Decrypt Action"] ?? "").toLowerCase();
    const status = (row["Status"] ?? "").toLowerCase();
    const srcZ = row["Source Zone"] ?? row["Source Zones"] ?? "";
    const dstZ = row["Destination Zone"] ?? row["Destination Zones"] ?? "";
    return {
      name: row["Name"] ?? row["Rule Name"] ?? "",
      action: action.includes("decrypt") ? "decrypt" : action.includes("exclude") ? "exclude" : action,
      enabled: !status.includes("off") && !status.includes("disable") && status !== "0",
      sourceZones: splitZones(srcZ),
      destZones: splitZones(dstZ),
    };
  });
}

function findUncoveredZones(
  wanRules: Record<string, string>[],
  sslRules: SslTlsRule[],
): string[] {
  const decryptRules = sslRules.filter((r) => r.action === "decrypt" && r.enabled);
  if (decryptRules.length === 0) return [];

  const fwSourceZones = new Set<string>();
  for (const row of wanRules) {
    if (isRuleDisabled(row)) continue;
    const sz = (row["Source Zone"] ?? row["Source Zones"] ?? "").toLowerCase().trim();
    if (sz && sz !== "any") {
      sz.split(/[,;]/).forEach((z) => {
        const trimmed = z.trim();
        if (trimmed) fwSourceZones.add(trimmed);
      });
    }
  }
  if (fwSourceZones.size === 0) return [];

  const uncovered: string[] = [];
  for (const zone of Array.from(fwSourceZones)) {
    const isCovered = decryptRules.some((r) => {
      const srcMatch = r.sourceZones.includes("any") || r.sourceZones.includes(zone);
      const dstMatch = r.destZones.includes("any") || r.destZones.some((d) => d.includes("wan"));
      return srcMatch && dstMatch;
    });
    if (!isCovered) uncovered.push(zone);
  }
  return uncovered;
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

  const enabledWan = wanRules.filter((r) => !isRuleDisabled(r));
  const disabledWanRules = wanRules.filter((r) => isRuleDisabled(r));
  const disabledRules = fwRules.filter((r) => isRuleDisabled(r));

  const webFilterable = enabledWan.filter((r) => isWebService(r));
  const withWebFilter = webFilterable.filter((r) => hasWebFilter(r));
  const withIps = enabledWan.filter((r) => hasIps(r));
  const withAppControl = enabledWan.filter((r) => hasAppControl(r));

  // SSL/TLS inspection
  const sslRules = parseSslRules(sections);
  const sslDecryptCount = sslRules.filter((r) => r.action === "decrypt" && r.enabled).length;
  const sslExclusionCount = sslRules.filter((r) => r.action === "exclude").length;
  const dpiEngineEnabled = sslDecryptCount > 0;
  const sslUncoveredZones = findUncoveredZones(wanRules, sslRules);

  const inspectionPosture: InspectionPosture = {
    totalWanRules: wanRules.length,
    enabledWanRules: enabledWan.length,
    disabledWanRules: disabledWanRules.length,
    webFilterableRules: webFilterable.length,
    withWebFilter: withWebFilter.length,
    withoutWebFilter: webFilterable.length - withWebFilter.length,
    withAppControl: withAppControl.length,
    withIps: withIps.length,
    withSslInspection: sslRules.length,
    sslDecryptRules: sslDecryptCount,
    sslExclusionRules: sslExclusionCount,
    sslRules: [],
    sslUncoveredZones,
    wanRuleNames: enabledWan.map((r) => r["Rule Name"] ?? ""),
    totalDisabledRules: disabledRules.length,
    dpiEngineEnabled,
  };

  // ── Disabled WAN rules ──
  if (disabledWanRules.length > 0) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${disabledWanRules.length} WAN rule${disabledWanRules.length > 1 ? "s" : ""} disabled`,
      detail: `Disabled WAN-facing rules: ${disabledWanRules.map((r) => ruleName(r)).slice(0, 6).join(", ")}${disabledWanRules.length > 6 ? ` (+${disabledWanRules.length - 6} more)` : ""}. These rules provide no protection — verify if they should be re-enabled or removed.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  // ── Disabled rules estate-wide ──
  if (disabledRules.length > 0 && disabledRules.length !== disabledWanRules.length) {
    const nonWanDisabled = disabledRules.length - disabledWanRules.length;
    if (nonWanDisabled > 0) {
      findings.push({
        id: nextId(),
        severity: "info",
        title: `${disabledRules.length} total rule${disabledRules.length > 1 ? "s" : ""} disabled across all zones`,
        detail: `${disabledRules.length} firewall rules are in disabled state (${disabledWanRules.length} WAN, ${nonWanDisabled} other). Disabled rules add no security value.`,
        section: "Firewall Rules",
        confidence: "high",
      });
    }
  }

  // ── WAN rules missing web filtering ──
  if (inspectionPosture.withoutWebFilter > 0) {
    const noFilterNames = webFilterable.filter((r) => !hasWebFilter(r)).map((r) => ruleName(r));
    findings.push({
      id: nextId(),
      severity: "critical",
      title: `${inspectionPosture.withoutWebFilter} enabled WAN rule${inspectionPosture.withoutWebFilter > 1 ? "s" : ""} missing web filtering`,
      detail: `Active rules with Destination Zone WAN and HTTP/HTTPS/ANY have no Web Filter applied: ${noFilterNames.slice(0, 8).join(", ")}${noFilterNames.length > 8 ? ` (+${noFilterNames.length - 8} more)` : ""}.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  // ── Logging disabled ──
  const loggingOff = fwRules.filter((r) => isLoggingOff(r));
  if (loggingOff.length > 0) {
    findings.push({
      id: nextId(),
      severity: "high",
      title: `${loggingOff.length} rule${loggingOff.length > 1 ? "s" : ""} with logging disabled`,
      detail: `Logging is turned off on: ${loggingOff.map((r) => ruleName(r)).slice(0, 8).join(", ")}${loggingOff.length > 8 ? ` (+${loggingOff.length - 8} more)` : ""}. Disabled logging creates gaps in audit trails.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  // ── Classify rules by openness: fully open vs ANY service only vs broad network only ──
  const fullyOpen: string[] = [];
  const anySvcOnly: string[] = [];
  const broadNetOnly: string[] = [];
  for (const row of fwRules) {
    const anyService = isAnyService(row);
    const broadNet = isBroadSource(row) && isBroadDest(row);
    const name = ruleName(row);
    if (anyService && broadNet) {
      fullyOpen.push(name);
    } else if (anyService) {
      anySvcOnly.push(name);
    } else if (broadNet) {
      broadNetOnly.push(name);
    }
  }

  if (fullyOpen.length > 0) {
    findings.push({
      id: nextId(),
      severity: "critical",
      title: `${fullyOpen.length} fully open rule${fullyOpen.length > 1 ? "s" : ""} (any source, destination, and service)`,
      detail: `These rules permit all traffic from any source to any destination on any service: ${fullyOpen.slice(0, 6).join(", ")}${fullyOpen.length > 6 ? ` (+${fullyOpen.length - 6} more)` : ""}. Fully open rules effectively bypass firewall protection.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  if (anySvcOnly.length > 0) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${anySvcOnly.length} rule${anySvcOnly.length > 1 ? "s" : ""} using "ANY" service`,
      detail: `Rules permitting all services but with specific source/destination: ${anySvcOnly.slice(0, 8).join(", ")}${anySvcOnly.length > 8 ? ` (+${anySvcOnly.length - 8} more)` : ""}. Broad service rules increase attack surface.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  if (broadNetOnly.length > 0) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${broadNetOnly.length} rule${broadNetOnly.length > 1 ? "s" : ""} with broad source and destination`,
      detail: `Rules with both Source and Destination set to "Any" but with specific services: ${broadNetOnly.slice(0, 6).join(", ")}${broadNetOnly.length > 6 ? ` (+${broadNetOnly.length - 6} more)` : ""}. Consider restricting to specific networks.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  // ── Duplicate / overlapping rules ──
  const sigMap = new Map<string, string[]>();
  for (const row of fwRules) {
    const sig = ruleSignature(row);
    if (!sig || sig === "||||") continue;
    const name = ruleName(row);
    const existing = sigMap.get(sig);
    if (existing) existing.push(name);
    else sigMap.set(sig, [name]);
  }
  const duplicateGroups = Array.from(sigMap.values()).filter((g) => g.length > 1);
  if (duplicateGroups.length > 0) {
    const totalDupes = duplicateGroups.reduce((s, g) => s + g.length, 0);
    const examples = duplicateGroups.slice(0, 3).map((g) => g.join(" / ")).join("; ");
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${totalDupes} rules in ${duplicateGroups.length} overlapping group${duplicateGroups.length > 1 ? "s" : ""}`,
      detail: `Rules with identical source zone, source network, destination zone, destination network, and service: ${examples}${duplicateGroups.length > 3 ? ` (+${duplicateGroups.length - 3} more groups)` : ""}. Overlapping rules may cause shadowing.`,
      section: "Firewall Rules",
      confidence: "high",
    });
  }

  // ── WAN rules without IPS ──
  const wanNoIps = enabledWan.filter((r) => !hasIps(r));
  if (wanNoIps.length > 0 && enabledWan.length > 0) {
    const pct = Math.round((wanNoIps.length / enabledWan.length) * 100);
    findings.push({
      id: nextId(),
      severity: pct > 50 ? "high" : "low",
      title: `${wanNoIps.length} enabled WAN rule${wanNoIps.length > 1 ? "s" : ""} without IPS (${pct}%)`,
      detail: `IPS not applied on: ${wanNoIps.map((r) => ruleName(r)).slice(0, 6).join(", ")}${wanNoIps.length > 6 ? ` (+${wanNoIps.length - 6} more)` : ""}.`,
      section: "Intrusion Prevention",
      confidence: "high",
    });
  }

  // ── WAN rules without Application Control ──
  const wanNoApp = enabledWan.filter((r) => !hasAppControl(r));
  if (wanNoApp.length > 0 && enabledWan.length > 0) {
    const pct = Math.round((wanNoApp.length / enabledWan.length) * 100);
    findings.push({
      id: nextId(),
      severity: pct > 75 ? "medium" : "low",
      title: `${wanNoApp.length} enabled WAN rule${wanNoApp.length > 1 ? "s" : ""} without Application Control (${pct}%)`,
      detail: `Application Control is not enabled on: ${wanNoApp.map((r) => ruleName(r)).slice(0, 6).join(", ")}${wanNoApp.length > 6 ? ` (+${wanNoApp.length - 6} more)` : ""}.`,
      section: "Application Control",
      confidence: "high",
    });
  }

  // ── NAT: DNAT exposing services ──
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

  // ── SSL/TLS inspection ──
  if (sslRules.length === 0 && enabledWan.length > 0) {
    findings.push({
      id: nextId(),
      severity: "critical",
      title: "No SSL/TLS inspection rules configured (DPI inactive)",
      detail: "No SSL/TLS inspection rules were found. Without DPI, the firewall cannot decrypt and inspect HTTPS traffic for threats.",
      section: "SSL/TLS Inspection",
      confidence: "high",
    });
  } else if (sslRules.length > 0 && sslDecryptCount === 0 && enabledWan.length > 0) {
    findings.push({
      id: nextId(),
      severity: "high",
      title: `${sslRules.length} SSL/TLS rule${sslRules.length > 1 ? "s" : ""} but none set to Decrypt`,
      detail: "SSL/TLS rules exist but none actively decrypt traffic. All rules are set to exclude or passthrough.",
      section: "SSL/TLS Inspection",
      confidence: "high",
    });
  }

  if (sslUncoveredZones.length > 0) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `SSL/TLS zone gaps: ${sslUncoveredZones.map((z) => z.toUpperCase()).join(", ")}`,
      detail: `Firewall rules from these source zones route to WAN but are not covered by an SSL/TLS Decrypt rule: ${sslUncoveredZones.map((z) => z.toUpperCase()).join(", ")}.`,
      section: "SSL/TLS Inspection",
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

  // ── Admin / authentication checks ──

  const adminDetails = getDetails(sections, "Admin Settings");
  if (adminDetails.length) {
    const admin = adminDetails[0].fields;
    const loginSecurity = (admin["LoginSecurity"] ?? admin["WebAdminSettings.LoginSecurity"] ?? "").toLowerCase();
    if (!loginSecurity || loginSecurity === "none" || loginSecurity === "disable") {
      findings.push({
        id: nextId(),
        severity: "high",
        title: "Admin login security (CAPTCHA/lockout) not enabled",
        detail: "Without login security, the admin portal is vulnerable to brute-force attacks. Enable CAPTCHA or account lockout.",
        section: "Admin Settings",
        confidence: "medium",
      });
    }
  }

  // OTP / MFA checks
  const otpDetails = getDetails(sections, "OTP / MFA Settings");
  if (otpDetails.length) {
    const otp = otpDetails[0].fields;
    const otpEnabled = (otp["OTPEnabled"] ?? otp["Status"] ?? "").toLowerCase();
    if (otpEnabled === "disable" || otpEnabled === "off" || otpEnabled === "false") {
      findings.push({
        id: nextId(),
        severity: "high",
        title: "Multi-factor authentication (OTP) is disabled",
        detail: "MFA adds a critical layer of authentication security. Enable OTP for admin and VPN users.",
        section: "OTP / MFA Settings",
        confidence: "high",
      });
    }
  } else {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: "OTP / MFA configuration not found",
      detail: "Could not determine MFA status. Verify that OTP is enabled for admin and VPN portal authentication.",
      section: "OTP / MFA Settings",
      confidence: "low",
    });
  }

  // ── DNS checks ──

  const dnsDetails = getDetails(sections, "DNS Configuration");
  if (dnsDetails.length) {
    const dns = dnsDetails[0].fields;
    const dns1 = dns["DNS1"] ?? dns["PrimaryDNS"] ?? "";
    const dns2 = dns["DNS2"] ?? dns["SecondaryDNS"] ?? "";
    if (!dns1 && !dns2) {
      findings.push({
        id: nextId(),
        severity: "medium",
        title: "No DNS servers configured",
        detail: "The firewall has no DNS servers configured, which may affect name resolution for security services.",
        section: "DNS Configuration",
        confidence: "medium",
      });
    }
  }

  // ── Syslog / logging checks ──

  const syslogRows = getRows(sections, "Syslog Servers");
  if (syslogRows.length === 0 && !sections["Syslog Servers"]) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: "No syslog server configured",
      detail: "Without centralised logging, security events may be lost if the firewall is compromised or logs rotate. Configure an external syslog server.",
      section: "Syslog Servers",
      confidence: "medium",
    });
  }

  // ── Backup checks ──

  const backupDetails = getDetails(sections, "Backup & Restore");
  if (backupDetails.length) {
    const backup = backupDetails[0].fields;
    const schedMode = (backup["Mode"] ?? backup["BackupMode"] ?? backup["ScheduleBackup"] ?? "").toLowerCase();
    if (schedMode === "disable" || schedMode === "off" || schedMode === "manual" || !schedMode) {
      findings.push({
        id: nextId(),
        severity: "medium",
        title: "Automated backups not configured",
        detail: "Without scheduled backups, configuration recovery after failure requires manual reconfiguration. Enable scheduled backups to a remote location.",
        section: "Backup & Restore",
        confidence: "medium",
      });
    }
  }

  // ── VPN checks ──

  const vpnConns = getRows(sections, "IPSec VPN Connections");
  if (vpnConns.length) {
    const weakCrypto = vpnConns.filter((r) => {
      const enc = (r["EncryptionAlgorithm"] ?? r["Encryption"] ?? "").toLowerCase();
      return enc.includes("des") && !enc.includes("3des") && !enc.includes("aes");
    });
    if (weakCrypto.length > 0) {
      findings.push({
        id: nextId(),
        severity: "high",
        title: `${weakCrypto.length} IPSec VPN connection${weakCrypto.length > 1 ? "s" : ""} using weak encryption (DES)`,
        detail: "DES encryption is considered broken. Upgrade to AES-256 or AES-128 at minimum.",
        section: "IPSec VPN Connections",
        confidence: "medium",
      });
    }

    const disabledPfs = vpnConns.filter((r) => {
      const pfs = (r["PFS"] ?? r["PerfectForwardSecrecy"] ?? "").toLowerCase();
      return pfs === "disable" || pfs === "off" || pfs === "no" || pfs === "false";
    });
    if (disabledPfs.length > 0) {
      findings.push({
        id: nextId(),
        severity: "medium",
        title: `${disabledPfs.length} IPSec VPN${disabledPfs.length > 1 ? "s" : ""} without Perfect Forward Secrecy`,
        detail: "PFS ensures that past sessions cannot be decrypted if keys are later compromised. Enable PFS on all VPN connections.",
        section: "IPSec VPN Connections",
        confidence: "medium",
      });
    }
  }

  const sslVpn = getRows(sections, "SSL VPN Policies");
  if (sslVpn.length) {
    const fullTunnel = sslVpn.filter((r) => {
      const policy = (r["PolicyType"] ?? r["Policy"] ?? "").toLowerCase();
      return policy.includes("full") || policy.includes("tunnel");
    });
    if (fullTunnel.length === 0) {
      findings.push({
        id: nextId(),
        severity: "low",
        title: "No full-tunnel SSL VPN policies detected",
        detail: "Split-tunnel VPN allows some traffic to bypass the firewall's security controls. Consider full-tunnel for remote workers.",
        section: "SSL VPN Policies",
        confidence: "low",
      });
    }
  }

  // ── DoS protection ──

  const dosDetails = getDetails(sections, "DoS Protection");
  if (dosDetails.length) {
    const dos = dosDetails[0].fields;
    const synFlood = (dos["SYNFloodProtection"] ?? dos["SynFlood"] ?? dos["Status"] ?? "").toLowerCase();
    if (synFlood === "disable" || synFlood === "off") {
      findings.push({
        id: nextId(),
        severity: "medium",
        title: "SYN flood protection is disabled",
        detail: "SYN flood attacks can exhaust connection state tables. Enable SYN flood protection in DoS settings.",
        section: "DoS Protection",
        confidence: "medium",
      });
    }
  }

  // ── High Availability ──

  const haDetails = getDetails(sections, "High Availability");
  if (haDetails.length === 0 || !sections["High Availability"]) {
    findings.push({
      id: nextId(),
      severity: "low",
      title: "High availability not configured",
      detail: "Without HA, a single firewall failure causes a complete network outage. Consider Active-Passive HA for business continuity.",
      section: "High Availability",
      confidence: "low",
    });
  }

  // ── ATP (Advanced Threat Protection) ──

  const atpDetails = getDetails(sections, "Advanced Threat Protection");
  if (atpDetails.length) {
    const atp = atpDetails[0].fields;
    const atpStatus = (atp["Status"] ?? atp["ATPStatus"] ?? "").toLowerCase();
    if (atpStatus === "disable" || atpStatus === "off") {
      findings.push({
        id: nextId(),
        severity: "high",
        title: "Advanced Threat Protection (ATP) is disabled",
        detail: "ATP provides real-time threat intelligence and botnet/C2 detection. Enable ATP to protect against advanced threats.",
        section: "Advanced Threat Protection",
        confidence: "high",
      });
    }
  }

  // ── Zero Day Protection ──

  const zdDetails = getDetails(sections, "Zero Day Protection");
  if (zdDetails.length) {
    const zd = zdDetails[0].fields;
    const zdStatus = (zd["Status"] ?? zd["SandstormEnabled"] ?? "").toLowerCase();
    if (zdStatus === "disable" || zdStatus === "off" || zdStatus === "false") {
      findings.push({
        id: nextId(),
        severity: "medium",
        title: "Zero Day Protection (Sandstorm) is disabled",
        detail: "Zero Day Protection sends suspicious files to Sophos cloud sandboxing. Enable it for enhanced malware detection.",
        section: "Zero Day Protection",
        confidence: "medium",
      });
    }
  }

  // ── Spoof Prevention ──

  const spoofDetails = getDetails(sections, "Spoof Prevention");
  if (spoofDetails.length) {
    const spoof = spoofDetails[0].fields;
    const spoofStatus = (spoof["Status"] ?? spoof["IPSpoofPrevention"] ?? "").toLowerCase();
    if (spoofStatus === "disable" || spoofStatus === "off") {
      findings.push({
        id: nextId(),
        severity: "medium",
        title: "IP spoof prevention is disabled",
        detail: "IP spoofing allows attackers to masquerade as trusted sources. Enable spoof prevention on all zones.",
        section: "Spoof Prevention",
        confidence: "medium",
      });
    }
  }

  // ── Wireless security ──

  const wirelessRows = getRows(sections, "Wireless Networks");
  if (wirelessRows.length) {
    const weakWifi = wirelessRows.filter((r) => {
      const enc = (r["EncryptionMode"] ?? r["SecurityMode"] ?? r["Encryption"] ?? "").toLowerCase();
      return enc.includes("wep") || enc.includes("wpa ") || (enc.includes("wpa") && !enc.includes("wpa2") && !enc.includes("wpa3"));
    });
    if (weakWifi.length > 0) {
      findings.push({
        id: nextId(),
        severity: "high",
        title: `${weakWifi.length} wireless network${weakWifi.length > 1 ? "s" : ""} using weak encryption (WEP/WPA)`,
        detail: "WEP and WPA are considered insecure. Upgrade all wireless networks to WPA2 or WPA3.",
        section: "Wireless Networks",
        confidence: "medium",
      });
    }
  }

  return { stats, findings, inspectionPosture, ruleColumns: getHeaders(sections, "Firewall Rules") };
}
