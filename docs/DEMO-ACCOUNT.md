# Demo Account Setup

Public demo mode lets visitors try a fully populated workspace without creating an
account. A **Demo mode** button appears on the login page; clicking it obtains a
real Supabase session via the `public-demo-session` Edge Function — the demo
password never reaches the browser.

## One-time setup

### 1. Choose demo credentials

Pick an email and a strong random password. These are **server secrets only**.

```
DEMO_AUTH_EMAIL=demo@firecomply.example
DEMO_AUTH_PASSWORD=<random 32-char password>
```

### 2. Seed the demo workspace

The seed script creates the Auth user, organisation, customers, Central data,
agents, portals, assessments, and reports.

```bash
SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
DEMO_AUTH_EMAIL="demo@firecomply.example" \
DEMO_AUTH_PASSWORD="<password>" \
  deno run --allow-env --allow-net scripts/seed-demo-workspace.ts
```

The script is idempotent — re-run it to reset the demo data.

### 3. Set Edge Function secrets

In the Supabase Dashboard (or via CLI):

```bash
supabase secrets set \
  DEMO_AUTH_EMAIL="demo@firecomply.example" \
  DEMO_AUTH_PASSWORD="<password>" \
  DEMO_ORG_ID="a0000000-demo-0000-0000-000000000001"
```

### 4. Deploy the Edge Function

```bash
supabase functions deploy public-demo-session --no-verify-jwt
```

### 5. Enable the client flag

In your deployment environment (Vercel, `.env.local`, etc.):

```
VITE_PUBLIC_DEMO_ENABLED=1
```

The button only renders when this flag is `"1"`.

## Architecture

```
Browser ──POST──▶ public-demo-session Edge Function
                    │
                    ▼
                  signInWithPassword(DEMO_AUTH_* secrets)
                    │
                    ▼
                  return { access_token, refresh_token }
                    │
Browser ◀──────────┘
  │
  ▼
supabase.auth.setSession(...)  →  normal RLS queries on seeded data
  │
  ▼
sophos-central Edge  →  detects DEMO_ORG_ID  →  returns canned JSON
```

- The demo user is a regular Supabase Auth user (admin role in the demo org).
- `sophos-central` Edge Function intercepts requests for `DEMO_ORG_ID` and
  returns canned responses (status, tenants, firewalls, alerts, licences) without
  calling the live Sophos API.
- `connect` / `disconnect` are blocked for the demo org.

## Rate limiting

The Edge Function uses a simple in-memory per-IP counter (10 requests/minute).
For higher traffic, wire up Upstash Redis (same pattern as `portal-data`).

## Resetting demo data

Re-run the seed script. The demo user can create assessments and reports during
their session — a future cron could reset the org nightly if needed.

## Rotating credentials

1. Generate a new password.
2. Update `DEMO_AUTH_PASSWORD` in Supabase secrets.
3. Re-run the seed script (updates the Auth user password).
4. Redeploy the Edge Function.

## Demo workspace contents

| Data                        | Count                          |
| --------------------------- | ------------------------------ |
| Customers (Central tenants) | 10                             |
| Countries                   | 7 (UK, DE, FR, SE, US, JP, AU) |
| Firewalls (incl. HA pairs)  | 51                             |
| Agents                      | 51                             |
| Assessments                 | 10                             |
| Saved reports               | 3                              |
| Client portals              | 3                              |

The global customer **Atlas Global Industries** has firewalls distributed across
5 countries (US, UK, DE, JP, AU) with per-firewall compliance country settings.
