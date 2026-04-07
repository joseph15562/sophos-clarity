import type { FunctionInvokeOptions } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ThreatIntelCard } from "@/lib/mock-data";
import { parseSophosAdvisoryRssXml } from "@/lib/sophos-advisory-rss-parse";

/** JSON item from `sophos-advisories-feed` Edge Function (matches _shared/sophos_advisory_rss). */
export interface SophosAdvisoryFeedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  published: string;
  severity: ThreatIntelCard["severity"];
  cve?: string;
  category: ThreatIntelCard["category"];
  productLine: string;
}

const RSS_DIRECT = "https://www.sophos.com/en-us/security-advisories/feed";
/** Proxied on Vercel (`vercel.json`) and Vite dev (`vite.config.ts`) for same-origin fetch. */
const RSS_SAME_ORIGIN = "/api/sophos-advisories-feed";

export function sophosAdvisoryItemToThreatCard(row: SophosAdvisoryFeedItem): ThreatIntelCard {
  return {
    id: row.id,
    severity: row.severity,
    cve: row.cve,
    title: row.title,
    products: row.productLine,
    description: row.description,
    published: row.published,
    category: row.category,
    link: row.link,
  };
}

async function fetchAdvisoryRssXml(signal: AbortSignal | undefined): Promise<string> {
  const init: RequestInit = {
    signal,
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  };

  const tryFetch = async (url: string) => {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  };

  try {
    return await tryFetch(RSS_SAME_ORIGIN);
  } catch {
    return tryFetch(RSS_DIRECT);
  }
}

/**
 * Loads Sophos Security Advisories: prefers Supabase Edge Function, then same-origin RSS proxy
 * (Vercel / Vite), then direct RSS URL (may fail browser CORS).
 */
export async function fetchSophosAdvisoriesThreatCards(
  signal: AbortSignal | undefined,
  limit: number,
): Promise<ThreatIntelCard[]> {
  const invokeOpts: FunctionInvokeOptions = { body: { limit } };
  if (signal) invokeOpts.signal = signal;

  try {
    const { data, error } = await supabase.functions.invoke<{
      items?: SophosAdvisoryFeedItem[];
      error?: string;
    }>("sophos-advisories-feed", invokeOpts);

    if (!error && Array.isArray(data?.items) && data.items.length > 0) {
      return data.items.map(sophosAdvisoryItemToThreatCard);
    }
  } catch {
    /* Edge Function missing, wrong URL, or network — fall back */
  }

  const xml = await fetchAdvisoryRssXml(signal);
  return parseSophosAdvisoryRssXml(xml, limit).map((p) =>
    sophosAdvisoryItemToThreatCard({
      ...p,
      severity: p.severity,
      category: p.category,
    }),
  );
}
