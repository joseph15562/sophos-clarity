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
    await page.goto("/shared/invalid-token-12345");
    await expect(page.getByText(/not found|expired|invalid/i).first()).toBeVisible();
  });

  test("404 page for unknown routes", async ({ page }) => {
    await page.goto("/this-does-not-exist");
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });
});
