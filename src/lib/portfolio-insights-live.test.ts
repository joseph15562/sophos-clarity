import { describe, expect, it } from "vitest";
import {
  buildCategoryTrendFromScoreHistory,
  buildPortfolioRecommendations,
  buildReportActivityPanel,
  categoryLabelToDataKey,
} from "./portfolio-insights-live";
import type { ScoreHistoryEntry } from "./score-history";

describe("categoryLabelToDataKey", () => {
  it("slugifies labels", () => {
    expect(categoryLabelToDataKey("Web Filtering")).toBe("Web_Filtering");
  });
});

describe("buildCategoryTrendFromScoreHistory", () => {
  it("averages category scores per month", () => {
    const entries: ScoreHistoryEntry[] = [
      {
        id: "1",
        hostname: "a",
        customer_name: "c",
        overall_score: 70,
        overall_grade: "C",
        category_scores: [
          { label: "Web Filtering", score: 80 },
          { label: "Logging", score: 60 },
        ],
        findings_count: 1,
        assessed_at: "2026-03-10T12:00:00Z",
      },
      {
        id: "2",
        hostname: "b",
        customer_name: "c",
        overall_score: 72,
        overall_grade: "C",
        category_scores: [
          { label: "Web Filtering", score: 90 },
          { label: "Logging", score: 70 },
        ],
        findings_count: 2,
        assessed_at: "2026-03-15T12:00:00Z",
      },
    ];
    const { rows, lines } = buildCategoryTrendFromScoreHistory(entries);
    expect(lines.length).toBeGreaterThan(0);
    expect(rows.length).toBe(1);
    const wf = lines.find((l) => l.name === "Web Filtering");
    expect(wf).toBeDefined();
    expect(rows[0][wf!.key]).toBe(85);
  });
});

describe("buildReportActivityPanel", () => {
  it("returns week bars, recent days, and totals", () => {
    const m = buildReportActivityPanel([new Date().toISOString()], {
      numWeeks: 4,
      recentDaysLimit: 5,
    });
    expect(m.weekBars.length).toBe(4);
    expect(m.totalSavesInWindow).toBeGreaterThanOrEqual(1);
    expect(m.daysWithActivity).toBeGreaterThanOrEqual(1);
    expect(m.recentDays.some((d) => d.count >= 1)).toBe(true);
  });
});

describe("buildPortfolioRecommendations", () => {
  it("prioritises low scores", () => {
    const recs = buildPortfolioRecommendations([
      { name: "A", score: 40, daysSinceAssessment: 5, criticalFindings: 2 },
      { name: "B", score: 85, daysSinceAssessment: 2, criticalFindings: 0 },
    ]);
    expect(recs.some((r) => r.customer === "A" && r.priority === "P1")).toBe(true);
  });
});
