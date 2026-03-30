import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoSeriousViolations(pagePath: string, page: import("@playwright/test").Page) {
  await page.goto(pagePath, { waitUntil: "domcontentloaded" });
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.describe("Accessibility (axe)", () => {
  test("home has no critical/serious axe violations", async ({ page }) => {
    await expectNoSeriousViolations("/", page);
  });

  test("changelog has no critical/serious axe violations", async ({ page }) => {
    await expectNoSeriousViolations("/changelog", page);
  });

  test("trust has no critical/serious axe violations", async ({ page }) => {
    await expectNoSeriousViolations("/trust", page);
  });
});
