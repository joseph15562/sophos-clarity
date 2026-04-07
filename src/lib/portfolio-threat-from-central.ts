import { centralAlertRaisedAt, type CentralAlert } from "@/lib/sophos-central";

/** One day in the area chart (Sophos Central open alerts, not firewall “blocked” counters). */
export type PortfolioThreatSeriesPoint = { date: string; alerts: number };

export type PortfolioThreatStackBucket = "Malware" | "Phishing" | "IPS" | "Web" | "Other";

const STACK_ORDER: PortfolioThreatStackBucket[] = ["Malware", "Phishing", "IPS", "Web", "Other"];

/** MM-DD in local time — matches `MOCK_THREAT_ACTIVITY` labelling style. */
function localDayKey(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m < 10 ? "0" : ""}${m}-${day < 10 ? "0" : ""}${day}`;
}

/**
 * Map Central alert category / product / description into stacked chart buckets
 * (aligned with previous mock labels).
 */
export function mapAlertToThreatBucket(alert: CentralAlert): PortfolioThreatStackBucket {
  const cat = `${alert.category ?? ""}`.toLowerCase();
  const prod = `${alert.product ?? ""}`.toLowerCase();
  const desc = `${alert.description ?? ""}`.toLowerCase();
  const all = `${cat} ${prod} ${desc}`;

  if (
    all.includes("phish") ||
    all.includes("spam") ||
    /\bemail\b/.test(all) ||
    /\bmail\b/.test(all)
  ) {
    return "Phishing";
  }
  // Malware before IPS — Central often sets product to "firewall" for edge events.
  if (
    cat.includes("malware") ||
    desc.includes("malware") ||
    desc.includes("troj") ||
    desc.includes("virus") ||
    desc.includes("ransom") ||
    desc.includes("c2") ||
    desc.includes("callback") ||
    desc.includes("advanced threat") ||
    /\bthreat\b/.test(desc)
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
    all.includes("certificate")
  ) {
    return "Web";
  }
  if (
    all.includes("ips") ||
    all.includes("intrusion") ||
    all.includes("sql injection") ||
    all.includes("packet inspection") ||
    all.includes("xstream") ||
    all.includes("deep packet")
  ) {
    return "IPS";
  }
  return "Other";
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
