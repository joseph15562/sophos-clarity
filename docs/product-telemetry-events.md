# Product telemetry events (custom ingest)

When `VITE_ANALYTICS_INGEST_URL` is set, the SPA POSTs JSON payloads via `trackProductEvent` (`src/lib/product-telemetry.ts`). Shape:

```json
{ "event": "string", "props": {}, "ts": 1710000000000, "path": "/command" }
```

**SPA shell:** `spa_page_view` is emitted on route changes where wired (see `src/App.tsx` or layout wrappers).

## Catalog (curated)

| Event                            | When                                                                | Props (typical)      |
| -------------------------------- | ------------------------------------------------------------------- | -------------------- |
| `spa_page_view`                  | Client navigates to a tracked route                                 | `to`, `from` (paths) |
| `manage_deeplink_blocked_viewer` | Viewer opens `/?panel=settings&section=…` for an admin-only section | `section`, `panel`   |

Add new events next to the call site with a one-line note here so operators can build funnels without reading the whole codebase.

## Related

- [docs/observability.md](observability.md) — Edge `logJson` catalogs, drains, Sentry.
