/**
 * Web filter and local service ACL analysis — domain module for analyse-config.
 */

import type { ExtractedSections } from "../types";
import type { Finding } from "../types";
import { findSection } from "../helpers";

/** Admin Access Exposure — flag management services accessible from untrusted zones */
export function analyseLocalServiceAcl(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const acl = findSection(sections, /local\s*service\s*acl|device\s*access|admin\s*service/i);
  if (!acl) return;

  const SENSITIVE_SERVICES = /https|ssh|admin|webadmin|gui|snmp|api|telnet/i;
  const UNTRUSTED_ZONES = /wan|any|dmz|guest|untrust|external|public/i;

  const exposed: { service: string; zones: string }[] = [];
  for (const t of acl.tables) {
    for (const row of t.rows) {
      const service =
        row["Service"] ?? row["Name"] ?? row["Service Name"] ?? Object.values(row)[0] ?? "";
      if (!SENSITIVE_SERVICES.test(service)) continue;

      for (const [key, val] of Object.entries(row)) {
        if (key === "Service" || key === "Name" || key === "Service Name") continue;
        const v = val.toLowerCase().trim();
        if (
          v === "enable" ||
          v === "enabled" ||
          v === "on" ||
          v === "yes" ||
          v === "allow" ||
          v === "✓" ||
          v.includes("✓")
        ) {
          if (UNTRUSTED_ZONES.test(key)) {
            exposed.push({ service, zones: key });
          }
        }
      }
    }
  }

  if (exposed.length > 0) {
    const sshWan = exposed.filter((e) => /ssh|telnet/i.test(e.service) && /wan/i.test(e.zones));
    const adminWan = exposed.filter(
      (e) => /https|admin|gui|webadmin|api/i.test(e.service) && /wan/i.test(e.zones),
    );
    const snmpExposed = exposed.filter((e) => /snmp/i.test(e.service));

    if (adminWan.length > 0) {
      findings.push({
        id: `f${nextId()}`,
        severity: "critical",
        title: "Admin console accessible from WAN",
        detail: `Management service${adminWan.length > 1 ? "s" : ""} (${adminWan.map((e) => e.service).join(", ")}) ${adminWan.length > 1 ? "are" : "is"} enabled on the WAN zone. This exposes the firewall admin interface to the internet, allowing brute-force and exploitation attempts.`,
        section: "Local Service ACL",
        remediation:
          "Go to Administration > Device access. Disable HTTPS/Admin access for the WAN zone. If remote admin access is required, use an IPsec or SSL VPN tunnel instead, or restrict to specific IP addresses using the ACL exception list.",
        confidence: "high",
        evidence: `HTTPS/Admin enabled on WAN zone in Local Service ACL: ${adminWan.map((e) => e.service).join(", ")}`,
      });
    }
    if (sshWan.length > 0) {
      findings.push({
        id: `f${nextId()}`,
        severity: "critical",
        title: "SSH accessible from WAN",
        detail: `SSH is enabled on the WAN zone. This allows remote command-line access from the internet — a high-value target for attackers using credential stuffing and exploit attacks.`,
        section: "Local Service ACL",
        remediation:
          "Go to Administration > Device access. Disable SSH for the WAN zone. Use VPN for remote CLI access. If SSH must remain, restrict to specific IP addresses and ensure MFA is enabled.",
        confidence: "high",
        evidence: "SSH enabled on WAN zone in Local Service ACL",
      });
    }
    if (snmpExposed.length > 0) {
      findings.push({
        id: `f${nextId()}`,
        severity: "high",
        title: `SNMP exposed to ${snmpExposed.map((e) => e.zones).join(", ")}`,
        detail: `SNMP is enabled on ${snmpExposed.map((e) => e.zones).join(", ")}. SNMP (especially v1/v2c) leaks device information and can be used for reconnaissance. If v3 is not enforced, community strings are sent in cleartext.`,
        section: "Local Service ACL",
        remediation:
          "Go to Administration > Device access. Disable SNMP on untrusted zones. If monitoring is needed, use SNMPv3 with authentication and encryption, and restrict to management VLANs only.",
        confidence: "high",
        evidence: `SNMP enabled on ${snmpExposed.map((e) => e.zones).join(", ")} in Local Service ACL`,
      });
    }

    const otherExposed = exposed.filter(
      (e) => !adminWan.includes(e) && !sshWan.includes(e) && !snmpExposed.includes(e),
    );
    if (otherExposed.length > 0) {
      findings.push({
        id: `f${nextId()}`,
        severity: "medium",
        title: `${otherExposed.length} management service${otherExposed.length > 1 ? "s" : ""} exposed to untrusted zones`,
        detail: `Services exposed: ${otherExposed.map((e) => `${e.service} (${e.zones})`).join(", ")}. Minimise the attack surface by restricting management access to trusted zones only.`,
        section: "Local Service ACL",
        remediation:
          "Go to Administration > Device access. Review each service and disable access from untrusted zones (WAN, DMZ, Guest). Only LAN and dedicated management zones should have admin access.",
        confidence: "high",
        evidence: `Local Service ACL: ${otherExposed
          .slice(0, 3)
          .map((e) => `${e.service}(${e.zones})`)
          .join(", ")}`,
      });
    }
  }
}

/** Web Filter Policy Deep Dive */
export function analyseWebFilterPolicies(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const wfSection = findSection(sections, /web\s*filter\s*polic/i);
  if (!wfSection) return;

  const RISKY_CATEGORIES =
    /proxy|vpn|anonymi|p2p|peer|torrent|malware|phish|spyware|botnet|crypto\s*min/i;
  const riskyAllowed: string[] = [];

  for (const t of wfSection.tables) {
    for (const row of t.rows) {
      for (const [key, val] of Object.entries(row)) {
        if (RISKY_CATEGORIES.test(key) || RISKY_CATEGORIES.test(val)) {
          const action = (val ?? "").toLowerCase().trim();
          if (
            action === "allow" ||
            action === "permitted" ||
            action === "warn" ||
            action === "enabled"
          ) {
            riskyAllowed.push(key);
          }
        }
      }
    }
  }

  if (riskyAllowed.length > 0) {
    findings.push({
      id: `f${nextId()}`,
      severity: "high",
      title: `Web filter policy allows ${riskyAllowed.length} high-risk categor${riskyAllowed.length > 1 ? "ies" : "y"}`,
      detail: `High-risk web categories are not blocked: ${riskyAllowed.slice(0, 6).join(", ")}${riskyAllowed.length > 6 ? ` (+${riskyAllowed.length - 6} more)` : ""}. Proxy/VPN categories can bypass security controls; malware categories should always be blocked.`,
      section: "Web Filter Policies",
      remediation:
        "Go to Web > Policies. Edit the active policy and set high-risk categories (Proxy/VPN, Anonymizers, P2P, Malware, Phishing) to 'Block'. Consider 'Warn' for grey-area categories like social media.",
      confidence: "high",
      evidence: `Web filter policy: ${riskyAllowed.slice(0, 4).join(", ")} set to Allow`,
    });
  }
}
