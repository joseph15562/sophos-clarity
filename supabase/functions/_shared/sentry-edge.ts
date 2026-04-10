import * as Sentry from "https://esm.sh/@sentry/deno@10.46.0";

let _initialised = false;

/**
 * Initialise Sentry for a Supabase Edge Function.
 * Set the `SENTRY_EDGE_DSN` secret via `supabase secrets set`; when absent the SDK
 * stays dormant (zero overhead for local/dev).
 */
export function initEdgeSentry(opts: { functionName: string }): void {
  const dsn = Deno.env.get("SENTRY_EDGE_DSN") ?? "";
  if (!dsn || _initialised) return;
  Sentry.init({
    dsn,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") ?? "production",
    release: Deno.env.get("SENTRY_RELEASE") ?? undefined,
    tracesSampleRate: 0.2,
    initialScope: { tags: { edge_function: opts.functionName } },
  });
  _initialised = true;
}

/**
 * Capture an exception to Sentry with optional structured context.
 * No-ops when the DSN is unset.
 */
export function captureEdgeException(
  err: unknown,
  context?: Record<string, string>,
): void {
  if (!_initialised) return;
  Sentry.withScope((scope) => {
    if (context) {
      for (const [k, v] of Object.entries(context)) scope.setExtra(k, v);
    }
    Sentry.captureException(err);
  });
}
