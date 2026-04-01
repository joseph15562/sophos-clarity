import { test } from "@playwright/test";
import { expectNoCriticalOrSeriousAxeViolations } from "./axe-assert";

async function expectNoSeriousViolations(pagePath: string, page: import("@playwright/test").Page) {
  await page.goto(pagePath, { waitUntil: "domcontentloaded" });
  await expectNoCriticalOrSeriousAxeViolations(page, pagePath);
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
