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
         extractNested(e, `UserPolicy.${field}`) ||
         extractNested(e, `SecurityPolicy.${field}`) || "";
}

function isSystemRule(e: Record<string, unknown>): boolean {
  const name = asString(e.Name ?? "").toLowerCase();
  return name.startsWith("#") || name.startsWith("auto added");
}

function parseFirewallRules(entities: unknown[]): TableData {
  const headers = [
    "#", "Rule Name", "Status", "Policy Type", "Action",
    "Source Zone", "Source Zones", "Destination Zone", "Destination Zones",
    "Source Networks", "Destination Networks",
    "Service", "Web Filter", "IPS Policy", "IPS",
    "Intrusion Prevention", "Application Control",
    "Match Known Users", "Identity",
    "Log", "Log Traffic", "Description",
    "Minimum Source HB Permitted", "Minimum Destination HB Permitted",
  ];

  const rows: Record<string, string>[] = entities.map((e: any, i: number) => {
    const srcZone = policyField(e, "SourceZones.Zone");
    const dstZone = policyField(e, "DestinationZones.Zone");
    const service = policyField(e, "Services.Service");
    const webFilter = policyField(e, "WebFilter");
    const ips = policyField(e, "IntrusionPrevention");
    const appCtrl = policyField(e, "ApplicationControl");
    const logTraffic = policyField(e, "LogTraffic");
    const srcNetworks = policyField(e, "SourceNetworks.Network");
    const dstNetworks = policyField(e, "DestinationNetworks.Network");
    const matchIdentity = asString(e.MatchIdentity ?? policyField(e, "MatchIdentity") ?? "");
    const identity = extractNested(e, "Identity.Member") || asString(e.Identity ?? "");
    const srcHB = policyField(e, "MinimumSourceHBPermitted") || asString(e.MinimumSourceHBPermitted ?? "");
    const dstHB = policyField(e, "MinimumDestinationHBPermitted") || asString(e.MinimumDestinationHBPermitted ?? "");

    return {
      "#": String(i + 1),
      "Rule Name": asString(e.Name),
      "Status": asString(e.Status),
      "Policy Type": asString(e.PolicyType ?? ""),
      "Action": policyField(e, "Action"),
      "Source Zone": srcZone || "Any",
      "Source Zones": srcZone || "Any",
      "Destination Zone": dstZone || "Any",
      "Destination Zones": dstZone || "Any",
      "Source Networks": srcNetworks || "Any",
      "Destination Networks": dstNetworks || "Any",
      "Service": service || "Any",
      "Web Filter": webFilter || "None",
      "IPS Policy": ips || "None",
      "IPS": ips || "None",
      "Intrusion Prevention": ips || "None",
      "Application Control": appCtrl || "None",
      "Match Known Users": matchIdentity || "Disabled",
      "Identity": identity || "N/A",
      "Log": logTraffic,
      "Log Traffic": logTraffic,
      "Description": asString(e.Description ?? ""),
      "Minimum Source HB Permitted": srcHB,
      "Minimum Destination HB Permitted": dstHB,
    };
  });

  return { headers, rows };
}

function parseNatRules(entities: unknown[]): TableData {
  const headers = [
    "Rule Name", "Status", "Rule Type",
    "Original Source", "Original Destination",
    "Translated Source", "Translated Destination",
    "Source Networks", "Destination Networks",
    "Source", "Destination",
  ];
  const rows = entities.map((e: any) => {
    const origSrc = extractNested(e, "OriginalSource.NetworkAddress") ||
                    extractNested(e, "OriginalSource.Network") || "Any";
    const origDst = extractNested(e, "OriginalDestination.NetworkAddress") ||
                    extractNested(e, "OriginalDestination.Network") || "Any";
    const transSrc = extractNested(e, "TranslatedSource.NetworkAddress") ||
                     extractNested(e, "TranslatedSource.Network") || "";
    const transDst = extractNested(e, "TranslatedDestination.NetworkAddress") ||
                     extractNested(e, "TranslatedDestination.Network") || "";
    return {
      "Rule Name": asString(e.RuleName ?? e.Name),
      "Status": asString(e.Status),
      "Rule Type": asString(e.NATPolicy ?? "DNAT"),
      "Original Source": origSrc,
      "Original Destination": origDst,
      "Translated Source": transSrc,
      "Translated Destination": transDst,
      "Source Networks": origSrc,
      "Destination Networks": origDst,
      "Source": origSrc,
      "Destination": origDst,
    };
  });
  return { headers, rows };
}

function parseSslTlsRules(entities: unknown[]): TableData {
  const headers = [
    "Name", "Rule Name", "Status", "Decrypt Action", "Action",
    "Source Zone", "Source Zones", "Destination Zone", "Destination Zones",
    "Source Networks", "Destination Networks", "Service", "Decryption Profile",
  ];
  const rows = entities.map((e: any) => {
    const action = asString(e.DecryptAction ?? e.Action ?? "");
    const srcZone = extractNested(e, "SourceZones.Zone");
    const dstZone = extractNested(e, "DestinationZones.Zone");
    return {
      "Name": asString(e.Name),
      "Rule Name": asString(e.Name),
      "Status": asString(e.Enable ?? e.Status ?? ""),
      "Decrypt Action": action,
      "Action": action,
      "Source Zone": srcZone,
      "Source Zones": srcZone,
      "Destination Zone": dstZone,
      "Destination Zones": dstZone,
      "Source Networks": extractNested(e, "SourceNetworks.Network"),
      "Destination Networks": extractNested(e, "DestinationNetworks.Network"),
      "Service": extractNested(e, "Services.Service"),
      "Decryption Profile": asString(e.DecryptionProfile ?? ""),
    };
  });
  return { headers, rows };
}

function parseWirelessNetworks(entities: unknown[]): TableData {
  const headers = [
    "Name", "SSID", "Security Mode", "Status", "Encryption",
    "Zone", "Frequency Band", "Client Isolation", "Hide SSID",
  ];
  const rows = entities.map((e: any) => ({
    "Name": asString(e.Name ?? e.HardwareName),
    "SSID": asString(e.SSID ?? e.Name),
    "Security Mode": asString(e.SecurityMode ?? ""),
    "Status": asString(e.Status ?? ""),
    "Encryption": asString(e.Encryption ?? ""),
    "Zone": asString(e.Zone ?? ""),
    "Frequency Band": asString(e.FrequencyBand ?? ""),
    "Client Isolation": asString(e.ClientIsolation ?? ""),
    "Hide SSID": asString(e.HideSSID ?? ""),
  }));
  return { headers, rows };
}

function parseLocalServiceAcl(entities: unknown[]): TableData {
  if (!entities.length) return { headers: [], rows: [] };

  const headers = new Set<string>(["Service"]);
  const rows: Record<string, string>[] = [];

  for (const e of entities as Record<string, unknown>[]) {
    const row: Record<string, string> = {};
    const serviceName = asString(e.ServiceType ?? e.Service ?? e.Name ?? "");
    row["Service"] = serviceName;

    for (const [key, value] of Object.entries(e)) {
      if (key.startsWith("@_") || key === "ServiceType" || key === "Service" || key === "Name") continue;
      headers.add(key);
      row[key] = asString(value);
    }
    rows.push(row);
  }

  return { headers: Array.from(headers), rows };
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
  XFRMInterface: "XFRM Interfaces",
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
  ApplicationObject: "Application Objects",
  ApplicationClassification: "Application Classification",
  AVPolicy: "Virus Scanning",
  MalwareProtection: "Malware Protection",
  ZeroDayProtectionSettings: "Zero Day Protection",
  AntiSpamRules: "Anti-Spam Rules",
  VPNIPSecConnection: "IPSec VPN Connections",
  VPNProfile: "VPN Profiles",
  VPNAuthentication: "VPN Authentication",
  SSLVPNPolicy: "SSL VPN Policies",
  SSLVPNAuthentication: "SSL VPN Authentication",
  SSLTunnelAccessSettings: "SSL VPN Tunnel Access",
  SophosConnectClient: "Sophos Connect Client",
  SDWANPolicyRoute: "SD-WAN Routes",
  GatewayConfiguration: "Gateway Configuration",
  GatewayHost: "Gateway Hosts",
  QoSPolicy: "QoS Policies",
  AdminSettings: "Admin Settings",
  AdministrationProfile: "Admin Profiles",
  AdminAuthentication: "Admin Authentication",
  OTPSettings: "OTP / MFA Settings",
  SecurityGroup: "Groups",
  UserGroup: "User Groups",
  AuthenticationServer: "Authentication Servers",
  LDAPServer: "Authentication Servers",
  ADSServer: "Authentication Servers",
  ActiveDirectoryServer: "Authentication Servers",
  RadiusServer: "Authentication Servers",
  RADIUSServer: "Authentication Servers",
  TacacsServer: "Authentication Servers",
  TACACSServer: "Authentication Servers",
  DNS: "DNS Configuration",
  DNSRequestRoute: "DNS Request Routes",
  DHCP: "DHCP",
  DHCPServer: "DHCP Servers",
  SyslogServers: "Syslog Servers",
  SNMPAgentConfiguration: "SNMP Agent Config",
  SNMPCommunity: "SNMP Community",
  BackupRestore: "Backup & Restore",
  DoSSettings: "DoS Protection",
  SpoofPrevention: "Spoof Prevention",
  ProtocolSecurity: "Protocol Security",
  Certificate: "Certificates",
  WirelessNetworks: "Wireless Networks",
  WirelessAccessPoint: "Wireless Access Points",
  WirelessNetworkStatus: "Wireless Network Status",
  WirelessProtectionGlobalSettings: "Wireless Settings",
  RED: "RED Configuration",
  REDDevice: "RED Devices",
  HAConfigure: "High Availability",
  ATP: "Advanced Threat Protection",
  SophosXOpsThreatFeeds: "ATP Status",
  MDRThreatFeed: "MDR Status",
  NDREssentials: "NDR Status",
  ThirdPartyThreatFeed: "Third-party Feeds",
  ThirdPartyFeed: "Third-party Feeds",
  Notification: "Notifications",
  Notificationlist: "Notification List",
  Time: "Time Settings",
  Schedule: "Schedules",
  DataTransferPolicy: "Data Transfer Policies",
  WAFSlowHTTP: "WAF Slow HTTP",
  WAFTLS: "WAF TLS Settings",
  DefaultCaptivePortal: "Default Captive Portal",
  PopImapScanning: "POP/IMAP Scanning",
  POPIMAPScanningPolicy: "POP/IMAP Scanning Policy",
  FirewallAuthentication: "Firewall Authentication",
  WebAuthentication: "Web Authentication",
  AccessTimePolicy: "Access Time Policies",
  SurfingQuotaPolicy: "Surfing Quota Policies",
  CellularWAN: "Cellular WAN",
  SupportAccess: "Support Access",
  SystemModules: "System Modules",
};

function unpackAuthServers(data: unknown): Record<string, unknown>[] {
  const items = Array.isArray(data) ? data : [data as Record<string, unknown>];
  const servers: Record<string, unknown>[] = [];
  const childTypes = ["ActiveDirectory", "LDAPServer", "RadiusServer", "TacacsServer", "eDirectory"];

  for (const item of items) {
    if (item == null || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    let hadChildren = false;

    for (const childType of childTypes) {
      const children = obj[childType];
      if (!children) continue;
      hadChildren = true;
      const arr = Array.isArray(children) ? children : [children];
      for (const child of arr) {
        if (child && typeof child === "object") {
          servers.push({ _serverType: childType, ...(child as Record<string, unknown>) });
        }
      }
    }

    if (!hadChildren) {
      servers.push(obj);
    }
  }
  return servers;
}

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

      if (result.entityType === "AuthenticationServer") {
        entities = unpackAuthServers(entities);
      }

      const HOST_TYPES = new Set(["IPHost", "IPHostGroup", "FQDNHost", "FQDNHostGroup"]);
      if (HOST_TYPES.has(result.entityType)) {
        entities = entities.filter((e: any) => {
          const name = asString(e.Name ?? "");
          return !name.startsWith("##");
        });
        if (entities.length === 0) continue;
      }

      const sectionName = SECTION_MAP[result.entityType] ?? result.entityType;

      let table: TableData;
      if (result.entityType === "FirewallRule") {
        table = parseFirewallRules(entities);
      } else if (result.entityType === "NATRule") {
        table = parseNatRules(entities);
      } else if (result.entityType === "SSLTLSInspectionRule") {
        table = parseSslTlsRules(entities);
      } else if (result.entityType === "WirelessNetworks") {
        table = parseWirelessNetworks(entities);
      } else if (result.entityType === "LocalServiceACL") {
        table = parseLocalServiceAcl(entities);
      } else {
        table = parseGenericEntities(entities, result.entityType);
      }

      const newDetails = entities.map((e: any) => ({
        title: asString(e.Name ?? e.RuleName ?? e.Description ?? sectionName),
        fields: flattenObject(e),
      }));

      const existing = sections[sectionName];
      if (existing) {
        existing.tables[0] = {
          headers: [...new Set([...existing.tables[0].headers, ...table.headers])],
          rows: [...existing.tables[0].rows, ...table.rows],
        };
        existing.details = [...existing.details, ...newDetails];
      } else {
        sections[sectionName] = {
          tables: [table],
          text: "",
          details: newDetails,
        };
      }
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
      if (result.entityType === "AuthenticationServer") {
        entities = unpackAuthServers(entities);
      }
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
