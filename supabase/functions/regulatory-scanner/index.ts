import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { safeError } from "../_shared/db.ts";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://sophos-firecomply.vercel.app",
  Deno.env.get("ALLOWED_ORIGIN") ?? "",
].filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

function isServiceRoleBearer(req: Request): boolean {
  const auth = req.headers.get("Authorization")?.trim() ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const token = auth.slice(7).trim();
  return token.length > 0 && token === SUPABASE_SERVICE_KEY;
}

/** Keep URLs verified periodically — vendor sites often retire legacy /feeds paths (404). */
const RSS_SOURCES = [
  {
    name: "NCSC",
    url: "https://www.ncsc.gov.uk/api/1/services/v1/news-rss-feed.xml",
    framework: "Cyber Essentials",
  },
  {
    name: "NIST",
    url: "https://www.nist.gov/news-events/news/rss.xml",
    framework: "NIST CSF",
  },
  {
    name: "PCI SSC",
    url: "https://blog.pcisecuritystandards.org/rss.xml",
    framework: "PCI DSS",
  },
  {
    name: "CISA",
    url: "https://www.cisa.gov/news.xml",
    framework: "Cybersecurity",
  },
];

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  framework: string;
}

/** Per-source result for UI diagnostics (also logged server-side). */
interface FeedFetchStatus {
  name: string;
  url: string;
  ok: boolean;
  http_status: number | null;
  items_parsed: number;
  error: string | null;
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return ((m?.[1] ?? m?.[2]) ?? "").trim();
}

function extractLinkHref(xml: string): string {
  const m = xml.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (m) return m[1];
  return extractTag(xml, "link");
}

function parseRssFeed(xml: string, source: string, framework: string): RssItem[] {
  const items: RssItem[] = [];

  // RSS 2.0 <item>
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  for (const block of itemBlocks) {
    items.push({
      title: extractTag(block, "title"),
      link: extractLinkHref(block) || extractTag(block, "link"),
      description: extractTag(block, "description").replace(/<[^>]*>/g, "").slice(0, 500),
      pubDate: extractTag(block, "pubDate") || extractTag(block, "dc:date"),
      source,
      framework,
    });
  }

  // Atom <entry>
  if (items.length === 0) {
    const entryBlocks = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
    for (const block of entryBlocks) {
      items.push({
        title: extractTag(block, "title"),
        link: extractLinkHref(block),
        description: (extractTag(block, "summary") || extractTag(block, "content")).replace(/<[^>]*>/g, "").slice(0, 500),
        pubDate: extractTag(block, "published") || extractTag(block, "updated"),
        source,
        framework,
      });
    }
  }

  return items.slice(0, 10);
}

async function fetchFeedWithStatus(
  source: (typeof RSS_SOURCES)[0],
): Promise<{ items: RssItem[]; status: FeedFetchStatus }> {
  const status: FeedFetchStatus = {
    name: source.name,
    url: source.url,
    ok: false,
    http_status: null,
    items_parsed: 0,
    error: null,
  };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { "User-Agent": "FireComply-RegulatoryScanner/1.0" },
    });
    clearTimeout(timer);
    status.http_status = res.status;
    if (!res.ok) {
      status.error = `HTTP ${res.status}`;
      console.warn(`[fetchFeed] ${source.name} ${status.error} ${source.url}`);
      return { items: [], status };
    }
    const xml = await res.text();
    const items = parseRssFeed(xml, source.name, source.framework);
    status.items_parsed = items.length;
    status.ok = items.length > 0;
    if (items.length === 0) {
      status.error = "No RSS/Atom items parsed (empty or unknown format)";
      console.warn(`[fetchFeed] ${source.name} parsed 0 items`);
    }
    return { items, status };
  } catch (err) {
    status.error = err instanceof Error ? err.message : String(err);
    console.warn(`[fetchFeed] ${source.name} failed:`, err);
    return { items: [], status };
  }
}

async function summariseWithGemini(items: RssItem[]): Promise<Array<{
  title: string;
  summary: string;
  link: string;
  source: string;
  framework: string;
  published_at: string | null;
  relevant: boolean;
}>> {
  if (!GEMINI_API_KEY || items.length === 0) {
    return items.map((i) => ({
      title: i.title,
      summary: i.description.slice(0, 200),
      link: i.link,
      source: i.source,
      framework: i.framework,
      published_at: i.pubDate ? new Date(i.pubDate).toISOString() : null,
      relevant: true,
    }));
  }

  const itemList = items.map((i, idx) => `[${idx}] "${i.title}" — ${i.description.slice(0, 200)}`).join("\n");

  const prompt = `You are a firewall security compliance analyst. Below are news items from regulatory bodies.

For each item, determine if it is relevant to network security, firewall configuration, or compliance frameworks (PCI DSS, Cyber Essentials, GDPR, NIST CSF, NIS2, ISO 27001, SOC 2).

Return a JSON array where each element has:
- "index": the item number
- "relevant": true/false
- "summary": a concise 1-2 sentence summary of why this matters for firewall security compliance (only if relevant)

Items:
${itemList}

Return ONLY the JSON array, no markdown fencing.`;

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: "You are a security compliance analyst. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      console.warn("[summarise] Gemini returned", res.status);
      throw new Error("Gemini API error");
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as Array<{ index: number; relevant: boolean; summary?: string }>;

    return items.map((item, idx) => {
      const ai = parsed.find((p) => p.index === idx);
      return {
        title: item.title,
        summary: ai?.summary ?? item.description.slice(0, 200),
        link: item.link,
        source: item.source,
        framework: item.framework,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        relevant: ai?.relevant ?? true,
      };
    });
  } catch (err) {
    console.warn("[summarise] AI failed, using raw descriptions:", err);
    return items.map((i) => ({
      title: i.title,
      summary: i.description.slice(0, 200),
      link: i.link,
      source: i.source,
      framework: i.framework,
      published_at: i.pubDate ? new Date(i.pubDate).toISOString() : null,
      relevant: true,
    }));
  }
}

async function runRegulatoryScan(
  admin: ReturnType<typeof createClient>,
  cors: Record<string, string>,
  opts: { enforceUserCooldown: boolean; invoker: "cron" | "user" },
): Promise<Response> {
  if (opts.enforceUserCooldown) {
    const { data: lastScan } = await admin
      .from("regulatory_updates")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const COOLDOWN_MS = 24 * 60 * 60 * 1000;
    if (lastScan?.created_at && Date.now() - new Date(lastScan.created_at).getTime() < COOLDOWN_MS) {
      const hoursLeft = Math.ceil(
        (COOLDOWN_MS - (Date.now() - new Date(lastScan.created_at).getTime())) / 3_600_000,
      );
      return new Response(
        JSON.stringify({
          throttled: true,
          message: `Already scanned today. Next scan available in ~${hoursLeft}h.`,
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
  }

  const feedResults = await Promise.all(RSS_SOURCES.map(fetchFeedWithStatus));
  const feed_status = feedResults.map((r) => r.status);
  const allItems: RssItem[] = [];
  for (const r of feedResults) allItems.push(...r.items);

  if (allItems.length === 0) {
    console.warn(`[regulatory-scanner] ${opts.invoker}: no RSS items`);
    return new Response(
      JSON.stringify({
        updates: [],
        message: "No items fetched from feeds",
        feed_status,
        invoker: opts.invoker,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const summarised = await summariseWithGemini(allItems);
  const relevant = summarised.filter((s) => s.relevant);

  let inserted = 0;
  for (const item of relevant) {
    const { error } = await admin.from("regulatory_updates").upsert(
      {
        source: item.source,
        title: item.title,
        summary: item.summary,
        link: item.link,
        framework: item.framework,
        published_at: item.published_at,
      },
      { onConflict: "source,title" },
    );
    if (!error) inserted++;
  }

  console.log(
    `[regulatory-scanner] ${opts.invoker}: scanned=${allItems.length} relevant=${relevant.length} inserted=${inserted}`,
  );

  return new Response(
    JSON.stringify({
      scanned: allItems.length,
      relevant: relevant.length,
      inserted,
      message: `Scanned ${allItems.length} items, ${relevant.length} relevant, ${inserted} stored`,
      feed_status,
      invoker: opts.invoker,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = (body as Record<string, unknown>).action ?? "scan";
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const cron = isServiceRoleBearer(req);

    if (action === "scan") {
      if (cron) {
        return await runRegulatoryScan(admin, cors, { enforceUserCooldown: false, invoker: "cron" });
      }
      const authHeader = req.headers.get("Authorization") ?? "";
      const { data: { user } } = await createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        global: { headers: { Authorization: authHeader } },
      }).auth.getUser();

      if (!user) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      return await runRegulatoryScan(admin, cors, { enforceUserCooldown: true, invoker: "user" });
    }

    if (action === "list") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const { data: { user } } = await createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        global: { headers: { Authorization: authHeader } },
      }).auth.getUser();

      if (!user) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await admin
        .from("regulatory_updates")
        .select("*")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(20);

      if (error) throw error;

      return new Response(JSON.stringify({ updates: data ?? [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: safeError(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
