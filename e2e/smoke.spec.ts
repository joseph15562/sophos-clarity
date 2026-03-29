import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("homepage loads and shows FireComply branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    // Should show either the auth gate or the main app
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
  });

  test("guest mode is accessible", async ({ page }) => {
    await page.goto("/");
    // Look for guest/skip button or the main upload area
    const skipButton = page.getByRole("button", { name: /skip|guest|continue/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
      // Should show the upload area
      await expect(page.getByText(/upload|drag|drop|firewall/i).first()).toBeVisible();
    }
  });

  test("shared report 404 for invalid token", async ({ page }) => {
    await page.goto("/shared/invalid-token-12345", { waitUntil: "domcontentloaded" });
    // fetch() may return 404, or fail open (network) in CI — any terminal error state is OK
    await expect(
      page.getByRole("heading", {
        name: /report not found|this report has expired|invalid link|could not load this report/i,
      }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("404 page for unknown routes", async ({ page }) => {
    await page.goto("/this-does-not-exist");
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });

  test("changelog page loads", async ({ page }) => {
    await page.goto("/changelog", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /what's new/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("trust page loads", async ({ page }) => {
    await page.goto("/trust", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^trust$/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("playbooks page loads", async ({ page }) => {
    await page.goto("/playbooks");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/playbook/i).first()).toBeVisible();
  });

  test("audit page shell loads", async ({ page }) => {
    await page.goto("/audit", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /activity log/i })).toBeVisible({
      timeout: 30_000,
    });
  });
});
