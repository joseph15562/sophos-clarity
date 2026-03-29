import { defineConfig, devices } from "@playwright/test";

const stagingBase = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = stagingBase || "http://localhost:5173";

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
            ? "npx vite preview --host 127.0.0.1 --strictPort --port 5173"
            : "npm run dev",
          url: "http://127.0.0.1:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
});
