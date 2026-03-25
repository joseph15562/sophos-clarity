/**
 * Pure predicates and helpers for firewall rule row analysis.
 * Extracted from analyse-config.ts for reuse and testability.
 */

import type { TableData } from "./types";

export function isWanDest(row: Record<string, string>): boolean {
  const dz = (
    row["Destination Zones"] ??
    row["Destination Zone"] ??
    row["Dest Zone"] ??
    row["DestZone"] ??
    row["Dest zone"] ??
    row["Destination zone"] ??
    row["DstZone"] ??
    row["Destination"] ??
    ""
  )
    .toLowerCase()
    .trim();
  return dz === "wan" || dz.includes("wan");
}

export function isWebService(row: Record<string, string>): boolean {
  const svc = (
    row["Service"] ??
    row["Services"] ??
    row["Services/Ports"] ??
    row["service"] ??
    row["Services Used"] ??
    ""
  )
    .toLowerCase()
    .trim();
  if (!svc) return false;
  const nonWebOnly =
    /^(dns|ntp|smtp|smtps|snmp|syslog|ldap|ldaps|radius|ssh|telnet|icmp|ping|ftp|sip|imap|imaps|pop3|pop3s|bgp|ospf|rip|dhcp|tftp|kerberos|nfs|smb|cifs|ipsec|gre|l2tp|pptp|netbios)$/i;
  if (nonWebOnly.test(svc)) return false;
  if (svc === "any") return true;
  if (svc.includes("http")) return true;
  if (svc.includes("web")) return true;
  if (/\b(80|443|8080|8443)\b/.test(svc)) return true;
  return false;
}

export function getWebFilterPolicyDisplayName(row: Record<string, string>): string {
  return (
    row["Web Filter"] ??
    row["Web Filter Policy"] ??
    row["WebFilter"] ??
    row["Web Policy"] ??
    row["Web Filtering"] ??
    row["Content Filter"] ??
    row["Web filter"] ??
    ""
  ).trim();
}

export function hasWebFilter(row: Record<string, string>): boolean {
  const wf = getWebFilterPolicyDisplayName(row).toLowerCase();
  return wf !== "" && wf !== "none" && wf !== "not specified" && wf !== "-" && wf !== "n/a";
}

export function isAllowAllWebPolicy(policyRaw: string): boolean {
  const n = policyRaw.toLowerCase().replace(/\s+/g, " ").trim();
  if (!n || n === "none" || n === "not specified" || n === "-" || n === "n/a") return false;
  if (n === "allow all" || n === "permit all" || n === "allowall" || n === "permitall") return true;
  if (/^allow all\b/.test(n) || /^permit all\b/.test(n)) return true;
  return false;
}

export function isLoggingOff(row: Record<string, string>): boolean {
  const log = (row["Log"] ?? row["Log Traffic"] ?? row["Logging"] ?? row["logging"] ?? "")
    .toLowerCase()
    .trim();
  return log === "disabled" || log === "off" || log === "disable" || log === "no";
}

export function isRuleDisabled(row: Record<string, string>): boolean {
  const status = (row["Status"] ?? row["Rule Status"] ?? row["Enabled"] ?? row["Active"] ?? "")
    .toLowerCase()
    .trim();
  if (status.includes("off") || status.includes("disable") || status.includes("inactive"))
    return true;
  if (status === "no" || status === "false" || status === "0") return true;
  return false;
}

export function isAnyService(row: Record<string, string>): boolean {
  const svc = (row["Service"] ?? row["Services"] ?? row["Services/Ports"] ?? row["service"] ?? "")
    .toLowerCase()
    .trim();
  return svc === "any";
}

export function isBroadSource(row: Record<string, string>): boolean {
  const raw = row["Source Networks"] ?? row["Source"] ?? row["Src Networks"];
  if (raw === undefined) return false;
  const src = raw.toLowerCase().trim();
  return src === "any";
}

export function isBroadDest(row: Record<string, string>): boolean {
  const raw = row["Destination Networks"] ?? row["Destination"] ?? row["Dest Networks"];
  if (raw === undefined) return false;
  const dst = raw.toLowerCase().trim();
  return dst === "any";
}

export function ruleName(row: Record<string, string>): string {
  return row["Rule Name"] ?? row["Name"] ?? row["Rule"] ?? row["#"] ?? "Unnamed";
}

export function hasAppControl(row: Record<string, string>): boolean {
  const ac = (
    row["Application Control"] ??
    row["App Control"] ??
    row["AppControl"] ??
    row["Application Filter"] ??
    row["Application filter"] ??
    row["App Filter"] ??
    ""
  )
    .toLowerCase()
    .trim();
  return ac !== "" && ac !== "none" && ac !== "not specified" && ac !== "-" && ac !== "n/a";
}

export function hasIps(row: Record<string, string>): boolean {
  const ips = (
    row["IPS"] ??
    row["Intrusion Prevention"] ??
    row["IPS Policy"] ??
    row["IPS policy"] ??
    row["Intrusion prevention"] ??
    ""
  )
    .toLowerCase()
    .trim();
  return (
    ips !== "" &&
    ips !== "none" &&
    ips !== "not specified" &&
    ips !== "-" &&
    !ips.includes("disable") &&
    ips !== "off" &&
    ips !== "n/a"
  );
}

function normalizeMultiValue(val: string): string {
  const normed = val
    .split(/[,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(",");
  return normed === "any" || normed === "" ? "*" : normed;
}

export function ruleSignature(row: Record<string, string>): string {
  const src = normalizeMultiValue(
    (row["Source Networks"] ?? row["Source"] ?? row["Src Networks"] ?? "").toLowerCase(),
  );
  const dst = normalizeMultiValue(
    (row["Destination Networks"] ?? row["Destination"] ?? row["Dest Networks"] ?? "").toLowerCase(),
  );
  const svc = normalizeMultiValue(
    (
      row["Service"] ??
      row["Services"] ??
      row["Services/Ports"] ??
      row["service"] ??
      ""
    ).toLowerCase(),
  );
  const srcZ = normalizeMultiValue(
    (row["Source Zone"] ?? row["Source Zones"] ?? row["Src Zone"] ?? "").toLowerCase(),
  );
  const dstZ = normalizeMultiValue(
    (
      row["Destination Zone"] ??
      row["Destination Zones"] ??
      row["Dest Zone"] ??
      row["DestZone"] ??
      ""
    ).toLowerCase(),
  );
  return `${srcZ}|${src}|${dstZ}|${dst}|${svc}`;
}

export function isSubsetOrEqual(specific: string, broad: string): boolean {
  if (broad.toLowerCase() === "any") return true;
  return specific.toLowerCase() === broad.toLowerCase();
}
