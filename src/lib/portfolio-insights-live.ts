import type { ScoreHistoryEntry } from "@/lib/score-history";
import type { RecommendationCard } from "@/lib/mock-data";

/** Stable ASCII key for Recharts `dataKey` (category label from risk score). */
export function categoryLabelToDataKey(label: string): string {
  return label.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "category";
}

const TREND_LINE_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ec4899"] as const;

export type PortfolioCategoryTrendLine = { key: string; name: string; color: string };

export type PortfolioCategoryTrendRow = Record<string, string | number | null>;

/**
 * Monthly average of assessment category scores from `score_history` (same labels as Assess risk categories).
 */
export function buildCategoryTrendFromScoreHistory(
  entries: ScoreHistoryEntry[],
  options?: { maxLines?: number; maxMonths?: number },
): { rows: PortfolioCategoryTrendRow[]; lines: PortfolioCategoryTrendLine[] } {
  const maxLines = options?.maxLines ?? 5;
  const maxMonths = options?.maxMonths ?? 8;

  if (!entries.length) {
    return { rows: [], lines: [] };
  }

  const sorted = [...entries].sort((a, b) => a.assessed_at.localeCompare(b.assessed_at));

  const labelWeights = new Map<string, number>();
  for (const e of sorted) {
    for (const c of e.category_scores ?? []) {
      if (typeof c.score !== "number") continue;
      labelWeights.set(c.label, (labelWeights.get(c.label) ?? 0) + 1);
    }
  }

  const topLabels = [...labelWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxLines)
    .map(([label]) => label);

  if (topLabels.length === 0) {
    return { rows: [], lines: [] };
  }

  const lines: PortfolioCategoryTrendLine[] = topLabels.map((name, i) => ({
    key: categoryLabelToDataKey(name),
    name,
    color: TREND_LINE_COLORS[i % TREND_LINE_COLORS.length],
  }));

  const entriesByMonth = new Map<string, ScoreHistoryEntry[]>();
  for (const e of sorted) {
    const d = new Date(e.assessed_at);
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const arr = entriesByMonth.get(sortKey) ?? [];
    arr.push(e);
    entriesByMonth.set(sortKey, arr);
  }

  const monthKeys = [...entriesByMonth.keys()].sort();

  const rows: PortfolioCategoryTrendRow[] = monthKeys.slice(-maxMonths).map((mk) => {
    const bucket = entriesByMonth.get(mk)!;
    const d = new Date(`${mk}-01T12:00:00`);
    const row: PortfolioCategoryTrendRow = {
      month: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
    };
    for (const line of lines) {
      const vals: number[] = [];
      for (const e of bucket) {
        const sc = e.category_scores?.find((c) => c.label === line.name)?.score;
        if (typeof sc === "number") vals.push(sc);
      }
      row[line.key] = vals.length
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : null;
    }
    return row;
  });

  return { rows, lines };
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local Monday 00:00 (weeks bucket saved reports + assessment saves). */
function startOfLocalWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const daysSinceMonday = (day + 6) % 7;
  x.setDate(x.getDate() - daysSinceMonday);
  return x;
}

function parseTimestamp(iso: string): Date | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
}

export type ReportActivityWeekBar = {
  weekKey: string;
  weekLabel: string;
  count: number;
};

export type ReportActivityRecentDay = {
  dateKey: string;
  dateLabel: string;
  count: number;
};

export type ReportActivityPanelModel = {
  weekBars: ReportActivityWeekBar[];
  recentDays: ReportActivityRecentDay[];
  totalSavesInWindow: number;
  daysWithActivity: number;
  peakDayCount: number;
};

/**
 * Human-readable activity: weekly bar totals + recent days with saves (saved reports + assessment saves).
 * Weeks are calendar weeks starting Monday, oldest bar on the left, current week on the right.
 */
export function buildReportActivityPanel(
  timestamps: string[],
  options?: { numWeeks?: number; recentDaysLimit?: number },
): ReportActivityPanelModel {
  const numWeeks = options?.numWeeks ?? 10;
  const recentDaysLimit = options?.recentDaysLimit ?? 14;

  const dayCounts = new Map<string, number>();
  const weekCounts = new Map<string, number>();

  for (const iso of timestamps) {
    const d = parseTimestamp(iso);
    if (!d) continue;
    const dk = localDayKey(d);
    dayCounts.set(dk, (dayCounts.get(dk) ?? 0) + 1);
    const wk = localDayKey(startOfLocalWeekMonday(d));
    weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1);
  }

  const totalSavesInWindow = [...dayCounts.values()].reduce((a, b) => a + b, 0);
  const positiveDays = [...dayCounts.values()].filter((n) => n > 0);
  const daysWithActivity = positiveDays.length;
  const peakDayCount = positiveDays.length ? Math.max(...positiveDays) : 0;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const currentWeekStart = startOfLocalWeekMonday(today);

  const weekBars: ReportActivityWeekBar[] = [];
  for (let i = 0; i < numWeeks; i++) {
    const ws = new Date(currentWeekStart);
    ws.setDate(ws.getDate() - (numWeeks - 1 - i) * 7);
    const key = localDayKey(ws);
    weekBars.push({
      weekKey: key,
      weekLabel: ws.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      count: weekCounts.get(key) ?? 0,
    });
  }

  const recentDays: ReportActivityRecentDay[] = [...dayCounts.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, recentDaysLimit)
    .map(([k, count]) => {
      const d = new Date(`${k}T12:00:00`);
      return {
        dateKey: k,
        dateLabel: d.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        count,
      };
    });

  return {
    weekBars,
    recentDays,
    totalSavesInWindow,
    daysWithActivity,
    peakDayCount,
  };
}

/** Static demo panel for guests (not tied to real dates). */
export function mockReportActivityPanelDemo(): ReportActivityPanelModel {
  const demoCounts = [0, 1, 2, 0, 3, 1, 0, 2, 1, 4];
  const weekBars: ReportActivityWeekBar[] = demoCounts.map((count, i) => ({
    weekKey: `demo-w${i}`,
    weekLabel: `Demo ${i + 1}`,
    count,
  }));
  return {
    weekBars,
    recentDays: [
      { dateKey: "demo-1", dateLabel: "Thu, 3 Apr 2026 (sample)", count: 2 },
      { dateKey: "demo-2", dateLabel: "Mon, 31 Mar 2026 (sample)", count: 1 },
      { dateKey: "demo-3", dateLabel: "Fri, 21 Mar 2026 (sample)", count: 3 },
    ],
    totalSavesInWindow: 0,
    daysWithActivity: 0,
    peakDayCount: 0,
  };
}

export interface PortfolioCustomerRow {
  name: string;
  score: number;
  daysSinceAssessment: number;
  criticalFindings: number;
}

export function buildPortfolioRecommendations(
  customers: PortfolioCustomerRow[],
): RecommendationCard[] {
  const out: RecommendationCard[] = [];
  const used = new Set<string>();

  const sortedRisk = [...customers].sort((a, b) => a.score - b.score);
  for (const c of sortedRisk) {
    if (c.score < 60 && out.length < 6) {
      const id = `live-below-${slugCustomer(c.name)}`;
      if (used.has(id)) continue;
      used.add(id);
      out.push({
        id,
        priority: "P1",
        customer: c.name,
        text: `Below target posture — overall score ${c.score}. Prioritise remediation and re-run Assess when changes land.`,
        effort: c.criticalFindings >= 8 ? "High" : c.criticalFindings >= 4 ? "Med" : "Low",
      });
    }
  }

  const stale = [...customers]
    .filter((c) => c.daysSinceAssessment >= 30)
    .sort((a, b) => b.daysSinceAssessment - a.daysSinceAssessment);
  for (const c of stale) {
    if (out.length >= 6) break;
    const id = `live-stale-${slugCustomer(c.name)}`;
    if (used.has(id)) continue;
    used.add(id);
    out.push({
      id,
      priority: "P2",
      customer: c.name,
      text: `Last assessment ${c.daysSinceAssessment} days ago — schedule a fresh run to refresh findings and score history.`,
      effort: "Low",
    });
  }

  for (const c of sortedRisk) {
    if (out.length >= 6) break;
    if (c.score >= 60 && c.score < 80) {
      const id = `live-harden-${slugCustomer(c.name)}`;
      if (used.has(id)) continue;
      used.add(id);
      out.push({
        id,
        priority: "P3",
        customer: c.name,
        text: `Harden toward grade B — score ${c.score}. Review open findings and rule hygiene on the next assessment cycle.`,
        effort: "Med",
      });
    }
  }

  return out.slice(0, 6);
}

function slugCustomer(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .slice(0, 48)
      .toLowerCase() || "customer"
  );
}
