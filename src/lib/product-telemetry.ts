import { warnOptionalError } from "@/lib/client-error-feedback";

/**
 * Product funnel events: console in dev; optional POST to `VITE_ANALYTICS_INGEST_URL`.
 * Point the URL at a PostHog HTTP API proxy, your own ingestor, or any JSON `POST` receiver;
 * payload shape: `{ event, props, ts, path }` (`path` = current pathname when `window` exists).
 */
export function trackProductEvent(event: string, props?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.debug("[product-telemetry]", event, props ?? {});
  }
  const url = import.meta.env.VITE_ANALYTICS_INGEST_URL;
  if (typeof url !== "string" || !url.trim()) return;
  const body = JSON.stringify({
    event,
    props: props ?? {},
    ts: Date.now(),
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
  });
  void fetch(url.trim(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch((e) => {
    warnOptionalError("product-telemetry.ingest", e);
  });
}
