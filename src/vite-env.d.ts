/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Sentry browser DSN; leave unset to disable client error reporting */
  readonly VITE_SENTRY_DSN?: string;
}

declare module "*.html?raw" {
  const content: string;
  export default content;
}
