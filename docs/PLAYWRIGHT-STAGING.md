# Playwright against staging (X3)

Run the existing Playwright suite against a **deployed** environment instead of local `vite preview`.

## Prerequisites

- Staging URL with the app built with **`VITE_E2E_AUTH_BYPASS=1`** if you rely on signed-in bypass specs (`e2e/tier2-flows.spec.ts`, `e2e/viewport-signed-in.spec.ts`). **Do not enable this on production.**
- Optional: a dedicated test org/user if you add real-auth journeys later.

## Command

```bash
export PLAYWRIGHT_BASE_URL="https://your-staging.example.com"
npx playwright test
```

Or one-off:

```bash
PLAYWRIGHT_BASE_URL=https://staging.example.com npx playwright test
```

Align expectations with [docs/TEST-PLAN-TIER2-BACKLOG.md](TEST-PLAN-TIER2-BACKLOG.md) (bypass vs real auth).

## CI (optional)

Add a **manual** or **scheduled** workflow that sets `PLAYWRIGHT_BASE_URL` from a GitHub **environment** or **repository variable** so staging smoke does not run on every PR unless you intend to.
