import { apiRequest, type FirewallCredentials } from "./auth";
import type { FirewallCapabilities } from "./version";
import { XMLParser } from "fast-xml-parser";

export interface ThreatStatus {
  firmwareVersion: string;
  atp: { enabled: boolean; policy: string; inspectContent: string } | null;
  mdr: { enabled: boolean; policy: string; connected: boolean } | null;
  ndr: {
    enabled: boolean;
    interfaces: string[];
    dataCenter: string;
    minThreatScore: string;
    iocCount?: number;
  } | null;
  thirdPartyFeeds: Array<{
    name: string;
    syncStatus: string;
    lastSync?: string;
  }> | null;
  collectedAt: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

function asString(val: unknown): string {
  if (val == null) return "";
  return String(val);
}

async function getAtp(creds: FirewallCredentials): Promise<ThreatStatus["atp"]> {
  try {
    const xml = await apiRequest(creds, "<Get><SophosXOpsThreatFeeds></SophosXOpsThreatFeeds></Get>");
    const parsed = parser.parse(xml);
    const feeds = parsed?.Response?.SophosXOpsThreatFeeds;
    if (!feeds) return null;
    const entry = Array.isArray(feeds) ? feeds[0] : feeds;
    return {
      enabled: asString(entry.ThreatProtectionStatus ?? entry.Status).toLowerCase() !== "disable",
      policy: asString(entry.Policy ?? "Log Only"),
      inspectContent: asString(entry.InspectContent ?? "all"),
    };
  } catch {
    return null;
  }
}

async function getMdr(creds: FirewallCredentials): Promise<ThreatStatus["mdr"]> {
  try {
    const xml = await apiRequest(creds, "<Get><MDRThreatFeed></MDRThreatFeed></Get>");
    const parsed = parser.parse(xml);
    const feed = parsed?.Response?.MDRThreatFeed;
    if (!feed) return null;
    const entry = Array.isArray(feed) ? feed[0] : feed;
    return {
      enabled: asString(entry.Status).toLowerCase() !== "disable",
      policy: asString(entry.Policy ?? ""),
      connected: asString(entry.ConnectionStatus ?? "").toLowerCase() === "connected",
    };
  } catch {
    return null;
  }
}

async function getNdr(creds: FirewallCredentials): Promise<ThreatStatus["ndr"]> {
  try {
    const xml = await apiRequest(creds, "<Get><NDREssentials></NDREssentials></Get>");
    const parsed = parser.parse(xml);
    const ndr = parsed?.Response?.NDREssentials;
    if (!ndr) return null;
    const entry = Array.isArray(ndr) ? ndr[0] : ndr;
    const ifaces = entry.MonitoredInterfaces?.Interface;
    return {
      enabled: asString(entry.Status).toLowerCase() !== "disable",
      interfaces: Array.isArray(ifaces) ? ifaces.map(asString) : ifaces ? [asString(ifaces)] : [],
      dataCenter: asString(entry.DataCenterLocation ?? ""),
      minThreatScore: asString(entry.MinimumThreatScore ?? ""),
      iocCount: entry.IoCount != null ? parseInt(asString(entry.IoCount), 10) : undefined,
    };
  } catch {
    return null;
  }
}

async function getThirdPartyFeeds(creds: FirewallCredentials): Promise<ThreatStatus["thirdPartyFeeds"]> {
  try {
    const xml = await apiRequest(creds, "<Get><ThirdPartyThreatFeed></ThirdPartyThreatFeed></Get>");
    const parsed = parser.parse(xml);
    const feeds = parsed?.Response?.ThirdPartyThreatFeed;
    if (!feeds) return null;
    const list = Array.isArray(feeds) ? feeds : [feeds];
    return list.map((f: any) => ({
      name: asString(f.Name),
      syncStatus: asString(f.SyncStatus ?? f.Status ?? "Unknown"),
      lastSync: asString(f.LastSync ?? f.LastSyncTime ?? ""),
    }));
  } catch {
    return null;
  }
}

/**
 * Collect threat protection telemetry based on detected firmware capabilities.
 * Each section is independently try/caught so a failure in one doesn't block others.
 */
export async function collectThreatStatus(
  creds: FirewallCredentials,
  capabilities: FirewallCapabilities
): Promise<ThreatStatus> {
  const status: ThreatStatus = {
    firmwareVersion: capabilities.firmwareVersion,
    atp: null,
    mdr: null,
    ndr: null,
    thirdPartyFeeds: null,
    collectedAt: new Date().toISOString(),
  };

  if (capabilities.hasAtp) {
    status.atp = await getAtp(creds);
  }

  if (capabilities.hasMdr) {
    status.mdr = await getMdr(creds);
  }

  if (capabilities.hasNdr) {
    status.ndr = await getNdr(creds);
  }

  if (capabilities.hasThirdPartyFeeds) {
    status.thirdPartyFeeds = await getThirdPartyFeeds(creds);
  }

  return status;
}
