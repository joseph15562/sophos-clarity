/** Product funnel events: console in dev; optional POST to VITE_ANALYTICS_INGEST_URL. */
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
  }).catch(() => {
    /* ignore network errors */
  });
}
