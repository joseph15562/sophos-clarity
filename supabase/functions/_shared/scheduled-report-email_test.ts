import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildOnePagerContent,
  computeSimpleScore,
  scheduledReportIdempotencyKey,
} from "./scheduled-report-email.ts";

Deno.test("scheduledReportIdempotencyKey is stable", () => {
  assertEquals(
    scheduledReportIdempotencyKey("rid", "2025-01-01T00:00:00.000Z"),
    "scheduled_report:rid:2025-01-01T00:00:00.000Z",
  );
});

Deno.test("computeSimpleScore + buildOnePagerContent", () => {
  const findings = [
    { title: "A", severity: "high", detail: "" },
    { title: "B", severity: "low", detail: "" },
  ];
  const score = computeSimpleScore(findings);
  const { subject, markdown } = buildOnePagerContent("Acme", findings, score);
  assertEquals(score.overall < 100, true);
  assertEquals(subject.includes("Acme"), true);
  assertEquals(markdown.includes("Top 5"), true);
});
