import * as Sentry from "@sentry/react";

function sentryEnabled(): boolean {
  return Boolean(import.meta.env.VITE_SENTRY_DSN?.trim());
}

/**
 * Log optional / non-fatal errors (e.g. localStorage quota, font preload).
 * In production with `VITE_SENTRY_DSN`, also sends to Sentry for diagnosis.
 */
export function warnOptionalError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[${context}]`, message);
  if (import.meta.env.PROD && sentryEnabled()) {
    Sentry.captureException(err instanceof Error ? err : new Error(message), {
      tags: { context },
    });
  }
}
