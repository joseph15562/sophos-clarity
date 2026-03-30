import type { Page } from "@playwright/test";

const json404 = {
  status: 404 as const,
  contentType: "application/json",
  body: JSON.stringify({ error: "Not found" }),
};

/**
 * CI builds omit `.env`; `VITE_SUPABASE_URL` may be empty so fetches hit the Vite preview origin and
 * get SPA HTML (200) instead of Edge JSON — `res.json()` then throws and the UI shows a generic error.
 * Fulfill 404 so public token pages deterministically reach their "not found" copy.
 */
export async function routeSharedHealthCheckNotFound(page: Page) {
  await page.route("**/shared-health-check/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill(json404);
  });
}

export async function routeConfigUploadStatusNotFound(page: Page) {
  await page.route("**/config-upload/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill(json404);
  });
}
