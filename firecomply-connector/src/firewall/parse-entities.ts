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
  isArray: (name) => ARRAY_TAGS.has(name),
});

const ARRAY_TAGS = new Set([
  "FirewallRule", "NATRule", "Zone", "IPHost", "Interface",
  "WebFilterPolicy", "IPSPolicy", "LocalServiceACL", "SecurityGroup",
  "AVPolicy", "SSLTLSInspectionRule", "SophosXOpsThreatFeeds",
  "MDRThreatFeed", "NDREssentials", "ThirdPartyThreatFeed",
]);

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

function parseFirewallRules(entities: unknown[]): TableData {
  const headers = [
    "Rule Name", "Status", "Action", "Source Zone", "Destination Zone",
    "Service", "Web Filter", "IPS Policy", "Log", "Description",
  ];

  const rows: Record<string, string>[] = entities.map((e: any) => ({
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

function parseGenericEntities(entities: unknown[], entityType: string): TableData {
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
  NATRule: "NAT Rules",
  Zone: "Zones",
  IPHost: "Networks",
  Interface: "Interfaces & Ports",
  WebFilterPolicy: "Web Filters",
  IPSPolicy: "Intrusion Prevention",
  LocalServiceACL: "Local Service ACL",
  SecurityGroup: "Groups",
  AVPolicy: "Virus Scanning",
  SSLTLSInspectionRule: "SSL/TLS Inspection Rules",
  SophosXOpsThreatFeeds: "ATP Status",
  MDRThreatFeed: "MDR Status",
  NDREssentials: "NDR Status",
  ThirdPartyThreatFeed: "Third-party Feeds",
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

      const entities = response[result.entityType];
      if (!entities || (Array.isArray(entities) && entities.length === 0)) continue;

      const entityList = Array.isArray(entities) ? entities : [entities];
      const sectionName = SECTION_MAP[result.entityType] ?? result.entityType;

      let table: TableData;
      if (result.entityType === "FirewallRule") {
        table = parseFirewallRules(entityList);
      } else if (result.entityType === "NATRule") {
        table = parseNatRules(entityList);
      } else {
        table = parseGenericEntities(entityList, result.entityType);
      }

      sections[sectionName] = {
        tables: [table],
        text: "",
        details: entityList.map((e: any) => ({
          title: asString(e.Name ?? e.RuleName ?? sectionName),
          fields: flattenObject(e),
        })),
      };
    } catch (err) {
      console.warn(`[parse-entities] Failed to parse ${result.entityType}:`, err);
    }
  }

  return sections;
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
