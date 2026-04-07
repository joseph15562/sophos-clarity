import { centralAlertRaisedAt, type CentralAlert } from "@/lib/sophos-central";

/** One day in the area chart (Sophos Central open alerts, not firewall “blocked” counters). */
export type PortfolioThreatSeriesPoint = { date: string; alerts: number };

export type PortfolioThreatStackBucket = "Malware" | "Phishing" | "IPS" | "Web" | "Other";

/** Stacked bar / legend order (left-to-right segments); keep charts and mocks aligned. */
export const PORTFOLIO_THREAT_STACK_KEYS: readonly PortfolioThreatStackBucket[] = [
  "Malware",
  "Phishing",
  "IPS",
  "Web",
  "Other",
];

const STACK_ORDER: PortfolioThreatStackBucket[] = [...PORTFOLIO_THREAT_STACK_KEYS];

/** MM-DD in local time — matches `MOCK_THREAT_ACTIVITY` labelling style. */
function localDayKey(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m < 10 ? "0" : ""}${m}-${day < 10 ? "0" : ""}${day}`;
}

function norm(s: unknown): string {
  return `${s ?? ""}`.toLowerCase();
}

/**
 * Map Central alert `product`, `type` (`Event::…`), `category`, and description into stacked chart
 * buckets. Product/type take precedence so firewall ATP, ZTNA, email, etc. don’t all land in Other.
 */
export function mapAlertToThreatBucket(alert: CentralAlert): PortfolioThreatStackBucket {
  const cat = norm(alert.category);
  const prod = norm(alert.product);
  const desc = norm(alert.description);
  const typ = `${(alert as CentralAlert & { type?: string }).type ?? ""}`;
  const typLower = typ.toLowerCase();
  const all = `${cat} ${prod} ${desc} ${typLower}`;

  // ── Operational / health (Central categories): tunnel up/down, patch state, etc. ──
  if (
    /::(?:firewallred|heartbeat|sync)/i.test(typ) ||
    ["connectivity", "health", "updating", "licensing"].includes(cat)
  ) {
    if (
      !/malware|virus|troj|phish|intrusion|ips|botnet|c2|ransom|advanced threat|command and control/i.test(
        all,
      )
    ) {
      return "Other";
    }
  }

  // ── Sophos `type` (highest signal when present) ──
  if (typ) {
    if (
      /::(?:email|mail|smtp|mime|impersonation|spoof|phish|spam|quarantine|postdelivery)/i.test(typ)
    ) {
      return "Phishing";
    }
    if (/::ztna/i.test(typ)) {
      return "Web";
    }
    if (
      /firewalladvancedthreatprotection|::malware|::virus|::pua|::ransomware|::sandbox|macdetection|cleanpua|heartbeatmalware/i.test(
        typLower,
      )
    ) {
      return "Malware";
    }
    if (/::(?:ips|intrusion|packet|heartbeatips)/i.test(typ)) {
      return "IPS";
    }
    if (
      /::(?:web|url|waf|category|tls|ssl|certificate|dnsfilter|webfilter)/i.test(typ) ||
      /webcategory|applicationcontrol/i.test(typLower)
    ) {
      return "Web";
    }
  }

  // ── `product` (Central API; MCP uses lowercase snake in some paths — we normalise) ──
  if (prod === "email" || prod === "mail") {
    return "Phishing";
  }
  if (prod === "ztna") {
    return "Web";
  }
  if (prod === "wireless" || prod === "wifi") {
    return "Web";
  }
  if (prod === "endpoint" || prod === "server" || prod === "computer" || prod === "mobile") {
    if (cat.includes("phish") || cat.includes("spam") || desc.includes("phish")) {
      return "Phishing";
    }
    if (cat.includes("web") || cat.includes("url")) {
      return "Web";
    }
    if (cat.includes("ips") || cat.includes("intrusion")) {
      return "IPS";
    }
    return "Malware";
  }

  // ── Category (snake_case from API) ──
  if (cat.includes("phish") || cat.includes("spam") || cat === "email") {
    return "Phishing";
  }
  if (cat.includes("ztna")) {
    return "Web";
  }
  if (cat.includes("malware") || cat.includes("runtimedetection") || cat.includes("virus")) {
    return "Malware";
  }
  if (cat.includes("ips") || cat.includes("intrusion")) {
    return "IPS";
  }
  if (
    cat.includes("web") ||
    cat.includes("url") ||
    cat.includes("applicationcontrol") ||
    cat.includes("dns")
  ) {
    return "Web";
  }

  // ── Description keywords (firewall product often has category "security") ──
  if (
    all.includes("phish") ||
    all.includes("spam") ||
    /\bemail\b/.test(all) ||
    /\bmail\b/.test(all)
  ) {
    return "Phishing";
  }
  if (
    all.includes("botnet") ||
    all.includes("command and control") ||
    all.includes("command-and-control") ||
    /\bc2\b/.test(desc) ||
    all.includes("c&c") ||
    all.includes("beacon") ||
    all.includes("callback") ||
    all.includes("malicious communication") ||
    all.includes("exfiltration")
  ) {
    return "Malware";
  }
  if (
    cat.includes("malware") ||
    desc.includes("malware") ||
    desc.includes("troj") ||
    desc.includes("virus") ||
    desc.includes("ransom") ||
    desc.includes("pua") ||
    desc.includes("sandbox") ||
    desc.includes("advanced threat") ||
    /\bransomware\b/.test(desc)
  ) {
    return "Malware";
  }
  if (
    all.includes("web") ||
    all.includes("url ") ||
    all.includes(" dns") ||
    all.includes("malicious dns") ||
    all.includes("tls") ||
    all.includes("ssl ") ||
    all.includes("certificate") ||
    all.includes("web filter") ||
    all.includes("category")
  ) {
    return "Web";
  }
  if (
    all.includes("ips") ||
    all.includes("intrusion") ||
    all.includes("sql injection") ||
    all.includes("packet inspection") ||
    all.includes("xstream") ||
    all.includes("deep packet") ||
    all.includes("exploit")
  ) {
    return "IPS";
  }

  return "Other";
}

/** Mission control spark: collapse five buckets to three series colours. */
export function mapAlertToMissionControlAxes(alert: CentralAlert): "ips" | "web" | "blocked" {
  const b = mapAlertToThreatBucket(alert);
  if (b === "Web") return "web";
  if (b === "Other") return "blocked";
  return "ips";
}

function titleCaseCategory(raw: string): string {
  const s = raw.replace(/_/g, " ").trim() || "Uncategorized";
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export type PortfolioThreatFromCentral = {
  series: PortfolioThreatSeriesPoint[];
  stackedRow: Record<string, string | number>;
  stackKeys: PortfolioThreatStackBucket[];
  topTypes: { name: string; pct: number; count: number }[];
  inWindowCount: number;
};

/**
 * Build Portfolio Insights “Threat landscape” charts from open Central alerts (raised time in range).
 */
export function buildPortfolioThreatFromCentralAlerts(
  items: Array<CentralAlert & { tenantId?: string }>,
  horizonDays: number,
  now = new Date(),
): PortfolioThreatFromCentral {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - (Math.max(1, horizonDays) - 1));

  const startMs = windowStart.getTime();
  const endMs = endOfToday.getTime();

  const inWindow = items.filter((a) => {
    const raw = centralAlertRaisedAt(a);
    const t = Date.parse(raw);
    return !Number.isNaN(t) && t >= startMs && t <= endMs;
  });

  const dayKeys: string[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(windowStart);
    d.setDate(windowStart.getDate() + i);
    dayKeys.push(localDayKey(d));
  }

  const countsByDay = new Map<string, number>();
  for (const k of dayKeys) countsByDay.set(k, 0);

  const bucketCounts: Record<PortfolioThreatStackBucket, number> = {
    Malware: 0,
    Phishing: 0,
    IPS: 0,
    Web: 0,
    Other: 0,
  };

  const categoryCounts = new Map<string, number>();

  for (const a of inWindow) {
    const t = Date.parse(centralAlertRaisedAt(a));
    if (Number.isNaN(t)) continue;
    const alertDay = new Date(t);
    const key = localDayKey(alertDay);
    if (countsByDay.has(key)) {
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
    }

    const bucket = mapAlertToThreatBucket(a);
    bucketCounts[bucket]++;

    const rawCat = (a.category ?? "").trim() || "uncategorized";
    const label = titleCaseCategory(rawCat);
    categoryCounts.set(label, (categoryCounts.get(label) ?? 0) + 1);
  }

  const series: PortfolioThreatSeriesPoint[] = dayKeys.map((date) => ({
    date,
    alerts: countsByDay.get(date) ?? 0,
  }));

  const row: Record<string, string | number> = { name: `${horizonDays}d` };
  for (const k of STACK_ORDER) row[k] = bucketCounts[k];

  const sortedCats = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const total = inWindow.length;
  const topTypes = sortedCats.slice(0, 6).map(([name, count]) => ({
    name,
    count,
    pct: total > 0 ? Math.round((count / total) * 100) : 0,
  }));

  return {
    series,
    stackedRow: row,
    stackKeys: STACK_ORDER,
    topTypes,
    inWindowCount: total,
  };
}
