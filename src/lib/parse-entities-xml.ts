/**
 * Parses a Sophos Entities.xml (or any Sophos XML config export) into
 * the raw_config format expected by rawConfigToSections().
 *
 * Supports two common XML structures:
 *   1. <Response><FirewallRule>...</FirewallRule>...</Response>
 *   2. Root element containing mixed entity types directly
 */

import { XMLParser } from "fast-xml-parser";

const SKIP_KEYS = new Set([
  "?xml", "xml", "#text", "@_version", "@_encoding",
  "Login", "Status", "@_APIVersion", "@_IPS_CAT_VER",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (_name: string, jpath: string) => {
    const depth = jpath.split(".").length;
    return depth === 2;
  },
});

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

    if (!hadChildren) servers.push(obj);
  }
  return servers;
}

export function parseEntitiesXml(xmlString: string): Record<string, unknown> {
  const parsed = parser.parse(xmlString);
  if (!parsed || typeof parsed !== "object") return {};

  // Find the root container — either "Response" or the first non-meta key
  let root: Record<string, unknown> = parsed as Record<string, unknown>;
  if (root.Response && typeof root.Response === "object") {
    root = root.Response as Record<string, unknown>;
  } else {
    const rootKey = Object.keys(root).find((k) => !SKIP_KEYS.has(k) && typeof root[k] === "object");
    if (rootKey && typeof root[rootKey] === "object" && !Array.isArray(root[rootKey])) {
      root = root[rootKey] as Record<string, unknown>;
    }
  }

  const raw: Record<string, unknown> = {};

  for (const [entityType, data] of Object.entries(root)) {
    if (SKIP_KEYS.has(entityType) || data == null) continue;
    if (typeof data !== "object") continue;

    let entities = Array.isArray(data) ? data : [data];
    if (entities.length === 0) continue;

    if (entityType === "AuthenticationServer") {
      entities = unpackAuthServers(entities);
    }

    raw[entityType] = entities;
  }

  return raw;
}
