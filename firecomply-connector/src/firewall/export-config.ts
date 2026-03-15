import { apiRequest, type FirewallCredentials } from "./auth";
import type { FirewallCapabilities } from "./version";

export interface EntityResult {
  entityType: string;
  xml: string;
  success: boolean;
  error?: string;
}

const ALL_ENTITIES = [
  // Core security
  "FirewallRule",
  "FirewallRuleGroup",
  "NATRule",
  "Zone",
  "LocalServiceACL",

  // Network objects
  "IPHost",
  "IPHostGroup",
  "FQDNHost",
  "FQDNHostGroup",
  "CountryGroup",
  "Services",
  "ServiceGroup",
  "Interface",
  "VLAN",
  "XFRMInterface",
  "Alias",

  // Web & content filtering
  "WebFilterPolicy",
  "WebFilterSettings",
  "WebFilterAdvancedSettings",
  "WebFilterCategory",
  "WebFilterException",
  "WebFilterNotificationSettings",
  "DefaultWebFilterNotificationSettings",
  "WebFilterProtectionSettings",
  "WebFilterURLGroup",

  // IPS
  "IPSPolicy",
  "IPSSwitch",
  "IPSFullSignaturePack",

  // SSL/TLS inspection
  "SSLTLSInspectionRule",
  "SSLTLSInspectionSettings",
  "DecryptionProfile",

  // Application filtering
  "ApplicationFilterPolicy",
  "ApplicationFilterCategory",
  "ApplicationObject",
  "ApplicationClassification",
  "ApplicationClassificationBatchAssignment",

  // Anti-virus & malware
  "AVPolicy",
  "MalwareProtection",
  "ZeroDayProtectionSettings",
  "AntiVirusFTP",
  "AntiVirusHTTPScanningRule",
  "AntiVirusHTTPsConfiguration",
  "AntiVirusHTTPSScanningExceptions",
  "AntiVirusMailSMTPScanningRules",
  "PopImapScanning",
  "POPIMAPScanningPolicy",
  "PatternDownload",

  // Anti-spam & email
  "AntiSpamRules",
  "AntiSpamQuarantineDigestSettings",
  "EmailConfiguration",
  "AdvancedSMTPSetting",
  "DKIMVerification",
  "MTAAddressGroup",
  "MTADataControlList",
  "MTASPXConfiguration",
  "MTASPXTemplates",
  "SPXConfiguration",
  "SPXTemplates",
  "SmarthostSettings",
  "RelaySettings",
  "DataTransferPolicy",
  "ContentConditionList",
  "FileType",

  // VPN
  "VPNIPSecConnection",
  "VPNProfile",
  "VPNAuthentication",
  "VPNPortalAuthentication",
  "SSLVPNPolicy",
  "SSLVPNAuthentication",
  "SSLTunnelAccessSettings",
  "SophosConnectClient",
  "PPTPConfiguration",
  "BookmarkManagement",
  "VpnConnRemoveOnFailover",
  "VpnConnRemoveTunnelUp",
  "DhcpLeaseOverIpSec",

  // SD-WAN & routing
  "SDWANPolicyRoute",
  "GatewayConfiguration",
  "GatewayHost",
  "RoutePrecedence",
  "PIMDynamicRouting",
  "MulticastConfiguration",

  // QoS
  "QoSPolicy",
  "QoSSettings",

  // Authentication & users
  "AdminSettings",
  "AdministrationProfile",
  "AdminAuthentication",
  "OTPSettings",
  "SecurityGroup",
  "UserGroup",
  "AuthenticationServer",
  "AuthCTA",
  "AzureADSSO",
  "ChromebookSSOLogin",
  "FirewallAuthentication",
  "WebAuthentication",
  "DirectWebProxyAuthentication",
  "ReverseAuthentication",
  "UserPortalAuthentication",
  "UserActivity",
  "AccessTimePolicy",
  "SurfingQuotaPolicy",
  "VoucherDefinition",

  // System services & network
  "SystemServices",
  "SystemModules",
  "DNS",
  "DNSRequestRoute",
  "DHCP",
  "DHCPServer",
  "DHCPBinding",
  "Time",
  "HttpProxy",
  "WebProxy",
  "ParentProxy",

  // Wireless
  "WirelessNetworks",
  "WirelessProtectionGlobalSettings",
  "WirelessNetworkStatus",
  "WirelessAccessPoint",

  // RED
  "RED",
  "REDDevice",

  // WAF
  "WAFSlowHTTP",
  "WAFTLS",

  // Certificates
  "Certificate",
  "CRL",
  "Letsencrypt",
  "SelfSignedCertificateAuthority",

  // DoS & spoof prevention
  "DoSSettings",
  "SpoofPrevention",
  "ProtocolSecurity",
  "ARPConfiguration",
  "ArpFlux",

  // Logging & monitoring
  "SyslogServers",
  "Notification",
  "Notificationlist",
  "SNMPAgentConfiguration",
  "SNMPCommunity",

  // Backup & maintenance
  "BackupRestore",
  "SupportAccess",
  "Hotfix",
  "DataManagement",
  "VarPartitionUsageWatermark",
  "SMSGateway",

  // Cellular
  "CellularWAN",

  // HA
  "HAConfigure",
  "VirtualHostFailoverNotification",

  // Threat feeds (gated by capabilities below)
  "ATP",
  "ThirdPartyFeed",

  // Captive portal
  "DefaultCaptivePortal",

  // Schedule
  "Schedule",

  // AVAAS
  "AVASAddressGroup",

  // Misc
  "FqdnHostSetting",
  "OverridePolicy",
  "CliDhcp",
];

// Entities excluded: CertificateAuthority (~250 built-in CAs), User (passwords),
// OTPTokens (secrets), FormTemplate (HTML), Messages (UI text), IviewCustomLogo (binary)

const SENSITIVE_FIELDS = new Set([
  "Password", "password", "Secret", "secret", "Key", "key",
  "PreSharedKey", "PrivateKey", "CAPrivateKeyFile",
]);

interface GatedEntity {
  tag: string;
  check: (cap: FirewallCapabilities) => boolean;
}

const GATED_ENTITIES: GatedEntity[] = [
  { tag: "SophosXOpsThreatFeeds", check: (c) => c.hasAtp },
  { tag: "MDRThreatFeed", check: (c) => c.hasMdr },
  { tag: "NDREssentials", check: (c) => c.hasNdr },
];

async function getEntity(
  creds: FirewallCredentials,
  entityType: string
): Promise<EntityResult> {
  try {
    const xml = await apiRequest(creds, `<Get><${entityType}></${entityType}></Get>`);
    return { entityType, xml, success: true };
  } catch (err) {
    return {
      entityType,
      xml: "",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Strip sensitive fields (passwords, keys) from XML before storage.
 */
export function redactSensitiveXml(xml: string): string {
  for (const field of SENSITIVE_FIELDS) {
    const re = new RegExp(`<${field}[^>]*>[^<]*</${field}>`, "gi");
    xml = xml.replace(re, `<${field}>***REDACTED***</${field}>`);
  }
  return xml;
}

const BATCH_SIZE = 5;

/**
 * Retrieve all config entities from the firewall.
 * Fetches in parallel batches for performance.
 */
export async function exportAllEntities(
  creds: FirewallCredentials,
  capabilities: FirewallCapabilities,
  onProgress?: (entity: string, index: number, total: number) => void
): Promise<EntityResult[]> {
  const entitiesToFetch = [
    ...ALL_ENTITIES,
    ...GATED_ENTITIES.filter((e) => e.check(capabilities)).map((e) => e.tag),
  ];

  const results: EntityResult[] = [];

  for (let i = 0; i < entitiesToFetch.length; i += BATCH_SIZE) {
    const batch = entitiesToFetch.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map((entity, batchIdx) => {
      const globalIdx = i + batchIdx;
      onProgress?.(entity, globalIdx, entitiesToFetch.length);
      return getEntity(creds, entity);
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}
