/**
 * Admin settings, backup, notifications, OTP, and admin profiles — domain module for analyse-config.
 */

import type { ExtractedSections, Finding } from "../types";
import { findSection, sectionToBlob } from "../helpers";
import { findOtpSection } from "../section-meta";

export function analyseAdminSettings(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section =
    findSection(sections, /^AdminSettings$/i) ?? findSection(sections, /admin.?settings/i);
  if (!section) return;

  const text =
    section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") +
    " " +
    (section.text ?? "");

  // Password complexity
  if (
    /PasswordComplexityCheck/i.test(text) &&
    !/enable/i.test(text.match(/PasswordComplexityCheck[^}]*?(Enable|Disable)/i)?.[1] ?? "")
  ) {
    findings.push({
      id: `f${nextId()}`,
      severity: "high",
      title: "Password complexity not enabled",
      detail:
        "Password complexity requirements are not enforced. Weak passwords increase brute-force risk.",
      section: "Admin Settings",
      remediation:
        "Go to Administration > Admin and user settings > Enable Password complexity check with minimum length 10+, alphabetic, numeric, and special characters.",
      confidence: "high",
      evidence: "Admin Settings: PasswordComplexityCheck not set to Enable",
    });
  }

  // Login lockout / brute force protection
  const blockLogin = text.match(/BlockLogin[^}]*?(Enable|Disable)/i)?.[1];
  if (blockLogin && !/enable/i.test(blockLogin)) {
    findings.push({
      id: `f${nextId()}`,
      severity: "high",
      title: "Login brute-force protection disabled",
      detail:
        "Login lockout after failed attempts is not enabled. Attackers can attempt unlimited password guesses.",
      section: "Admin Settings",
      remediation:
        "Go to Administration > Admin and user settings > Enable 'Block login' with a maximum of 5 unsuccessful attempts and a lockout duration.",
      confidence: "high",
      evidence: "Admin Settings: BlockLogin set to Disable",
    });
  }

  // Login disclaimer
  const disclaimer =
    text.match(/LoginDisclaimer[^}]*?(Enable|Disable)/i)?.[1] ??
    text.match(/Disclaimer[^}]*?Status[^}]*?(Enable|Disable)/i)?.[1];
  if (disclaimer && !/enable/i.test(disclaimer)) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: "Login disclaimer not enabled",
      detail:
        "A login disclaimer provides a legal warning banner before authentication. Required by many compliance frameworks (CIS, ISO 27001).",
      section: "Admin Settings",
      remediation:
        "Go to Administration > Admin settings > Enable Login disclaimer and configure an appropriate legal notice.",
      confidence: "high",
      evidence: "Admin Settings: LoginDisclaimer set to Disable",
    });
  }
}

export function analyseBackupRestore(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section = findSection(sections, /^BackupRestore$/i) ?? findSection(sections, /backup/i);
  if (!section) return;

  const blob = sectionToBlob(section).toLowerCase();

  // Look for evidence of scheduled backup being configured:
  // - A frequency value that isn't "never" (daily, weekly, monthly)
  // - A backup mode that indicates active backup (email, ftp, local)
  const hasScheduledFreq = /(?:frequency|backupfrequency)[=":,\s]*(daily|weekly|monthly)/i.test(
    blob,
  );
  const hasActiveMode = /(?:mode|backupmode)[=":,\s]*(email|ftp)/i.test(blob);

  if (hasScheduledFreq || hasActiveMode) return;

  findings.push({
    id: `f${nextId()}`,
    severity: "medium",
    title: "Automated backups not scheduled",
    detail:
      "No scheduled backup configuration detected. Without regular backups, configuration recovery after failure is at risk.",
    section: "Backup & Restore",
    remediation:
      "Go to System services > Backup & firmware > Schedule automated backups (daily or weekly). Send to email or Sophos Central.",
    confidence: "medium",
    evidence: "Backup section: BackupFrequency not found or set to Never",
  });
}

export function analyseNotificationSettings(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section =
    findSection(sections, /^Notification$/i) ?? findSection(sections, /^Notificationlist$/i);
  if (!section) return;

  const text =
    section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") +
    " " +
    (section.text ?? "");

  const hasServer =
    /NotificationServer[^}]*?Enable/i.test(text) || /MailServer[^}]*?smtp/i.test(text);
  if (!hasServer) {
    findings.push({
      id: `f${nextId()}`,
      severity: "low",
      title: "Notification email not configured",
      detail:
        "No notification email server is configured. Security events and system alerts will not be sent to administrators.",
      section: "Notification Settings",
      remediation:
        "Go to Administration > Notification settings > Configure an SMTP server and recipient email for security alerts.",
      confidence: "medium",
      evidence: "Notification section: No NotificationServer/MailServer enabled or SMTP configured",
    });
  }
}

export function analysePatternDownload(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section = findSection(sections, /^PatternDownload$/i) ?? findSection(sections, /pattern/i);
  if (!section) return;

  const text =
    section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") +
    " " +
    (section.text ?? "");

  const autoUpdate = text.match(/AutoUpdate[^}]*?(Enable|Disable)/i)?.[1];
  if (autoUpdate && !/enable/i.test(autoUpdate)) {
    findings.push({
      id: `f${nextId()}`,
      severity: "high",
      title: "Pattern auto-update disabled",
      detail:
        "Automatic pattern/signature downloads are disabled. IPS, AV, and application control signatures will become stale, reducing protection against new threats.",
      section: "Pattern Downloads",
      remediation:
        "Go to Administration > Updates > Enable automatic pattern updates. Set interval to at least every 2 hours.",
      confidence: "high",
      evidence: "PatternDownload section: AutoUpdate set to Disable",
    });
  }
}

export function analyseTimeSettings(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section = findSection(sections, /^Time$/i);
  if (!section) return;

  const text =
    section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") +
    " " +
    (section.text ?? "");

  const ntp =
    text.match(/PredefinedNTPServer[^}]*?(Enable|Disable)/i)?.[1] ??
    text.match(/NTP[^}]*?(Enable|Disable)/i)?.[1];
  if (ntp && !/enable/i.test(ntp)) {
    findings.push({
      id: `f${nextId()}`,
      severity: "low",
      title: "NTP server not configured",
      detail:
        "No NTP time synchronisation is configured. Accurate time is essential for log correlation, certificate validation, and forensic analysis.",
      section: "Time Settings",
      remediation:
        "Go to Administration > Time > Enable NTP and select a predefined or custom NTP server.",
      confidence: "high",
      evidence: "Time section: PredefinedNTPServer/NTP set to Disable",
    });
  }
}

export function analyseAuthServers(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section =
    findSection(sections, /^AuthenticationServer$/i) ??
    findSection(sections, /^authentication\s*servers?$/i) ??
    findSection(sections, /authentication.?server/i);
  if (!section) return;

  const UNENC_VALUES = /^(simple|plain|plaintext|none|unencrypted|no|disable|disabled|off|0)$/i;
  const unencrypted: string[] = [];

  // Check each server from details (API path) or table rows (HTML path)
  const details = section.details ?? [];
  if (details.length > 0) {
    for (const d of details) {
      const fields = d.fields ?? {};
      const name = fields["ServerName"] ?? fields["Name"] ?? d.title ?? "Unknown";
      const blob = Object.entries(fields)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")
        .toLowerCase();

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
      const hasUnencValue =
        isPlainCs || /encryption[=\s]*(plain|simple|none|plaintext|disable)/i.test(blob);
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
          row["Connection Security"] ??
          row["ConnectionSecurity"] ??
          row["Encryption"] ??
          ""
        ).trim();
        if (name && security && UNENC_VALUES.test(security)) {
          unencrypted.push(name);
        }
      }
    }
  }

  if (unencrypted.length > 0) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: `${unencrypted.length} authentication server(s) using unencrypted connection`,
      detail: `The following auth servers use plain/unencrypted LDAP: ${unencrypted.join(", ")}. Credentials sent in cleartext can be intercepted.`,
      section: "Authentication Servers",
      remediation:
        "Go to Authentication > Servers > Change Connection Security to SSL (LDAPS port 636) or STARTTLS for each server.",
      confidence: "high",
      evidence: `Auth servers ${unencrypted.slice(0, 3).join(", ")} have ConnectionSecurity=simple/plain/none or Port=389`,
    });
  }
}

export function analyseHotfix(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section = findSection(sections, /^Hotfix$/i);
  if (!section) return;

  const text =
    section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ") +
    " " +
    (section.text ?? "");

  const enabled = /AllowAutoInstallOfHotFixes[^}]*?Enable/i.test(text) || /Enabled/i.test(text);
  if (!enabled) {
    findings.push({
      id: `f${nextId()}`,
      severity: "high",
      title: "Automatic hotfix installation disabled",
      detail:
        "Automatic hotfix installation is not enabled. Security patches between firmware updates address critical vulnerabilities and must be applied promptly.",
      section: "Hotfix Settings",
      remediation:
        "Go to Administration > Updates > Enable 'Allow automatic installation of hotfixes'. Sophos pushes critical security patches through this mechanism.",
      confidence: "medium",
      evidence: "Hotfix section: AllowAutoInstallOfHotFixes not enabled",
    });
  }
}

/* ------------------------------------------------------------------ */
/*  MFA / OTP Analysis                                                 */
/* ------------------------------------------------------------------ */

const OTP_SERVICE_KEYS: Record<string, string> = {
  webadminconsole: "Web admin console",
  webadmin: "Web admin console",
  otpwebadmin: "Web admin console",
  userportal: "User portal",
  otpuserportal: "User portal",
  vpnportal: "VPN portal",
  otpvpnportal: "VPN portal",
  sslvpn: "SSL VPN remote access",
  sslvpnremoteaccess: "SSL VPN remote access",
  otpsslvpn: "SSL VPN remote access",
  ipsecremoteaccess: "IPsec remote access",
  ipsec: "IPsec remote access",
  otpipsec: "IPsec remote access",
  webapplicationfirewall: "Web application firewall",
};

export function analyseOtpSettings(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const otpSection = findOtpSection(sections);
  if (!otpSection) return;

  const kv = new Map<string, string>();
  for (const table of otpSection.tables) {
    for (const row of table.rows) {
      const setting = row["Setting"] ?? row["setting"];
      const value = row["Value"] ?? row["value"];
      if (setting && value) {
        kv.set(setting.replace(/[\s_-]/g, "").toLowerCase(), value.trim());
      } else {
        for (const [k, v] of Object.entries(row)) {
          kv.set(k.replace(/[\s_-]/g, "").toLowerCase(), (v ?? "").trim());
        }
      }
    }
  }
  for (const detail of otpSection.details ?? []) {
    for (const [k, v] of Object.entries(detail.fields ?? {})) {
      kv.set(k.replace(/[\s_-]/g, "").toLowerCase(), (v ?? "").trim());
    }
  }

  const otpMode = (
    kv.get("otp") ??
    kv.get("onetimepassword") ??
    kv.get("otpmode") ??
    kv.get("status") ??
    ""
  )
    .toLowerCase()
    .replace(/[\s_-]/g, "");

  if (otpMode.includes("nootp") || otpMode === "disabled" || otpMode === "off") {
    findings.push({
      id: `f${nextId()}`,
      severity: "critical",
      title: "MFA/OTP is completely disabled",
      detail:
        "One-time passwords (MFA) are not enabled for any users. All admin, portal, and VPN access lacks multi-factor authentication, making credential theft attacks trivially exploitable.",
      section: "Authentication & OTP",
      remediation:
        "Go to Authentication \u203a Multi-factor authentication. Set One-time password to 'All users'. Enable MFA for: Web admin console, User portal, VPN portal, SSL VPN, IPsec remote access.",
      confidence: "high",
      evidence: "OTP setting: No OTP / Disabled",
    });
    return;
  }

  if (otpMode.includes("specific")) {
    const otpUsers =
      kv.get("otpusersandgroups") ??
      kv.get("otpusersgroups") ??
      kv.get("otprequiredforthese") ??
      kv.get("otprequiredfortheseusersandgroups") ??
      "";
    const userList = otpUsers
      .split(/[,;\n]/)
      .map((u) => u.trim())
      .filter(Boolean);
    const nonApiUsers = userList.filter((u) => !/\bapi\b/i.test(u));

    if (nonApiUsers.length > 0) {
      findings.push({
        id: `f${nextId()}`,
        severity: "medium",
        title: "MFA/OTP not enforced for all users",
        detail: `OTP is set to 'Specific users and groups' rather than 'All users'. ${nonApiUsers.length} non-API user${nonApiUsers.length > 1 ? "s/groups" : "/group"} configured: ${nonApiUsers.slice(0, 5).join(", ")}${nonApiUsers.length > 5 ? ` (+${nonApiUsers.length - 5} more)` : ""}. New users may not be covered.`,
        section: "Authentication & OTP",
        remediation:
          "Go to Authentication \u203a Multi-factor authentication. Change One-time password from 'Specific users and groups' to 'All users' to ensure every account requires MFA by default.",
        confidence: "high",
        evidence: `OTP mode: Specific users and groups (${nonApiUsers.length} non-API entries)`,
      });
    }
  }

  const disabledServices: string[] = [];
  for (const [key, label] of Object.entries(OTP_SERVICE_KEYS)) {
    const val = (kv.get(key) ?? "").toLowerCase();
    if (!val) continue;
    if (
      val === "disable" ||
      val === "disabled" ||
      val === "off" ||
      val === "no" ||
      val === "false"
    ) {
      if (!disabledServices.includes(label)) disabledServices.push(label);
    }
  }
  if (disabledServices.length > 0) {
    findings.push({
      id: `f${nextId()}`,
      severity: "high",
      title: `MFA not required for ${disabledServices.length} service${disabledServices.length > 1 ? "s" : ""}`,
      detail: `Multi-factor authentication is not enforced for: ${disabledServices.join(", ")}. These services can be accessed with password-only authentication.`,
      section: "Authentication & OTP",
      remediation: `Go to Authentication \u203a Multi-factor authentication. Under 'Require MFA for', tick: ${disabledServices.join(", ")}.`,
      confidence: "high",
      evidence: `MFA disabled services: ${disabledServices.join(", ")}`,
    });
  }

  const hashAlgo = (kv.get("hashalgorithm") ?? kv.get("otphashalgorithm") ?? "").toUpperCase();
  if (hashAlgo && hashAlgo.includes("SHA1") && !hashAlgo.includes("SHA1[0-9]")) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: "OTP hash algorithm uses SHA1",
      detail:
        "The OTP hash algorithm is set to SHA1, which has known collision weaknesses. SHA256 or SHA512 provides stronger TOTP codes and better future-proofing.",
      section: "Authentication & OTP",
      remediation:
        "Go to Authentication \u203a Multi-factor authentication. Change 'OTP hash algorithm' from SHA1 to SHA256 or SHA512. Note: existing OTP tokens will need to be re-enrolled.",
      confidence: "medium",
      evidence: `OTP hash algorithm: ${hashAlgo}`,
    });
  }
}

/** Admin Authentication & Profiles — check for overly permissive admin roles.
 *  Ignores Sophos factory-default profiles that ship on every XGS. */
const SOPHOS_DEFAULT_PROFILES = new Set([
  "super admin",
  "audit admin",
  "crypto admin",
  "security admin",
  "network admin",
  "superadmin",
  "auditadmin",
  "cryptoadmin",
  "securityadmin",
  "networkadmin",
]);

export function analyseAdminProfiles(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const profileSection = findSection(sections, /admin.*profile|administration\s*profile/i);
  if (!profileSection) return;

  let fullAccessCount = 0;
  for (const t of profileSection.tables) {
    for (const row of t.rows) {
      const name = (row["Name"] ?? row["Profile Name"] ?? row["Profile"] ?? "")
        .toLowerCase()
        .trim();
      if (SOPHOS_DEFAULT_PROFILES.has(name)) continue;
      const allValues = Object.values(row).map((v) => v.toLowerCase());
      const readWriteCount = allValues.filter(
        (v) => v === "readwrite" || v === "read-write" || v === "full",
      ).length;
      if (readWriteCount > 10) fullAccessCount++;
    }
  }

  if (fullAccessCount > 1) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: `${fullAccessCount} custom admin profiles with full access permissions`,
      detail: `${fullAccessCount} custom administration profiles grant full read-write access to all firewall features. Follow least-privilege principles — create role-specific profiles (e.g. read-only, network-admin, security-admin).`,
      section: "Admin Security",
      remediation:
        "Go to Administration > Device access > Administration profiles. Create role-specific profiles with minimum required permissions rather than granting full access to multiple profiles.",
      confidence: "medium",
      evidence: `${fullAccessCount} custom admin profiles have ReadWrite on 10+ feature areas`,
    });
  }
}
