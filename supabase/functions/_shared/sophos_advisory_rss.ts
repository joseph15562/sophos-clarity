/** Parse Sophos Security Advisories RSS (https://www.sophos.com/en-us/security-advisories/feed). */

export type SophosAdvisorySeverityUi = "CRITICAL" | "HIGH" | "MEDIUM";

export type SophosAdvisoryCategoryUi = "Firewall" | "Endpoint" | "Network";

export interface SophosAdvisoryFeedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  published: string;
  severity: SophosAdvisorySeverityUi;
  cve?: string;
  category: SophosAdvisoryCategoryUi;
  /** Short badge — aligns with Firewall / Endpoint / Network filters + switch/AP/wireless. */
  productLine: string;
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`,
    "i",
  );
  const m = xml.match(re);
  return ((m?.[1] ?? m?.[2]) ?? "").trim();
}

function extractLinkHref(xml: string): string {
  const m = xml.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (m) return m[1];
  return extractTag(xml, "link");
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSophosDescription(html: string): {
  severityRaw: string | null;
  cveRaw: string | null;
  firstPublishedIso: string | null;
} {
  const sevMatch = html.match(/<strong>Severity:<\/strong>\s*([^<]+)/i);
  const cveMatch = html.match(/<strong>CVE:<\/strong>\s*([^<]+)/i);
  const fp = html.match(
    /<strong>First Published:<\/strong>[\s\S]*?datetime="([^"]+)"/i,
  );
  return {
    severityRaw: sevMatch?.[1]?.trim() ?? null,
    cveRaw: cveMatch?.[1]?.trim() ?? null,
    firstPublishedIso: fp?.[1] ?? null,
  };
}

function severityToUi(raw: string | null): SophosAdvisorySeverityUi {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("critical")) return "CRITICAL";
  if (s.includes("high")) return "HIGH";
  return "MEDIUM";
}

const CVE_RE = /CVE-\d{4}-\d+/i;

function firstCve(cveLine: string | null): string | undefined {
  if (!cveLine) return undefined;
  const m = cveLine.match(CVE_RE);
  return m ? m[0].toUpperCase() : undefined;
}

/** Map advisory title to UI category (Firewall / Endpoint / Network incl. switch & AP). */
export function inferSophosAdvisoryCategory(
  title: string,
): SophosAdvisoryCategoryUi {
  const t = title.toLowerCase();

  if (
    /\b(wireless access|access points?|\bap6\b|wi-?fi access|wlan)\b/.test(t)
  ) {
    return "Network";
  }
  if (/\b(sophos switch|network switch|switch series)\b/.test(t)) {
    return "Network";
  }
  if (/\b(ndr|network detection)\b/.test(t)) {
    return "Network";
  }

  if (
    /\b(sophos firewall|\bsfos\b|\butm\b|\bngfw\b)\b/.test(t) ||
    /\bxgs\b/.test(t)
  ) {
    return "Firewall";
  }

  if (
    /\b(endpoint|intercept x|taegis endpoint|endpoint for windows|endpoint agent|cix-)\b/
      .test(t)
  ) {
    return "Endpoint";
  }
  if (/\b(sophos central)\b/.test(t) && /\b(agent|endpoint)\b/.test(t)) {
    return "Endpoint";
  }
  if (/\b(server protection|mobile security|workload protection)\b/.test(t)) {
    return "Endpoint";
  }

  return "Network";
}

function productLineForCategory(c: SophosAdvisoryCategoryUi): string {
  switch (c) {
    case "Firewall":
      return "Sophos Firewall / XGS";
    case "Endpoint":
      return "Sophos Endpoint / Central";
    default:
      return "Network (switch / AP / wireless)";
  }
}

function publishedYmd(
  firstPublishedIso: string | null,
  pubDate: string,
): string {
  if (firstPublishedIso) {
    const d = new Date(firstPublishedIso);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const d2 = new Date(pubDate);
  if (!Number.isNaN(d2.getTime())) return d2.toISOString().slice(0, 10);
  return "—";
}

function itemId(guid: string, link: string): string {
  const g = guid.trim();
  if (g) return `sophos-sa:${g}`;
  try {
    const path = new URL(link).pathname.split("/").filter(Boolean).pop();
    if (path) return `sophos-sa:${path}`;
  } catch {
    /* ignore */
  }
  return `sophos-sa:${link.slice(0, 80)}`;
}

/**
 * Parse full RSS XML into advisory rows (newest-first as in feed).
 */
export function parseSophosAdvisoryRssXml(
  xml: string,
  limit: number,
): SophosAdvisoryFeedItem[] {
  const cap = Math.min(Math.max(limit, 1), 100);
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const out: SophosAdvisoryFeedItem[] = [];

  for (const block of blocks) {
    const title = extractTag(block, "title");
    const link = extractLinkHref(block) || extractTag(block, "link");
    const descHtml = extractTag(block, "description");
    const pubDate = extractTag(block, "pubDate") ||
      extractTag(block, "dc:date");
    const guid = extractTag(block, "guid");
    if (!title || !link) continue;

    const parsed = parseSophosDescription(descHtml);
    const category = inferSophosAdvisoryCategory(title);
    const plainDesc = htmlToPlain(descHtml);

    out.push({
      id: itemId(guid, link),
      title,
      link,
      description: plainDesc || title,
      published: publishedYmd(parsed.firstPublishedIso, pubDate),
      severity: severityToUi(parsed.severityRaw),
      cve: firstCve(parsed.cveRaw),
      category,
      productLine: productLineForCategory(category),
    });
    if (out.length >= cap) break;
  }

  return out;
}
