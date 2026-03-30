# ADR 0002: TanStack Query as default for server state

## Status

Accepted (2026-03) — SE Health Check **config upload request list** uses `useQuery` + `queryKeys.seHealthCheck.configUploadRequests` with fetch **`signal`** and **`invalidateQueries`** after mutations (see `use-config-upload.ts`). **Portal viewers** use `queryKeys.portal.viewers`. **PortalConfigurator** uses `queryKeys.portal.tenantBootstrap` for agents + `portal_config` bootstrap, with invalidation after save. **Saved report packages** (drawer library) use `queryKeys.savedReports.packages`. Intentional direct-Supabase exceptions are listed in [`docs/api/client-data-layer.md`](../api/client-data-layer.md).

## Context

The app mixes raw `fetch`, direct `supabase.from` calls, and some `useQuery` / `useMutation`. This complicates cancellation, cache invalidation, and consistent loading/error UX.

## Decision

- **Reads:** Prefer **`useQuery`** with keys from `src/hooks/queries/keys.ts` (`queryKeys`). Pass **`signal`** from the query function where the client supports abort (or tie `AbortController` to effect cleanup for one-off fetches during migration).
- **Writes:** Prefer **`useMutation`** with explicit **`invalidateQueries`** for affected keys.
- **New features:** Default to Query; migrate hot paths (e.g. SE health check, workspace settings) incrementally.

## Consequences

- Reduces duplicate fetches and stale UI after mutations.
- Requires discipline to extend `queryKeys` and avoid ad-hoc string keys.
