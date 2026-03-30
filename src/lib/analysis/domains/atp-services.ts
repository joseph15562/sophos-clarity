/**
 * ATP / MDR / NDR / Security Heartbeat / Synchronized App Control analysis.
 */

import type { ExtractedSections, TableData } from "../../extract-sections";
import type { Finding, AtpStatus } from "../types";
import { findSection, sectionToBlob, extractSectionEnabled } from "../helpers";

export function extractAtpStatus(sections: ExtractedSections): AtpStatus | undefined {
  const atp =
    findSection(sections, /advanced\s*threat\s*protection|^atp$/i) ??
    findSection(sections, /^atp\s*status$/i);
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

      const directStatus = (row["ThreatProtectionStatus"] ?? row["Status"] ?? "").trim();
      if (directStatus) {
        enabled = /enable|on|yes|true/i.test(directStatus);
      }
      const directPolicy = (row["Policy"] ?? row["Action"] ?? "").trim();
      if (directPolicy && !policy) {
        policy = directPolicy;
      }
    }
  }

  for (const detail of atp.details ?? []) {
    const fields = detail.fields ?? {};
    const status = (fields["ThreatProtectionStatus"] ?? fields["Status"] ?? "").trim();
    if (status) enabled = /enable|on|yes|true/i.test(status);
    const p = (fields["Policy"] ?? fields["Action"] ?? "").trim();
    if (p && !policy) policy = p;
  }

  return { enabled, policy };
}

export function analyseATP(sections: ExtractedSections, findings: Finding[], nextId: () => number) {
  const section =
    findSection(sections, /^ATP$/i) ??
    findSection(sections, /^atp\s*status$/i) ??
    findSection(sections, /advanced.?threat.?protect/i);
  if (!section) return;

  let atpEnabled: boolean | null = null;
  let atpPolicy = "";

  for (const t of section.tables) {
    for (const row of t.rows) {
      const directStatus = (row["ThreatProtectionStatus"] ?? row["Status"] ?? "").trim();
      if (directStatus) atpEnabled = /enable|on|yes|true/i.test(directStatus);
      const directPolicy = (row["Policy"] ?? row["Action"] ?? "").trim();
      if (directPolicy) atpPolicy = directPolicy;
    }
  }
  for (const detail of section.details ?? []) {
    const fields = detail.fields ?? {};
    const s = (fields["ThreatProtectionStatus"] ?? fields["Status"] ?? "").trim();
    if (s) atpEnabled = /enable|on|yes|true/i.test(s);
    const p = (fields["Policy"] ?? fields["Action"] ?? "").trim();
    if (p) atpPolicy = p;
  }

  if (atpEnabled === null) {
    const text = section.tables.flatMap((t) => t.rows.map((r) => JSON.stringify(r))).join(" ");
    const statusMatch = text.match(/ThreatProtectionStatus[^}]*?(Enable|Disable)/i)?.[1];
    if (statusMatch) atpEnabled = /enable/i.test(statusMatch);
    if (!atpPolicy) {
      atpPolicy =
        text.match(/Policy[^}]*?[":]?\s*(Log and Drop|Drop|Log only|Monitor|None)/i)?.[1] ?? "";
    }
  }

  if (atpEnabled === false) {
    findings.push({
      id: `f${nextId()}`,
      severity: "high",
      title: "Sophos X-Ops (ATP) threat protection disabled",
      detail:
        "Advanced Threat Protection (Sophos X-Ops) is not enabled. ATP uses Sophos threat intelligence to detect and block communication with known command-and-control servers and malicious IPs.",
      section: "Active Threat Response",
      remediation:
        "Go to Active threat response > Sophos X-Ops threat feeds > Enable threat protection and set the action to 'Log and drop'.",
      confidence: "high",
      evidence: "ATP section: ThreatProtectionStatus set to Disable",
    });
  }

  if (atpPolicy && !/log and drop/i.test(atpPolicy)) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: `Sophos X-Ops (ATP) policy set to "${atpPolicy}" instead of "Log and Drop"`,
      detail: `The ATP/X-Ops policy is set to "${atpPolicy}". Sophos recommends "Log and Drop" to both block malicious traffic and create log entries for investigation.`,
      section: "Active Threat Response",
      remediation:
        "Go to Active threat response > Sophos X-Ops threat feeds > Set the Action to 'Log and drop'.",
      confidence: "high",
      evidence: `ATP section: Policy="${atpPolicy}" (recommended: Log and Drop)`,
    });
  }
}

export function analyseMdrFeed(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section = findSection(sections, /^MDR\s*(Status|Threat)/i);
  if (!section) return;

  const enabled = extractSectionEnabled(section);
  if (enabled === false) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: "MDR threat feed is not active",
      detail:
        "The Managed Detection and Response threat feed is disabled. Enable it to receive real-time threat indicators from Sophos MDR analysts.",
      section: "Active Threat Response",
      remediation:
        "Go to Active threat response > MDR threat feeds. Enable the feed to receive Sophos MDR analyst-curated indicators.",
      confidence: "high",
      evidence: "MDR Status section: Feed disabled",
    });
  }
}

export function analyseNdrEssentials(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section = findSection(sections, /^NDR\s*(Status|Essentials)/i);
  if (!section) return;

  const enabled = extractSectionEnabled(section);
  if (enabled === false) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: "NDR Essentials is not enabled",
      detail:
        "Network Detection and Response Essentials provides encrypted traffic analysis for advanced threat detection. Enable NDR to gain visibility into lateral movement and encrypted traffic anomalies.",
      section: "Active Threat Response",
      remediation:
        "Go to Active threat response > NDR Essentials. Enable NDR and select the interfaces to monitor.",
      confidence: "high",
      evidence: "NDR Status section: NDR Essentials disabled",
    });
  }
}

export function analyseSecurityHeartbeat(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
  rulesTable: TableData | null,
) {
  if (!rulesTable) return;

  const srcHBCol = rulesTable.headers.find((h) => /minimum.*source.*hb/i.test(h));
  const dstHBCol = rulesTable.headers.find((h) => /minimum.*dest.*hb/i.test(h));
  if (!srcHBCol && !dstHBCol) return;

  const enabledWanRules = rulesTable.rows.filter((r) => {
    const status = (r["Status"] ?? "").toLowerCase();
    if (status === "off" || status === "disabled" || status === "0") return false;
    const dstZone = (r["Destination Zone"] ?? r["Destination Zones"] ?? "").toLowerCase();
    const srcZone = (r["Source Zone"] ?? r["Source Zones"] ?? "").toLowerCase();
    return dstZone.includes("wan") || srcZone.includes("wan");
  });

  if (enabledWanRules.length === 0) return;

  const noHeartbeat: string[] = [];
  for (const rule of enabledWanRules) {
    const srcHB = srcHBCol ? (rule[srcHBCol] ?? "").toLowerCase() : "";
    const dstHB = dstHBCol ? (rule[dstHBCol] ?? "").toLowerCase() : "";
    const hasHB =
      (srcHB && srcHB !== "no restriction" && srcHB !== "none" && srcHB !== "") ||
      (dstHB && dstHB !== "no restriction" && dstHB !== "none" && dstHB !== "");
    if (!hasHB) {
      noHeartbeat.push(rule["Rule Name"] ?? "unnamed");
    }
  }

  if (noHeartbeat.length === enabledWanRules.length) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: "Security Heartbeat not configured on any WAN rule",
      detail: `None of the ${enabledWanRules.length} enabled WAN rules enforce a minimum Security Heartbeat health. Compromised endpoints can still access the internet and internal resources.`,
      section: "Synchronized Security",
      remediation:
        "Go to Rules and policies \u203a Firewall rules. Edit each WAN rule and set 'Minimum source HB permitted' to at least 'Green' to block unhealthy endpoints.",
      confidence: "high",
      evidence: `${enabledWanRules.length} WAN rules with no heartbeat restriction`,
    });
  } else if (noHeartbeat.length > 0) {
    findings.push({
      id: `f${nextId()}`,
      severity: "low",
      title: `${noHeartbeat.length} WAN rule${noHeartbeat.length > 1 ? "s" : ""} without Security Heartbeat`,
      detail: `${noHeartbeat.length} of ${enabledWanRules.length} WAN rules do not enforce a minimum heartbeat health: ${noHeartbeat.slice(0, 5).join(", ")}${noHeartbeat.length > 5 ? ` (+${noHeartbeat.length - 5} more)` : ""}.`,
      section: "Synchronized Security",
      remediation:
        "Go to Rules and policies \u203a Firewall rules. Set 'Minimum source HB permitted' to at least 'Green' on all WAN rules.",
      confidence: "medium",
      evidence: `Rules without heartbeat: ${noHeartbeat.slice(0, 3).join(", ")}`,
    });
  }
}

export function analyseSyncAppControl(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section =
    findSection(sections, /^ApplicationClassification$/i) ??
    findSection(sections, /application.?classification$/i);
  if (!section) return;

  const blob = sectionToBlob(section);

  const isExplicitlyDisabled =
    /action[=":,\s]*disable/i.test(blob) ||
    /status[=":,\s]*disable/i.test(blob) ||
    /action[=":,\s]*off/i.test(blob) ||
    /status[=":,\s]*off/i.test(blob);

  if (!isExplicitlyDisabled) return;

  findings.push({
    id: `f${nextId()}`,
    severity: "medium",
    title: "Synchronized Application Control disabled",
    detail:
      "Synchronized Application Control is not enabled. This feature uses Security Heartbeat data from endpoints to identify and classify unknown application traffic.",
    section: "Application Classification",
    remediation:
      "Go to Applications > Synchronized Application Control > Enable the feature. Requires Security Heartbeat and Sophos Endpoint.",
    confidence: "medium",
    evidence: "ApplicationClassification section: ACTION set to Disable",
  });
}
