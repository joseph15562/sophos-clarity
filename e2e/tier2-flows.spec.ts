import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routeSharedHealthCheckNotFound } from "./public-api-mocks";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, "fixtures");

const e2eEmail = process.env.E2E_USER_EMAIL?.trim();
const e2ePassword = process.env.E2E_USER_PASSWORD?.trim();
const hasAuthCreds = Boolean(e2eEmail && e2ePassword);

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

/** Upload dropzone: prefers data-testid; falls back to tour hook for older bundles. */
function workspaceDropzone(page: import("@playwright/test").Page) {
  return page
    .locator('[data-testid="workspace-upload-dropzone"], [data-tour="step-upload"]')
    .first();
}

test.describe("Tier 2 — workspace upload & analysis", () => {
  test("guest can open upload dropzone", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissGuestGate(page);
    await expect(workspaceDropzone(page)).toBeVisible({ timeout: 30_000 });
  });

  test("upload minimal HTML then see firewall name field", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissGuestGate(page);
    await expect(workspaceDropzone(page)).toBeVisible({ timeout: 30_000 });

    const fileChooserPromise = page.waitForEvent("filechooser");
    await workspaceDropzone(page).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles(path.join(fixtureDir, "minimal-config.html"));

    await expect(page.getByPlaceholder(/firewall name/i)).toBeVisible({ timeout: 60_000 });
  });

  test("invalid extension is ignored (no new file row)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissGuestGate(page);
    await expect(workspaceDropzone(page)).toBeVisible({ timeout: 30_000 });

    const fileChooserPromise = page.waitForEvent("filechooser");
    await workspaceDropzone(page).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a config"),
    });

    await expect(page.getByText(/Drop your Sophos firewall export here/i)).toBeVisible();
    await expect(page.getByPlaceholder(/firewall name/i)).toHaveCount(0);
  });
});

test.describe("Tier 2 — SE health check shell", () => {
  test("health check route shows SE shell or auth gate", async ({ page }) => {
    await page.goto("/health-check", { waitUntil: "domcontentloaded" });
    const inner = page.getByTestId("se-health-check-root");
    const gate = page.getByTestId("se-health-check-auth-gate");
    await expect(inner.or(gate)).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /Sophos Firewall Health Check|Sophos SE Health Check/i }),
    ).toBeVisible();
  });
});

/** Legacy print stub (optional); PDF export now uses real download when `VITE_E2E_PDF_DOWNLOAD=1`. */
async function addPrintStub(context: import("@playwright/test").BrowserContext) {
  await context.addInitScript(() => {
    const origOpen = window.open.bind(window);
    window.open = (...args: Parameters<typeof window.open>) => {
      const child = origOpen(...args);
      if (child) {
        child.print = () => {
          try {
            if (child.opener) {
              (child.opener as Window & { __E2E_PDF_PRINT__?: boolean }).__E2E_PDF_PRINT__ = true;
            }
          } catch {
            /* ignore cross-window */
          }
        };
      }
      return child;
    };
  });
}

test.describe("Tier 2 — signed-in hub (E2E bypass, no secrets)", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.setItem("sophos-firecomply-setup-complete", "true");
    });
    await addPrintStub(context);
  });

  test("bypass: workspace shows report controls after upload", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(workspaceDropzone(page)).toBeVisible({ timeout: 30_000 });
    const fileChooserPromise = page.waitForEvent("filechooser");
    await workspaceDropzone(page).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles(path.join(fixtureDir, "minimal-config.html"));
    await expect(page.getByPlaceholder(/firewall name/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("workspace-report-cards")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("generate-one-pager")).toBeVisible();
  });

  test("bypass journey: upload → executive one-pager → Word + PDF print stub", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(workspaceDropzone(page)).toBeVisible({ timeout: 30_000 });
    const fileChooserPromise = page.waitForEvent("filechooser");
    await workspaceDropzone(page).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles(path.join(fixtureDir, "minimal-config.html"));
    await expect(page.getByPlaceholder(/firewall name/i)).toBeVisible({ timeout: 60_000 });

    await page.getByTestId("generate-one-pager").click();
    await expect(page.getByTestId("export-download-pdf")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("export-download-word")).toBeVisible();

    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByTestId("export-download-word").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().toLowerCase()).toMatch(/\.docx$/i);

    const pdfDownloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByTestId("export-download-pdf").click();
    const pdfDl = await pdfDownloadPromise;
    expect(pdfDl.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/i);
  });
});

test.describe("Tier 2 — signed-in hub (optional GitHub secrets)", () => {
  /** Stub print on print preview windows so PDF path is testable without a system print dialog. */
  test.beforeEach(async ({ context }) => {
    await addPrintStub(context);
  });

  test("sign in and reach workspace with report controls", async ({ page }) => {
    test.skip(!hasAuthCreds, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const signIn = page.getByRole("button", { name: /^sign in$/i }).first();
    if (await signIn.isVisible().catch(() => false)) {
      await signIn.click();
    }
    const emailInput = page.getByLabel(/email/i).first();
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
    await emailInput.fill(e2eEmail!);
    await page
      .getByLabel(/password/i)
      .first()
      .fill(e2ePassword!);
    await page
      .getByRole("button", { name: /sign in|log in/i })
      .first()
      .click();

    await expect(workspaceDropzone(page)).toBeVisible({ timeout: 60_000 });
    const fileChooserPromise = page.waitForEvent("filechooser");
    await workspaceDropzone(page).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles(path.join(fixtureDir, "minimal-config.html"));
    await expect(page.getByPlaceholder(/firewall name/i)).toBeVisible({ timeout: 60_000 });

    await expect(page.getByTestId("workspace-report-cards")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("generate-one-pager")).toBeVisible();
  });

  /**
   * Upload → Executive One-Pager (sync, local markdown from parsed config) → export.
   * PDF: `window.open` + `print()` — init script stubs `print` on the child window and sets
   * `opener.__E2E_PDF_PRINT__` (no OS print dialog). Word: `saveAs` — assert `.docx` download.
   * CI without secrets: journey still skipped; optional future work: `page.route` mocks for auth.
   * With secrets: set GitHub E2E_USER_EMAIL + E2E_USER_PASSWORD.
   */
  test("signed-in journey: upload → executive one-pager → export affordances + Word download", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    test.skip(!hasAuthCreds, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const signIn = page.getByRole("button", { name: /^sign in$/i }).first();
    if (await signIn.isVisible().catch(() => false)) {
      await signIn.click();
    }
    const emailInput = page.getByLabel(/email/i).first();
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
    await emailInput.fill(e2eEmail!);
    await page
      .getByLabel(/password/i)
      .first()
      .fill(e2ePassword!);
    await page
      .getByRole("button", { name: /sign in|log in/i })
      .first()
      .click();

    await expect(workspaceDropzone(page)).toBeVisible({ timeout: 60_000 });
    const fileChooserPromise = page.waitForEvent("filechooser");
    await workspaceDropzone(page).click();
    const chooser = await fileChooserPromise;
    await chooser.setFiles(path.join(fixtureDir, "minimal-config.html"));
    await expect(page.getByPlaceholder(/firewall name/i)).toBeVisible({ timeout: 60_000 });

    await page.getByTestId("generate-one-pager").click();

    await expect(page.getByTestId("export-download-pdf")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("export-download-word")).toBeVisible();

    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByTestId("export-download-word").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().toLowerCase()).toMatch(/\.docx$/i);

    const pdfDownloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByTestId("export-download-pdf").click();
    const pdfDl = await pdfDownloadPromise;
    expect(pdfDl.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/i);
  });
});

test.describe("Tier 2 — hub & API routes", () => {
  test("API hub shows REST API documentation", async ({ page }) => {
    await page.goto("/api", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /API & Integrations/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /API Explorer/i }).click();
    await expect(page.getByRole("heading", { name: /^Authentication$/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: /GET \/api\/assessments/i }).first(),
    ).toBeVisible();
  });

  test("report centre shell loads", async ({ page }) => {
    await page.goto("/reports", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/report/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test("fleet command route renders", async ({ page }) => {
    await page.goto("/command", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });

  test("shared health check invalid token shows error state", async ({ page }) => {
    await routeSharedHealthCheckNotFound(page);
    await page.goto("/health-check/shared/invalid-token-e2e", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/not found|invalid|expired|could not|error/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
