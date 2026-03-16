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
  SystemServices: "System Services",
  SystemModules: "System Modules",
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

function policyField(e: Record<string, unknown>, field: string): string {
  return extractNested(e, `NetworkPolicy.${field}`) ||
         extractNested(e, `UserPolicy.${field}`) || "";
}

function buildFirewallRuleTable(entities: Record<string, unknown>[]): TableData {
  const headers = [
    "Rule Name", "Status", "Policy Type", "Action",
    "Source Zone", "Source Zones", "Destination Zone", "Destination Zones",
    "Source Networks", "Destination Networks",
    "Service", "Web Filter", "IPS Policy", "IPS",
    "Intrusion Prevention", "Application Control",
    "Log", "Log Traffic", "Description",
  ];
  const rows = entities.map((e) => {
    const srcZone = policyField(e, "SourceZones.Zone");
    const dstZone = policyField(e, "DestinationZones.Zone");
    const service = policyField(e, "Services.Service");
    const webFilter = policyField(e, "WebFilter");
    const ips = policyField(e, "IntrusionPrevention");
    const appCtrl = policyField(e, "ApplicationControl");
    const logTraffic = policyField(e, "LogTraffic");
    const srcNetworks = policyField(e, "SourceNetworks.Network");
    const dstNetworks = policyField(e, "DestinationNetworks.Network");

    return {
      "Rule Name": asString(e.Name),
      "Status": asString(e.Status),
      "Policy Type": asString(e.PolicyType ?? ""),
      "Action": policyField(e, "Action"),
      "Source Zone": srcZone,
      "Source Zones": srcZone,
      "Destination Zone": dstZone,
      "Destination Zones": dstZone,
      "Source Networks": srcNetworks,
      "Destination Networks": dstNetworks,
      "Service": service || "Any",
      "Web Filter": webFilter || "None",
      "IPS Policy": ips || "None",
      "IPS": ips || "None",
      "Intrusion Prevention": ips || "None",
      "Application Control": appCtrl || "None",
      "Log": logTraffic,
      "Log Traffic": logTraffic,
      "Description": asString(e.Description ?? ""),
    };
  });
  return { headers, rows };
}

function buildNatRuleTable(entities: Record<string, unknown>[]): TableData {
  const headers = [
    "Rule Name", "Status", "Rule Type",
    "Original Source", "Original Destination",
    "Translated Source", "Translated Destination",
    "Source Networks", "Destination Networks",
    "Source", "Destination",
  ];
  const rows = entities.map((e) => {
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

function buildSslTlsTable(entities: Record<string, unknown>[]): TableData {
  const headers = [
    "Name", "Rule Name", "Status", "Decrypt Action", "Action",
    "Source Zone", "Source Zones", "Destination Zone", "Destination Zones",
    "Source Networks", "Destination Networks", "Service", "Decryption Profile",
  ];
  const rows = entities.map((e) => {
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

function buildWirelessNetworksTable(entities: Record<string, unknown>[]): TableData {
  const headers = [
    "Name", "SSID", "Security Mode", "Status", "Encryption",
    "Zone", "Frequency Band", "Client Isolation", "Hide SSID",
  ];
  const rows = entities.map((e) => ({
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

function buildLocalServiceAclTable(entities: Record<string, unknown>[]): TableData {
  if (!entities.length) return { headers: [], rows: [] };

  const headers = new Set<string>(["Service"]);
  const rows: Record<string, string>[] = [];

  for (const e of entities) {
    const row: Record<string, string> = {};
    const serviceName = asString(e.ServiceType ?? e.Service ?? e.Name ?? "");
    row["Service"] = serviceName;

    for (const [key, value] of Object.entries(e as Record<string, unknown>)) {
      if (key.startsWith("@_") || key === "ServiceType" || key === "Service" || key === "Name") continue;
      const strVal = asString(value);
      headers.add(key);
      row[key] = strVal;
    }
    rows.push(row);
  }

  return { headers: Array.from(headers), rows };
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
    } else if (entityType === "SSLTLSInspectionRule") {
      table = buildSslTlsTable(entities);
    } else if (entityType === "WirelessNetworks") {
      table = buildWirelessNetworksTable(entities);
    } else if (entityType === "LocalServiceACL") {
      table = buildLocalServiceAclTable(entities);
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
