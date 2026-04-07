/**
 * Public Edge Function: fetch Sophos Security Advisories RSS and return JSON for the app
 * (changelog “Latest threats”). RSS: https://www.sophos.com/en-us/security-advisories/feed
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { logJson } from "../_shared/logger.ts";
import { parseSophosAdvisoryRssXml } from "../_shared/sophos_advisory_rss.ts";

const RSS_URL = "https://www.sophos.com/en-us/security-advisories/feed";

function json(
  body: unknown,
  status = 200,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function clampLimit(n: unknown): number {
  const DEFAULT = 48;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, cors);
  }

  let limit = 48;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      limit = clampLimit(body?.limit);
    } catch {
      /* use default */
    }
  } else {
    try {
      const url = new URL(req.url);
      const raw = url.searchParams.get("limit");
      if (raw) limit = clampLimit(parseInt(raw, 10));
    } catch {
      /* use default */
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(RSS_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": "FireComply-SophosAdvisoryFeed/1.0",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      logJson("warn", "sophos_advisory_rss_http", {
        status: res.status,
        url: RSS_URL,
      });
      return json(
        { error: `Upstream HTTP ${res.status}`, items: [] },
        502,
        cors,
      );
    }

    const xml = await res.text();
    const items = parseSophosAdvisoryRssXml(xml, limit);

    if (items.length === 0) {
      logJson("warn", "sophos_advisory_rss_empty", { url: RSS_URL });
    }

    return json(
      {
        source: RSS_URL,
        items,
      },
      200,
      cors,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logJson("warn", "sophos_advisory_rss_failed", { error: message });
    return json({ error: message, items: [] }, 502, cors);
  }
});
