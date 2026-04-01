# Product analytics — dashboard path

The SPA emits events via **`trackProductEvent`** and optional **`VITE_ANALYTICS_INGEST_URL`** (PostHog-compatible ingest). See [product-telemetry-events.md](product-telemetry-events.md).

**REVIEW “Product 10” checklist:**

1. Point **`VITE_ANALYTICS_INGEST_URL`** at PostHog, a warehouse HTTP sink, or a small collector you operate.
2. Build a **dashboard** (PostHog insights, Metabase, Grafana Loki + JSON parse, etc.) on:
   - **`spa_page_view`** (route transitions)
   - Funnel events listed in **product-telemetry-events.md**
3. Document **new events** in **product-telemetry-events.md** when adding **`trackProductEvent`** calls.

No first-party analytics product is bundled; this stays infrastructure-owned.
