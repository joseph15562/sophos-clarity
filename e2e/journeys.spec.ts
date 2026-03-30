import { test, expect } from "@playwright/test";

function workspaceDropzone(page: import("@playwright/test").Page) {
  return page
    .locator('[data-testid="workspace-upload-dropzone"], [data-tour="step-upload"]')
    .first();
}

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

test.describe("User journeys", () => {
  test("guest path reaches main workspace upload affordance", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissGuestGate(page);
    await expect(workspaceDropzone(page)).toBeVisible({ timeout: 30_000 });
  });

  test("config upload route renders shell", async ({ page }) => {
    await page.goto("/upload/invalid-token-e2e-placeholder", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/invalid|not found|expired|link|token/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("playbooks library lists content", async ({ page }) => {
    await page.goto("/playbooks", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/playbook/i).first()).toBeVisible({ timeout: 30_000 });
  });
});
