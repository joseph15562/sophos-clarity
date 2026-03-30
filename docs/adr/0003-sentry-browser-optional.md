# ADR 0003: Optional Sentry in the SPA

## Status

Accepted (2026-03)

## Context

Production error visibility for the static app requires an opt-in client reporter without forcing a vendor on self-hosted builds.

## Decision

- Initialise **`@sentry/react`** in [`src/init-sentry.ts`](../../src/init-sentry.ts) only when **`VITE_SENTRY_DSN`** is non-empty.
- Use **`sendDefaultPii: false`** and low **`tracesSampleRate`** in production; operators enable or omit DSN per environment.

## Consequences

- No Sentry account required for local or self-hosted builds that leave the variable unset.
- Edge observability remains separate (structured logs / drains); see [`docs/SELF-HOSTED.md`](../SELF-HOSTED.md).
