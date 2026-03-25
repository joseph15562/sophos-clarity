/**
 * IPS and virus scanning analysis — domain module for analyse-config.
 */

import type { ExtractedSections } from "../../extract-sections";
import type { Finding } from "../types";
import { findSection } from "../helpers";

/** IPS Policy Deep Dive */
export function analyseIpsPolicies(
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
export function analyseVirusScanning(
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
