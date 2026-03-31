import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Healthy Central status so {@link CentralHealthBanner} stays hidden (avoids contrast noise in axe). */
async function dismissSetupWizardIfPresent(page: Page) {
  const skip = page.getByRole("button", { name: /skip setup/i });
  try {
    await skip.waitFor({ state: "visible", timeout: 4000 });
    await skip.click();
    await expect(skip).toBeHidden({ timeout: 10_000 });
  } catch {
    /* wizard not shown — setup already complete */
  }
}

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
      localStorage.removeItem("sophos-firecomply-session");
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

      test("customers hub renders main landmark", async ({ page }) => {
        await page.goto("/customers", { waitUntil: "domcontentloaded" });
        await expect(page.locator("#main-content")).toBeVisible({ timeout: 60_000 });
        await expect(page.getByRole("heading", { name: /customer management/i })).toBeVisible({
          timeout: 30_000,
        });
      });

      test("assess shell shows analysis after loading demo config", async ({ page }) => {
        test.skip(
          vp.name !== "desktop",
          "Demo parse + analysis UI is covered once on desktop (heavy for CI across all viewports).",
        );
        test.setTimeout(180_000);
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page.locator("#main-content")).toBeVisible({ timeout: 60_000 });
        await dismissSetupWizardIfPresent(page);
        const demoBtn = page.getByRole("button", { name: /try demo config/i });
        await expect(demoBtn).toBeVisible({ timeout: 60_000 });
        await demoBtn.scrollIntoViewIfNeeded();
        await demoBtn.click();
        await expect(page.getByRole("tab", { name: /^overview\b/i })).toBeVisible({
          timeout: 120_000,
        });
      });

      test("management drawer opens and shows workspace controls", async ({ page }) => {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page.locator("#main-content")).toBeVisible({ timeout: 60_000 });
        await page.getByRole("button", { name: /open management panel/i }).click();
        await expect(page.getByText(/workspace controls/i)).toBeVisible({ timeout: 15_000 });
        await page.getByRole("button", { name: /close panel/i }).click();
        await expect(page.getByText(/workspace controls/i)).toBeHidden();
      });
    });
  }
});

test.describe("Signed-in axe (E2E bypass)", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript(() => {
      localStorage.setItem("sophos-firecomply-setup-complete", "true");
      localStorage.removeItem("sophos-firecomply-session");
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

  test("assess view (demo config) has no critical/serious axe violations", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 60_000 });
    await dismissSetupWizardIfPresent(page);
    const demoBtn = page.getByRole("button", { name: /try demo config/i });
    await expect(demoBtn).toBeVisible({ timeout: 60_000 });
    await demoBtn.scrollIntoViewIfNeeded();
    await demoBtn.click();
    await expect(page.getByRole("tab", { name: /^overview\b/i })).toBeVisible({
      timeout: 120_000,
    });
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});

test.describe("Signed-in axe — mobile hub (E2E bypass)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript(() => {
      localStorage.setItem("sophos-firecomply-setup-complete", "true");
      localStorage.removeItem("sophos-firecomply-session");
    });
    await mockSophosCentralStatus(page);
  });

  test("customers hub at 375px has no critical/serious axe violations", async ({ page }) => {
    await page.goto("/customers", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 60_000 });
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
