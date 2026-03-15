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
