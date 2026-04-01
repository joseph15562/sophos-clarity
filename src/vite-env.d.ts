/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Sentry browser DSN; leave unset to disable client error reporting */
  readonly VITE_SENTRY_DSN?: string;
  /** When "1", executive PDF uses pdfmake download instead of print() — E2E / CI only */
  readonly VITE_E2E_PDF_DOWNLOAD?: string;
}

declare module "*.html?raw" {
  const content: string;
  export default content;
}
