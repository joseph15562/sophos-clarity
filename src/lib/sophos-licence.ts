/**
 * Sophos Firewall licence tiers, modules, and best-practice scoring.
 *
 * All best-practice checks reference official Sophos documentation:
 *  - https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/
 *  - https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/RuleBestPractice/
 *  - https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/AdministratorHelp/ActiveThreatResponse/ConfigureFeeds/
 *  - https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/AdministratorHelp/SophosCentral/SecurityHeartbeatOverview/
 *  - https://docs.sophos.com/central/customer/help/en-us/LicensingGuide/FirewallLicenses/SFOSLicensingModel/
 */

import type { AnalysisResult, Finding } from "./analyse-config";

/* ------------------------------------------------------------------ */
/*  Module & licence definitions                                      */
/* ------------------------------------------------------------------ */

export type ModuleId =
  | "networkProtection"
  | "webProtection"
  | "zeroDayProtection"
  | "centralOrchestration"
  | "dnsProtection";

export interface ModuleInfo {
  id: ModuleId;
  label: string;
  description: string;
  features: string[];
}

export const MODULES: Record<ModuleId, ModuleInfo> = {
  networkProtection: {
    id: "networkProtection",
    label: "Network Protection",
    description: "IPS, Sophos X-Ops threat feeds, SD-RED management, Security Heartbeat",
    features: [
      "Intrusion Prevention System (IPS)",
      "Sophos X-Ops Threat Feeds",
      "SD-RED Device Management",
      "Security Heartbeat (Synchronized Security)",
    ],
  },
  webProtection: {
    id: "webProtection",
    label: "Web Protection",
    description: "Web security & control, application control, web malware protection",
    features: [
      "Web Security & Control",
      "Application Control",
      "Synchronized Application Control",
      "Web Malware Protection",
    ],
  },
  zeroDayProtection: {
    id: "zeroDayProtection",
    label: "Zero-Day Protection",
    description: "Machine learning, sandboxing file analysis, threat intelligence",
    features: [
      "Machine Learning Analysis",
      "Sandboxing File Analysis",
      "Threat Intelligence",
    ],
  },
  centralOrchestration: {
    id: "centralOrchestration",
    label: "Central Orchestration",
    description: "SD-WAN VPN orchestration, advanced reporting",
    features: [
      "SD-WAN VPN Orchestration",
      "Advanced Central Reporting",
    ],
  },
  dnsProtection: {
    id: "dnsProtection",
    label: "DNS Protection",
    description: "Cloud-based DNS filtering via Sophos Central",
    features: [
      "Cloud DNS Filtering",
      "DNS Security Policies",
    ],
  },
};

export type LicenceTier = "standard" | "xstream" | "individual";

export interface LicenceSelection {
  tier: LicenceTier;
  /** Only used when tier === "individual" */
  modules: ModuleId[];
}

export function getActiveModules(sel: LicenceSelection): ModuleId[] {
  if (sel.tier === "standard") return ["networkProtection", "webProtection"];
  if (sel.tier === "xstream")
    return ["networkProtection", "webProtection", "zeroDayProtection", "centralOrchestration", "dnsProtection"];
  return sel.modules;
}

/* ------------------------------------------------------------------ */
/*  Best-practice check definitions                                   */
/* ------------------------------------------------------------------ */

export type CheckStatus = "pass" | "fail" | "warn" | "na";

export interface BestPracticeCheck {
  id: string;
  category: string;
  title: string;
  /** What the Sophos docs say to do */
  recommendation: string;
  /** Official doc URL */
  reference: string;
  /** Which module this check requires (null = base/always) */
  requiredModule: ModuleId | null;
  weight: number;
  evaluate: (r: AnalysisResult) => { status: CheckStatus; detail: string };
}

function findingMatches(findings: Finding[], pattern: RegExp): Finding[] {
  return findings.filter((f) => pattern.test(f.title));
}

export const BEST_PRACTICE_CHECKS: BestPracticeCheck[] = [
  /* ---------- Base / Always ---------- */
  {
    id: "bp-admin-wan",
    category: "Device Hardening",
    title: "Admin services not exposed to WAN",
    recommendation: "Disable HTTPS and SSH admin access on the WAN zone. Use Sophos Central for remote management.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 10,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /admin console|ssh accessible|management service.*exposed/i);
      return hits.length === 0
        ? { status: "pass", detail: "No admin services exposed to untrusted zones" }
        : { status: "fail", detail: `${hits.length} admin service(s) exposed — disable WAN access and use Sophos Central` };
    },
  },
  {
    id: "bp-mfa",
    category: "Device Hardening",
    title: "MFA enabled for all administrators & portals",
    recommendation: "Turn on MFA for all administrators, VPN portal, and user portal to protect against stolen credentials.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 10,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /MFA|OTP|multi.?factor/i);
      return hits.length === 0
        ? { status: "pass", detail: "MFA/OTP enabled across all detected portals" }
        : { status: "fail", detail: `${hits.length} portal(s) without MFA — enable OTP in Authentication > MFA` };
    },
  },
  {
    id: "bp-logging",
    category: "Visibility & Monitoring",
    title: "Logging enabled on all firewall rules",
    recommendation: "Enable traffic logging on every firewall rule to generate log and report data for compliance and forensics.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/RuleBestPractice/",
    requiredModule: null,
    weight: 8,
    evaluate: (r) => {
      const hit = findingMatches(r.findings, /logging disabled/i);
      if (hit.length === 0) return { status: "pass", detail: "All rules have logging enabled" };
      const count = parseInt(hit[0].title.match(/\d+/)?.[0] ?? "1");
      return { status: "fail", detail: `${count} rule(s) with logging disabled — enable in each rule's Logging section` };
    },
  },
  {
    id: "bp-ssl-tls",
    category: "Encryption & Inspection",
    title: "SSL/TLS inspection (DPI) active on WAN traffic",
    recommendation: "Create SSL/TLS Decrypt rules covering all source zones with WAN-bound firewall rules for full encrypted traffic visibility.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/AdministratorHelp/RulesAndPolicies/SSL/TLSInspectionRules/",
    requiredModule: null,
    weight: 10,
    evaluate: (r) => {
      if (r.inspectionPosture.totalWanRules === 0) return { status: "na", detail: "No WAN rules detected" };
      if (!r.inspectionPosture.dpiEngineEnabled)
        return { status: "fail", detail: "No SSL/TLS Decrypt rules — DPI is completely inactive" };
      if (r.inspectionPosture.sslUncoveredZones.length > 0)
        return { status: "warn", detail: `Decrypt rules exist but zones ${r.inspectionPosture.sslUncoveredZones.join(", ")} are uncovered` };
      return { status: "pass", detail: `${r.inspectionPosture.sslDecryptRules} Decrypt rule(s) covering all WAN-bound zones` };
    },
  },
  {
    id: "bp-snmp",
    category: "Device Hardening",
    title: "SNMP not exposed to untrusted zones",
    recommendation: "Disable SNMP access from WAN. If SNMP monitoring is required, restrict to LAN/management zone with SNMPv3.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 5,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /snmp exposed/i);
      return hits.length === 0
        ? { status: "pass", detail: "SNMP not exposed to untrusted zones" }
        : { status: "fail", detail: "SNMP accessible from WAN — restrict to management zone" };
    },
  },
  {
    id: "bp-any-service",
    category: "Rule Hygiene",
    title: 'Avoid "ANY" service in firewall rules',
    recommendation: "Use specific services instead of ANY to reduce the attack surface. ANY allows all ports and protocols.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/RuleBestPractice/",
    requiredModule: null,
    weight: 6,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /"ANY" service/i);
      return hits.length === 0
        ? { status: "pass", detail: "No rules with ANY service detected" }
        : { status: "warn", detail: `Rules using ANY service — narrow to specific services for defence-in-depth` };
    },
  },
  {
    id: "bp-disabled-rules",
    category: "Rule Hygiene",
    title: "Remove or review disabled firewall rules",
    recommendation: "Disabled rules clutter the policy and may indicate abandoned configuration. Review and remove unused rules.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/RuleBestPractice/",
    requiredModule: null,
    weight: 4,
    evaluate: (r) => {
      const d = r.inspectionPosture.disabledWanRules + r.inspectionPosture.totalDisabledRules;
      if (d === 0) return { status: "pass", detail: "No disabled rules found" };
      if (d <= 2) return { status: "warn", detail: `${d} disabled rule(s) — review if still needed` };
      return { status: "fail", detail: `${d} disabled rules — remove abandoned rules to reduce policy complexity` };
    },
  },
  {
    id: "bp-broad-rules",
    category: "Rule Hygiene",
    title: "Avoid overly broad source/destination rules",
    recommendation: "Rules with 'Any' source and 'Any' destination bypass network segmentation. Use specific zones and networks.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/RuleBestPractice/",
    requiredModule: null,
    weight: 6,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /broad source/i);
      return hits.length === 0
        ? { status: "pass", detail: "No overly broad rules detected" }
        : { status: "warn", detail: `Broad Any→Any rules found — tighten source/dest for network segmentation` };
    },
  },

  /* ---------- Network Protection ---------- */
  {
    id: "bp-ips",
    category: "Network Protection",
    title: "IPS policy applied to all WAN rules",
    recommendation: "Apply an IPS policy to every firewall rule governing traffic to/from WAN for intrusion detection and prevention.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/RuleBestPractice/",
    requiredModule: "networkProtection",
    weight: 10,
    evaluate: (r) => {
      const { withIps, enabledWanRules } = r.inspectionPosture;
      if (enabledWanRules === 0) return { status: "na", detail: "No enabled WAN rules" };
      if (withIps >= enabledWanRules)
        return { status: "pass", detail: `IPS applied on all ${enabledWanRules} enabled WAN rule(s)` };
      const missing = enabledWanRules - withIps;
      return { status: "fail", detail: `${missing} of ${enabledWanRules} enabled WAN rule(s) missing IPS` };
    },
  },
  {
    id: "bp-xops-feeds",
    category: "Active Threat Response",
    title: "Sophos X-Ops threat feeds enabled (Log & Drop)",
    recommendation: "Enable X-Ops threat feeds in Active threat response with 'Log and drop' to block known-bad IPs/domains/URLs automatically.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/AdministratorHelp/ActiveThreatResponse/ConfigureFeeds/ActiveThreatResponseSophosXOpsThreatFeeds/",
    requiredModule: "networkProtection",
    weight: 8,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /x.ops|threat feed/i);
      if (hits.length > 0)
        return { status: "fail", detail: "X-Ops threat feeds not detected — enable under Active threat response" };
      return { status: "warn", detail: "Cannot verify from config export — ensure X-Ops feeds are enabled with 'Log and drop' in Active threat response" };
    },
  },
  {
    id: "bp-heartbeat",
    category: "Synchronized Security",
    title: "Security Heartbeat configured",
    recommendation: "Register the firewall with Sophos Central and enable Security Heartbeat to isolate compromised endpoints automatically.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/AdministratorHelp/SophosCentral/SecurityHeartbeatOverview/",
    requiredModule: "networkProtection",
    weight: 7,
    evaluate: () => {
      return { status: "warn", detail: "Security Heartbeat status not in config export — verify in Sophos Central > Firewall Management" };
    },
  },
  {
    id: "bp-mdr-feeds",
    category: "Active Threat Response",
    title: "MDR threat feeds enabled",
    recommendation: "If you have Sophos MDR, enable MDR threat feeds to receive analyst-curated threat intelligence pushed directly to the firewall.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/AdministratorHelp/ActiveThreatResponse/ConfigureFeeds/MDRThreatFeeds/",
    requiredModule: "networkProtection",
    weight: 6,
    evaluate: () => {
      return { status: "warn", detail: "MDR feed status not in config export — verify under Active threat response if MDR licence is active" };
    },
  },
  {
    id: "bp-ndr",
    category: "Active Threat Response",
    title: "NDR Essentials enabled for encrypted traffic analysis",
    recommendation: "Enable NDR Essentials so the firewall sends TLS metadata and DNS queries to Sophos Cloud for AI-based threat detection without full decryption.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/AdministratorHelp/ActiveThreatResponse/ConfigureFeeds/NDREssentials/",
    requiredModule: "networkProtection",
    weight: 7,
    evaluate: () => {
      return { status: "warn", detail: "NDR Essentials status not in config export — enable under Active threat response > NDR Essentials" };
    },
  },

  /* ---------- Web Protection ---------- */
  {
    id: "bp-webfilter",
    category: "Web Protection",
    title: "Web filtering on all WAN rules (HTTP/HTTPS/ANY)",
    recommendation: "Apply a web filter policy on every WAN-bound rule with HTTP, HTTPS, or ANY service to block malicious and non-compliant websites.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/RuleBestPractice/",
    requiredModule: "webProtection",
    weight: 10,
    evaluate: (r) => {
      const { withWebFilter, webFilterableRules } = r.inspectionPosture;
      if (webFilterableRules === 0) return { status: "na", detail: "No filterable WAN rules (HTTP/HTTPS/ANY)" };
      if (withWebFilter >= webFilterableRules)
        return { status: "pass", detail: `Web filtering on all ${webFilterableRules} applicable WAN rule(s)` };
      const missing = webFilterableRules - withWebFilter;
      return { status: "fail", detail: `${missing} of ${webFilterableRules} WAN rule(s) missing web filter policy` };
    },
  },
  {
    id: "bp-appcontrol",
    category: "Web Protection",
    title: "Application control on WAN rules",
    recommendation: "Apply application control policies to WAN-bound rules to identify and control application traffic (social media, P2P, etc.).",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/RuleBestPractice/",
    requiredModule: "webProtection",
    weight: 8,
    evaluate: (r) => {
      const { withAppControl, enabledWanRules } = r.inspectionPosture;
      if (enabledWanRules === 0) return { status: "na", detail: "No enabled WAN rules" };
      if (withAppControl >= enabledWanRules)
        return { status: "pass", detail: `App control on all ${enabledWanRules} enabled WAN rule(s)` };
      const missing = enabledWanRules - withAppControl;
      return { status: "fail", detail: `${missing} of ${enabledWanRules} enabled WAN rule(s) without app control` };
    },
  },
  {
    id: "bp-highrisk-categories",
    category: "Web Protection",
    title: "High-risk web categories blocked",
    recommendation: "Block high-risk web categories (malware, phishing, C&C) in all web filter policies.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/RuleBestPractice/",
    requiredModule: "webProtection",
    weight: 6,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /high-risk categor/i);
      return hits.length === 0
        ? { status: "pass", detail: "No high-risk category gaps detected" }
        : { status: "fail", detail: "Web filter policy allows high-risk categories — block malware, phishing, and C&C sites" };
    },
  },

  /* ---------- Zero-Day Protection ---------- */
  {
    id: "bp-sandboxing",
    category: "Zero-Day Protection",
    title: "Sandboxing / zero-day file analysis enabled",
    recommendation: "Enable Sophos Sandstorm for cloud-based sandboxing of suspicious files to detect zero-day malware.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/22.0/help/en-us/webhelp/onlinehelp/AdministratorHelp/ZeroDayProtection/ZeroDayProtectionSettings/",
    requiredModule: "zeroDayProtection",
    weight: 9,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /sandboxing|zero-day/i);
      return hits.length === 0
        ? { status: "pass", detail: "Sandboxing / zero-day protection is active" }
        : { status: "fail", detail: "Sandboxing not enabled — enable under Protection > Zero-day protection" };
    },
  },
  {
    id: "bp-av-scanning",
    category: "Zero-Day Protection",
    title: "Virus scanning enabled for all protocols",
    recommendation: "Enable AV scanning for HTTP, HTTPS, FTP, SMTP, POP3, and IMAP in the DPI engine.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/RuleBestPractice/",
    requiredModule: "zeroDayProtection",
    weight: 7,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /virus scanning/i);
      return hits.length === 0
        ? { status: "pass", detail: "AV scanning enabled across protocols" }
        : { status: "fail", detail: "Virus scanning disabled on one or more protocols" };
    },
  },

  /* ---------- Central Orchestration ---------- */
  {
    id: "bp-central-mgmt",
    category: "Central Orchestration",
    title: "Firewall managed via Sophos Central",
    recommendation: "Register with Sophos Central for centralised management, reporting, and firmware updates.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: "centralOrchestration",
    weight: 6,
    evaluate: () => {
      return { status: "warn", detail: "Central management status not in config export — verify in Sophos Central" };
    },
  },

  /* ---------- DNS Protection ---------- */
  {
    id: "bp-dns-protection",
    category: "DNS Protection",
    title: "DNS Protection configured",
    recommendation: "Configure Sophos DNS Protection IPs as the firewall's upstream DNS servers to filter malicious domains at the DNS layer.",
    reference: "https://docs.sophos.com/central/customer/help/en-us/ManageYourProducts/DNSProtection/NetworkSetup/ConfigureSophosFirewallToUseDNSProtection/",
    requiredModule: "dnsProtection",
    weight: 8,
    evaluate: () => {
      return { status: "warn", detail: "DNS Protection config not in export — verify DNS servers point to Sophos DNS IPs in Network > DNS" };
    },
  },

  /* ---------- Active Threat Response ---------- */
  {
    id: "bp-xops-atp",
    category: "Active Threat Response",
    title: "Sophos X-Ops (ATP) enabled with Log and Drop",
    recommendation: "Enable Advanced Threat Protection (Sophos X-Ops threat feeds) and set the action to 'Log and Drop' to block C&C traffic.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/AdministratorHelp/ActiveThreatResponse/ATRSophosXOps/",
    requiredModule: "networkProtection",
    weight: 9,
    evaluate: (r) => {
      const disabled = findingMatches(r.findings, /x-ops.*disabled|atp.*disabled/i);
      const wrongPolicy = findingMatches(r.findings, /x-ops.*policy|atp.*policy/i);
      if (disabled.length > 0)
        return { status: "fail", detail: "Sophos X-Ops (ATP) threat protection is disabled" };
      if (wrongPolicy.length > 0)
        return { status: "warn", detail: wrongPolicy[0].detail };
      return { status: "pass", detail: "Sophos X-Ops (ATP) is enabled with recommended action" };
    },
  },

  /* ---------- Sophos Health Check items (CIS / Recommended) ---------- */
  {
    id: "bp-password-complexity",
    category: "Device Hardening",
    title: "Password complexity enforced",
    recommendation: "Enable password complexity with minimum length 10, alphabetic, numeric, and special characters.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 8,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /password complexity/i);
      return hits.length === 0
        ? { status: "pass", detail: "Password complexity requirements are enforced" }
        : { status: "fail", detail: "Password complexity not enabled — weak passwords increase brute-force risk" };
    },
  },
  {
    id: "bp-login-lockout",
    category: "Device Hardening",
    title: "Brute-force login protection enabled",
    recommendation: "Enable login lockout after 5 failed attempts to prevent brute-force attacks against the admin console.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 8,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /brute.?force|login.*lockout/i);
      return hits.length === 0
        ? { status: "pass", detail: "Login brute-force protection is active" }
        : { status: "fail", detail: "Login lockout disabled — unlimited password attempts possible" };
    },
  },
  {
    id: "bp-login-disclaimer",
    category: "Device Hardening",
    title: "Login disclaimer enabled",
    recommendation: "Enable a login disclaimer banner to provide a legal warning before authentication (CIS requirement).",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 4,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /login disclaimer/i);
      return hits.length === 0
        ? { status: "pass", detail: "Login disclaimer is enabled" }
        : { status: "fail", detail: "No login disclaimer — add a legal warning banner for CIS/ISO compliance" };
    },
  },
  {
    id: "bp-hotfix",
    category: "Device Hardening",
    title: "Automatic hotfix installation enabled",
    recommendation: "Enable automatic hotfix installation so critical security patches are applied between firmware releases.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 9,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /hotfix/i);
      return hits.length === 0
        ? { status: "pass", detail: "Automatic hotfix installation is enabled" }
        : { status: "fail", detail: "Hotfix auto-install disabled — critical security patches will not be applied automatically" };
    },
  },
  {
    id: "bp-pattern-update",
    category: "Device Hardening",
    title: "Pattern auto-update enabled",
    recommendation: "Enable automatic pattern/signature updates at least every 2 hours for IPS, AV, and application control.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 9,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /pattern auto.?update/i);
      return hits.length === 0
        ? { status: "pass", detail: "Pattern auto-update is enabled" }
        : { status: "fail", detail: "Pattern updates disabled — IPS/AV signatures will become stale" };
    },
  },
  {
    id: "bp-backup",
    category: "Visibility & Monitoring",
    title: "Automated backups scheduled",
    recommendation: "Schedule automated backups (daily or weekly) to email or Sophos Central for disaster recovery.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 5,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /backup.*not scheduled|automated backup/i);
      return hits.length === 0
        ? { status: "pass", detail: "Automated backups are configured" }
        : { status: "fail", detail: "No scheduled backups — configure daily/weekly backups for disaster recovery" };
    },
  },
  {
    id: "bp-notification",
    category: "Visibility & Monitoring",
    title: "Notification emails configured",
    recommendation: "Configure email notifications for security events so administrators are alerted to threats and system issues.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 4,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /notification email/i);
      return hits.length === 0
        ? { status: "pass", detail: "Notification email server is configured" }
        : { status: "fail", detail: "No notification email — security alerts will not reach administrators" };
    },
  },
  {
    id: "bp-ntp",
    category: "Device Hardening",
    title: "NTP time synchronisation configured",
    recommendation: "Enable NTP for accurate time on logs, certificates, and forensic analysis.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 4,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /ntp.*not configured/i);
      return hits.length === 0
        ? { status: "pass", detail: "NTP time synchronisation is active" }
        : { status: "fail", detail: "NTP not configured — inaccurate time breaks log correlation and certificates" };
    },
  },
  {
    id: "bp-auth-encryption",
    category: "Device Hardening",
    title: "Authentication server connections encrypted",
    recommendation: "Use SSL (LDAPS port 636) or STARTTLS for all LDAP/AD authentication servers to protect credentials in transit.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/",
    requiredModule: null,
    weight: 7,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /authentication server.*unencrypted/i);
      return hits.length === 0
        ? { status: "pass", detail: "All authentication servers use encrypted connections" }
        : { status: "fail", detail: `${hits[0].detail}` };
    },
  },
  {
    id: "bp-sync-app-control",
    category: "Synchronized Security",
    title: "Synchronized Application Control enabled",
    recommendation: "Enable Synchronized Application Control to identify unknown application traffic using endpoint heartbeat data.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/AdministratorHelp/SophosCentral/SecurityHeartbeatOverview/",
    requiredModule: "networkProtection",
    weight: 5,
    evaluate: (r) => {
      const hits = findingMatches(r.findings, /synchronized application control/i);
      return hits.length === 0
        ? { status: "pass", detail: "Synchronized Application Control is enabled" }
        : { status: "fail", detail: "Synchronized App Control disabled — unknown apps won't be identified via heartbeat" };
    },
  },

  /* ---------- High Availability ---------- */
  {
    id: "bp-ha-configured",
    category: "Resilience",
    title: "High Availability (HA) configured",
    recommendation: "Deploy a secondary Sophos firewall in HA active-passive or active-active mode for hardware redundancy.",
    reference: "https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/AdministratorHelp/SystemServices/HighAvailability/",
    requiredModule: null,
    weight: 6,
    evaluate: (r) => {
      const haInfo = findingMatches(r.findings, /ha configured|high availability/i);
      const noHA = findingMatches(r.findings, /no high availability/i);
      if (noHA.length > 0)
        return { status: "warn", detail: "No HA configuration detected — single point of failure" };
      if (haInfo.length > 0)
        return { status: "pass", detail: haInfo[0].detail };
      return { status: "unknown", detail: "HA configuration could not be determined from the export" };
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Scoring engine                                                    */
/* ------------------------------------------------------------------ */

export interface BPCheckResult {
  check: BestPracticeCheck;
  status: CheckStatus;
  detail: string;
  applicable: boolean;
}

export interface SophosBPScore {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  passed: number;
  failed: number;
  warnings: number;
  notApplicable: number;
  total: number;
  results: BPCheckResult[];
}

export function computeSophosBPScore(
  analysisResult: AnalysisResult,
  licence: LicenceSelection,
): SophosBPScore {
  const activeModules = getActiveModules(licence);

  const results: BPCheckResult[] = BEST_PRACTICE_CHECKS.map((check) => {
    const applicable = check.requiredModule === null || activeModules.includes(check.requiredModule);
    if (!applicable) {
      return { check, status: "na" as CheckStatus, detail: `Requires ${MODULES[check.requiredModule!].label} module`, applicable: false };
    }
    const { status, detail } = check.evaluate(analysisResult);
    return { check, status, detail, applicable: true };
  });

  const applicableResults = results.filter((r) => r.applicable && r.status !== "na");
  const passed = applicableResults.filter((r) => r.status === "pass").length;
  const failed = applicableResults.filter((r) => r.status === "fail").length;
  const warnings = applicableResults.filter((r) => r.status === "warn").length;

  let totalWeight = 0;
  let earnedWeight = 0;
  for (const r of results) {
    if (!r.applicable || r.status === "na") continue;
    totalWeight += r.check.weight;
    if (r.status === "pass") earnedWeight += r.check.weight;
    else if (r.status === "warn") earnedWeight += r.check.weight * 0.5;
  }

  const overall = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  const grade: SophosBPScore["grade"] =
    overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";

  return {
    overall,
    grade,
    passed,
    failed,
    warnings,
    notApplicable: results.filter((r) => !r.applicable || r.status === "na").length,
    total: results.length,
    results,
  };
}
