import * as Sentry from "@sentry/react";

/** Browser error reporting when `VITE_SENTRY_DSN` is set (optional). */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: import.meta.env.PROD ? 0.05 : 1,
  });
}
