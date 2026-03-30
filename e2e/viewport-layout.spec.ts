import { test, expect } from "@playwright/test";

/** Tier 3: spot-check responsive shell at common breakpoints (no screenshot baselines). */
const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1024, height: 768 },
] as const;

async function dismissGuestGate(page: import("@playwright/test").Page) {
  const guest = page.locator('button:has-text("Continue as guest")');
  try {
    await guest.first().waitFor({ state: "visible", timeout: 15_000 });
    await guest.first().click();
  } catch {
    const skip = page.getByRole("button", { name: /skip|guest|continue/i });
    if ((await skip.count()) > 0) await skip.first().click();
  }
}

for (const vp of viewports) {
  test.describe(`Viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("home loads with main landmark", async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await dismissGuestGate(page);
      await expect(page.locator("#main-content")).toBeVisible({ timeout: 60_000 });
    });

    test("changelog loads", async ({ page }) => {
      await page.goto("/changelog", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /what's new/i })).toBeVisible({
        timeout: 30_000,
      });
    });
  });
}
