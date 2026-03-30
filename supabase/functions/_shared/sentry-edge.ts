/**
 * Optional Edge Sentry wiring. Set SENTRY_EDGE_DSN in function secrets when policy allows.
 * Install @sentry/deno (or platform-recommended SDK) before calling initEdgeSentry().
 * See docs/observability.md — Edge Sentry implementation checklist.
 */
export function initEdgeSentry(_opts: { functionName: string }): void {
  const dsn = Deno.env.get("SENTRY_EDGE_DSN") ?? "";
  if (!dsn) return;
  // Integrate @sentry/deno init here after dependency is added to the function import map.
}

export function captureEdgeException(_err: unknown, _context?: Record<string, string>): void {
  if (!Deno.env.get("SENTRY_EDGE_DSN")) return;
  // Forward to Sentry after SDK is wired.
}
