import { defineConfig, devices } from "@playwright/test";

/** Preview/staging base URL (optional). Defaults to local Vite dev server. */
const stagingBase = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = stagingBase || "http://localhost:5173";

/*
  Signed-in workspace E2E:
  - Default: `VITE_E2E_AUTH_BYPASS=1` is passed to the local webServer (and CI builds with it) so
    loopback runs synthesize an admin session — see src/lib/e2e-auth-bypass.ts + use-auth.
  - Optional: E2E_USER_EMAIL + E2E_USER_PASSWORD still enable the legacy "real sign-in" tests in
    e2e/tier2-flows.spec.ts for staging against a live project.
*/

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(stagingBase
    ? {}
    : {
        webServer: {
          command: process.env.CI
            ? "npx vite preview --host 127.0.0.1 --strictPort --port 4173"
            : "npm run dev -- --host 127.0.0.1 --port 4173",
          url: "http://127.0.0.1:4173",
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: {
            ...process.env,
            /** Loopback-only auth bypass for signed-in E2E without E2E_USER_* secrets (see use-auth + e2e/tier2-flows). */
            VITE_E2E_AUTH_BYPASS: "1",
          },
        },
      }),
});
