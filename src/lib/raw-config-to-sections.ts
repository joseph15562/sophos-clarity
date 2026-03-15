/**
 * Converts raw_config JSON (from the connector agent) into the same
 * ExtractedSections format that the HTML Config Viewer parser produces.
 *
 * This allows all existing widgets, analysis, reports, and visualisations
 * to work identically whether data came from a manual HTML upload or
 * the connector pulling via the Sophos XML API.
 */

import type { ExtractedSections, SectionData, TableData, DetailBlock } from "./extract-sections";

const SECTION_MAP: Record<string, string> = {
  FirewallRule: "Firewall Rules",
  FirewallRuleGroup: "Firewall Rule Groups",
  NATRule: "NAT Rules",
  Zone: "Zones",
  LocalServiceACL: "Local Service ACL",
  IPHost: "Networks",
  IPHostGroup: "Network Groups",
  FQDNHost: "FQDN Hosts",
  FQDNHostGroup: "FQDN Host Groups",
  CountryGroup: "Country Groups",
  Services: "Services",
  ServiceGroup: "Service Groups",
  Interface: "Interfaces & Ports",
  VLAN: "VLANs",
  Alias: "Interface Aliases",
  WebFilterPolicy: "Web Filters",
  WebFilterSettings: "Web Filter Settings",
  WebFilterAdvancedSettings: "Web Filter Advanced Settings",
  WebFilterCategory: "Web Filter Categories",
  WebFilterException: "Web Filter Exceptions",
  WebFilterURLGroup: "Web Filter URL Groups",
  IPSPolicy: "Intrusion Prevention",
  IPSSwitch: "IPS Engine Settings",
  SSLTLSInspectionRule: "SSL/TLS Inspection Rules",
  SSLTLSInspectionSettings: "SSL/TLS Settings",
  DecryptionProfile: "Decryption Profiles",
  ApplicationFilterPolicy: "Application Filter Policies",
  ApplicationFilterCategory: "Application Filter Categories",
  AVPolicy: "Virus Scanning",
  MalwareProtection: "Malware Protection",
  ZeroDayProtectionSettings: "Zero Day Protection",
  AntiSpamRules: "Anti-Spam Rules",
  VPNIPSecConnection: "IPSec VPN Connections",
  VPNProfile: "VPN Profiles",
  SSLVPNPolicy: "SSL VPN Policies",
  SSLTunnelAccessSettings: "SSL VPN Tunnel Access",
  SophosConnectClient: "Sophos Connect Client",
  SDWANPolicyRoute: "SD-WAN Routes",
  GatewayConfiguration: "Gateway Configuration",
  QoSPolicy: "QoS Policies",
  AdminSettings: "Admin Settings",
  AdministrationProfile: "Admin Profiles",
  OTPSettings: "OTP / MFA Settings",
  SecurityGroup: "Groups",
  UserGroup: "User Groups",
  AuthenticationServer: "Authentication Servers",
  DNS: "DNS Configuration",
  DNSRequestRoute: "DNS Request Routes",
  DHCPServer: "DHCP Servers",
  SyslogServers: "Syslog Servers",
  SNMPAgentConfiguration: "SNMP Agent Config",
  BackupRestore: "Backup & Restore",
  DoSSettings: "DoS Protection",
  SpoofPrevention: "Spoof Prevention",
  ProtocolSecurity: "Protocol Security",
  Certificate: "Certificates",
  WirelessNetworks: "Wireless Networks",
  WirelessProtectionGlobalSettings: "Wireless Settings",
  RED: "RED Configuration",
  HAConfigure: "High Availability",
  ATP: "Advanced Threat Protection",
  SophosXOpsThreatFeeds: "ATP Status",
  MDRThreatFeed: "MDR Status",
  NDREssentials: "NDR Status",
  ThirdPartyThreatFeed: "Third-party Feeds",
  Notification: "Notifications",
  Time: "Time Settings",
  Schedule: "Schedules",
  DataTransferPolicy: "Data Transfer Policies",
  WAFSlowHTTP: "WAF Slow HTTP",
  WAFTLS: "WAF TLS Settings",
};

function asString(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function extractNested(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[p];
  }
  if (Array.isArray(current)) return current.map(asString).join(", ");
  return asString(current);
}

function flattenObject(obj: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  if (obj == null || typeof obj !== "object") return result;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key.startsWith("@_")) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, path));
    } else {
      result[path] = asString(value);
    }
  }
  return result;
}

function buildFirewallRuleTable(entities: Record<string, unknown>[]): TableData {
  const headers = [
    "Rule Name", "Status", "Action", "Source Zone", "Destination Zone",
    "Service", "Web Filter", "IPS Policy", "Log", "Description",
  ];
  const rows = entities.map((e) => ({
    "Rule Name": asString(e.Name),
    "Status": asString(e.Status),
    "Action": extractNested(e, "NetworkPolicy.Action"),
    "Source Zone": extractNested(e, "NetworkPolicy.SourceZones.Zone"),
    "Destination Zone": extractNested(e, "NetworkPolicy.DestinationZones.Zone"),
    "Service": extractNested(e, "NetworkPolicy.Services.Service"),
    "Web Filter": extractNested(e, "SecurityPolicy.WebFilter"),
    "IPS Policy": extractNested(e, "SecurityPolicy.IPSPolicy"),
    "Log": extractNested(e, "NetworkPolicy.LogTraffic"),
    "Description": asString(e.Description ?? ""),
  }));
  return { headers, rows };
}

function buildNatRuleTable(entities: Record<string, unknown>[]): TableData {
  const headers = [
    "Rule Name", "Status", "Rule Type",
    "Original Source", "Original Destination",
    "Translated Source", "Translated Destination",
  ];
  const rows = entities.map((e) => ({
    "Rule Name": asString(e.RuleName ?? e.Name),
    "Status": asString(e.Status),
    "Rule Type": asString(e.NATPolicy ?? "DNAT"),
    "Original Source": extractNested(e, "OriginalSource.NetworkAddress"),
    "Original Destination": extractNested(e, "OriginalDestination.NetworkAddress"),
    "Translated Source": extractNested(e, "TranslatedSource.NetworkAddress"),
    "Translated Destination": extractNested(e, "TranslatedDestination.NetworkAddress"),
  }));
  return { headers, rows };
}

function buildGenericTable(entities: Record<string, unknown>[]): TableData {
  if (!entities.length) return { headers: [], rows: [] };
  const first = entities[0];
  const headers = Object.keys(first).filter(
    (k) => !k.startsWith("@_") && typeof first[k] !== "object"
  );
  const rows = entities.map((e) => {
    const row: Record<string, string> = {};
    for (const h of headers) row[h] = asString(e[h]);
    return row;
  });
  return { headers, rows };
}

/**
 * Convert a raw_config object (keyed by Sophos entity type) into
 * ExtractedSections compatible with all existing web app analysis.
 */
export function rawConfigToSections(
  rawConfig: Record<string, unknown>
): ExtractedSections {
  const sections: ExtractedSections = {};

  for (const [entityType, data] of Object.entries(rawConfig)) {
    if (!data) continue;
    const entities: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : [data as Record<string, unknown>];
    if (entities.length === 0) continue;

    const sectionName = SECTION_MAP[entityType] ?? entityType;

    let table: TableData;
    if (entityType === "FirewallRule") {
      table = buildFirewallRuleTable(entities);
    } else if (entityType === "NATRule") {
      table = buildNatRuleTable(entities);
    } else {
      table = buildGenericTable(entities);
    }

    const details: DetailBlock[] = entities.map((e) => ({
      title: asString(e.Name ?? e.RuleName ?? e.Description ?? sectionName),
      fields: flattenObject(e),
    }));

    sections[sectionName] = {
      tables: [table],
      text: "",
      details,
    };
  }

  return sections;
}
