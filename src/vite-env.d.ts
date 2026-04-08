/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Sentry browser DSN; leave unset to disable client error reporting */
  readonly VITE_SENTRY_DSN?: string;
  /**
   * Legacy: was required for Playwright to get a real PDF before product switched to pdfmake.
   * Kept for compatibility; CI may still set it — harmless.
   */
  readonly VITE_E2E_PDF_DOWNLOAD?: string;
}

declare module "*.html?raw" {
  const content: string;
  export default content;
}
