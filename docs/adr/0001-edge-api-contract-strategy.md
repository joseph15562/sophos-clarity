# ADR 0001: Edge API contract strategy

## Status

Accepted (2026-03)

## Context

The Supabase `api` function exposes many routes to the SPA, connectors, and service keys. Without a shared contract, validation and documentation drift from implementation.

## Decision

1. **Runtime validation:** Use **Zod** in `supabase/functions/_shared/api-schemas.ts` (and route-local schemas when needed). On `safeParse` failure, return `400` with a generic message and emit structured **`logJson`** (no raw user payload in logs).
2. **Documentation:** Maintain a **partial OpenAPI 3** sketch at `docs/api/openapi.yaml`, linked from `docs/api/edge-routes.md`. Expand paths when shipping or changing public contracts.
3. **In-app explorer:** Keep `ApiDocumentation.tsx` as the human-friendly subset; align high-traffic paths with OpenAPI and Zod over time.

## Consequences

- New or changed POST/PUT/PATCH bodies should add or update Zod schemas and bump OpenAPI where the route is public/partner-facing.
- Full OpenAPI coverage is incremental; the file is explicitly “partial” until the surface is stable enough to generate from a single source of truth.
