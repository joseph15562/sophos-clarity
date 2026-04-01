import { test, expect } from "@playwright/test";

/**
 * Optional visual baseline: run with `npx playwright test e2e/visual-smoke.spec.ts --update-snapshots`
 * after intentional UI changes. Not required in default CI (snapshots are environment-sensitive).
 */
test.describe("Visual smoke (opt-in snapshots)", () => {
  test.skip(
    !process.env.PLAYWRIGHT_UPDATE_SNAPSHOTS && !process.env.CI_VISUAL_SNAPSHOTS,
    "Set PLAYWRIGHT_UPDATE_SNAPSHOTS=1 or CI_VISUAL_SNAPSHOTS=1 to run snapshot assertions",
  );

  test("home guest shell", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveScreenshot("home-guest.png", {
      maxDiffPixels: 500,
      animations: "disabled",
    });
  });
});
