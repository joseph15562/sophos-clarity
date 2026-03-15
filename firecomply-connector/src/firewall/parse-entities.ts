import { XMLParser } from "fast-xml-parser";
import type { EntityResult } from "./export-config";

export interface TableData {
  headers: string[];
  rows: Record<string, string>[];
}

export interface DetailBlock {
  title: string;
  fields: Record<string, string>;
}

export interface SectionData {
  tables: TableData[];
  text: string;
  details: DetailBlock[];
}

export interface ExtractedSections {
  [sectionName: string]: SectionData;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name, jpath) => jpath === `Response.${name}`,
});

const FIREWALL_RULE_FIELDS: [string, string][] = [
  ["Name", "Rule Name"],
  ["Status", "Status"],
  ["Description", "Description"],
  ["PolicyType", "Policy Type"],
  ["Position", "Position"],
];

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

function policyField(e: any, field: string): string {
  return extractNested(e, `NetworkPolicy.${field}`) ||
         extractNested(e, `UserPolicy.${field}`) || "";
}

function parseFirewallRules(entities: unknown[]): TableData {
  const headers = [
    "Rule Name", "Status", "Policy Type", "Action", "Source Zone", "Destination Zone",
    "Service", "Web Filter", "IPS Policy", "Application Control", "Log", "Description",
  ];

  const rows: Record<string, string>[] = entities.map((e: any) => ({
    "Rule Name": asString(e.Name),
    "Status": asString(e.Status),
    "Policy Type": asString(e.PolicyType ?? ""),
    "Action": policyField(e, "Action"),
    "Source Zone": policyField(e, "SourceZones.Zone"),
    "Destination Zone": policyField(e, "DestinationZones.Zone"),
    "Service": policyField(e, "Services.Service") || extractNested(e, "NetworkPolicy.Services.Service"),
    "Web Filter": policyField(e, "WebFilter") || extractNested(e, "SecurityPolicy.WebFilter"),
    "IPS Policy": policyField(e, "IntrusionPrevention") || extractNested(e, "SecurityPolicy.IPSPolicy"),
    "Application Control": policyField(e, "ApplicationControl") || "",
    "Log": policyField(e, "LogTraffic"),
    "Description": asString(e.Description ?? ""),
  }));

  return { headers, rows };
}

function parseNatRules(entities: unknown[]): TableData {
  const headers = ["Rule Name", "Status", "Rule Type", "Original Source", "Original Destination", "Translated Source", "Translated Destination"];
  const rows = entities.map((e: any) => ({
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

function parseGenericEntities(entities: unknown[], _entityType: string): TableData {
  if (!entities.length) return { headers: [], rows: [] };
  const first = entities[0] as Record<string, unknown>;
  const headers = Object.keys(first).filter((k) => !k.startsWith("@_") && typeof first[k] !== "object");
  const rows = entities.map((e: any) => {
    const row: Record<string, string> = {};
    for (const h of headers) row[h] = asString(e[h]);
    return row;
  });
  return { headers, rows };
}

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

/**
 * Convert XML API entity results into the ExtractedSections format
 * expected by analyseConfig().
 */
export function parseEntityResults(results: EntityResult[]): ExtractedSections {
  const sections: ExtractedSections = {};

  for (const result of results) {
    if (!result.success || !result.xml) continue;

    try {
      const parsed = parser.parse(result.xml);
      const response = parsed?.Response;
      if (!response) continue;

      let entities = response[result.entityType];
      if (!entities) continue;
      if (!Array.isArray(entities)) entities = [entities];
      if (entities.length === 0) continue;

      const sectionName = SECTION_MAP[result.entityType] ?? result.entityType;

      let table: TableData;
      if (result.entityType === "FirewallRule") {
        table = parseFirewallRules(entities);
      } else if (result.entityType === "NATRule") {
        table = parseNatRules(entities);
      } else {
        table = parseGenericEntities(entities, result.entityType);
      }

      sections[sectionName] = {
        tables: [table],
        text: "",
        details: entities.map((e: any) => ({
          title: asString(e.Name ?? e.RuleName ?? e.Description ?? sectionName),
          fields: flattenObject(e),
        })),
      };
    } catch (err) {
      console.warn(`[parse-entities] Failed to parse ${result.entityType}:`, err);
    }
  }

  return sections;
}

/**
 * Build a raw config map from entity results: { entityType: parsedJSON }
 * This gives the server a complete picture of the firewall config.
 */
export function buildRawConfig(results: EntityResult[]): Record<string, unknown> {
  const raw: Record<string, unknown> = {};

  for (const result of results) {
    if (!result.success || !result.xml) continue;
    try {
      const parsed = parser.parse(result.xml);
      const response = parsed?.Response;
      if (!response) continue;
      let entities = response[result.entityType];
      if (!entities) continue;
      if (!Array.isArray(entities)) entities = [entities];
      if (entities.length === 0) continue;
      raw[result.entityType] = entities;
    } catch {
      // skip unparseable
    }
  }

  return raw;
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
