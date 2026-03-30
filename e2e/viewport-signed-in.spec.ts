import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Healthy Central status so {@link CentralHealthBanner} stays hidden (avoids contrast noise in axe). */
async function mockSophosCentralStatus(page: Page) {
  await page.route("**/functions/v1/sophos-central", async (route) => {
    const req = route.request();
    if (req.method() !== "POST") {
      await route.continue();
      return;
    }
    let body: { mode?: string } = {};
    try {
      body = req.postDataJSON() as { mode?: string };
    } catch {
      await route.continue();
      return;
    }
    if (body.mode === "status") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connected: true,
          last_synced_at: new Date().toISOString(),
        }),
      });
      return;
    }
    await route.continue();
  });
}

/**
 * Responsive + axe smoke on hub routes under loopback E2E auth bypass
 * (`VITE_E2E_AUTH_BYPASS=1` via playwright webServer — see playwright.config.ts).
 */
const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1024, height: 768 },
] as const;

test.describe("Signed-in viewport (E2E bypass)", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript(() => {
      localStorage.setItem("sophos-firecomply-setup-complete", "true");
    });
    await mockSophosCentralStatus(page);
  });

  for (const vp of viewports) {
    test.describe(`Viewport ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("workspace home shows main landmark", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page.locator("#main-content")).toBeVisible({ timeout: 60_000 });
      });

      test("fleet command route renders shell", async ({ page }) => {
        await page.goto("/command", { waitUntil: "domcontentloaded" });
        await expect(page.locator("body")).toBeVisible();
        await expect(page.getByText(/fleet|command|firewall/i).first()).toBeVisible({
          timeout: 30_000,
        });
      });
    });
  }
});

test.describe("Signed-in axe (E2E bypass)", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript(() => {
      localStorage.setItem("sophos-firecomply-setup-complete", "true");
    });
    await mockSophosCentralStatus(page);
  });

  test("workspace home has no critical/serious axe violations", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 60_000 });
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
