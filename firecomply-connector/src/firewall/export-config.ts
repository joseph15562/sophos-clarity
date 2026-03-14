import { apiRequest, type FirewallCredentials } from "./auth";
import type { FirewallCapabilities } from "./version";

export interface EntityResult {
  entityType: string;
  xml: string;
  success: boolean;
  error?: string;
}

const CORE_ENTITIES = [
  "FirewallRule",
  "NATRule",
  "Zone",
  "IPHost",
  "Interface",
  "WebFilterPolicy",
  "IPSPolicy",
  "LocalServiceACL",
  "SecurityGroup",
  "AVPolicy",
];

interface GatedEntity {
  tag: string;
  check: (cap: FirewallCapabilities) => boolean;
}

const GATED_ENTITIES: GatedEntity[] = [
  { tag: "SSLTLSInspectionRule", check: (c) => c.hasSslTlsInspection },
  { tag: "SophosXOpsThreatFeeds", check: (c) => c.hasAtp },
  { tag: "MDRThreatFeed", check: (c) => c.hasMdr },
  { tag: "NDREssentials", check: (c) => c.hasNdr },
  { tag: "ThirdPartyThreatFeed", check: (c) => c.hasThirdPartyFeeds },
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
 * Retrieve all config entities from the firewall.
 * Core entities are always fetched; gated entities are only attempted when capabilities allow.
 */
export async function exportAllEntities(
  creds: FirewallCredentials,
  capabilities: FirewallCapabilities,
  onProgress?: (entity: string, index: number, total: number) => void
): Promise<EntityResult[]> {
  const entitiesToFetch = [
    ...CORE_ENTITIES,
    ...GATED_ENTITIES.filter((e) => e.check(capabilities)).map((e) => e.tag),
  ];

  const results: EntityResult[] = [];

  for (let i = 0; i < entitiesToFetch.length; i++) {
    const entity = entitiesToFetch[i];
    onProgress?.(entity, i, entitiesToFetch.length);
    const result = await getEntity(creds, entity);

    if (!result.success && result.xml === "") {
      // Graceful skip for unsupported entities
      console.warn(`[export-config] ${entity}: ${result.error ?? "empty response"}`);
    }

    results.push(result);
  }

  return results;
}
