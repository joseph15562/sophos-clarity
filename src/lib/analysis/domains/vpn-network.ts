/**
 * VPN, DoS, syslog, wireless, SNMP, DNS, RED — domain module for analyse-config.
 */

import type { ExtractedSections, SectionData } from "../../extract-sections";
import type { AnalyseOptions, Finding } from "../types";
import { findSection, sectionToBlob } from "../helpers";

/** VPN Security — check IPSec profiles for weak encryption and SSL VPN config */
export function analyseVpnSecurity(
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
export function analyseDoSProtection(
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
export function analyseSyslogServers(
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
export function analyseWirelessSecurity(
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
export function analyseSnmpCommunity(
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
export function analyseDnsSecurity(
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
export function analyseRedSecurity(
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
