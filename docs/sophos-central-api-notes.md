# Sophos Central API — FireComply implementation vs Postman

This document maps **FireComply**’s server-side Sophos Central proxy ([`supabase/functions/sophos-central/index.ts`](../supabase/functions/sophos-central/index.ts)) to the official **Postman collection** ([sophos/sophos-central-apis-postman](https://github.com/sophos/sophos-central-apis-postman)). Use Postman for manual regression when Sophos changes APIs.

## Auth (not a Central “data region” call)

| Flow                      | Our implementation                               | Postman                                    |
| ------------------------- | ------------------------------------------------ | ------------------------------------------ |
| OAuth2 client credentials | `POST https://id.sophos.com/api/v2/oauth2/token` | Same pattern in collection env             |
| WhoAmI                    | `GET https://api.central.sophos.com/whoami/v1`   | `https://api.central.sophos.com/whoami/v1` |

## Implemented in Edge Function (`mode` in request body)

All tenant-scoped calls use `Authorization: Bearer <token>` plus **`X-Tenant-ID`** (and partner/org headers where noted).

| `mode`              | Method / path (effective)                                           | Headers                               | Notes                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `connect`           | Token + WhoAmI                                                      | —                                     | Stores `partner_id`, `partner_type`, `api_hosts`                                                                                                                   |
| `disconnect`        | DB only                                                             | —                                     |                                                                                                                                                                    |
| `status`            | DB only                                                             | —                                     |                                                                                                                                                                    |
| `tenants`           | `GET .../partner/v1/tenants` or `.../organization/v1/tenants`       | `X-Partner-ID` or `X-Organization-ID` | Tenant-type accounts: `GET {apiHost}/organization/v1/tenants` with `X-Tenant-ID` for display name                                                                  |
| `firewalls`         | `GET {apiHost}/firewall/v1/firewalls`                               | `X-Tenant-ID`                         | Paginated (`page`, `pageSize`, `pageTotal`)                                                                                                                        |
| `firewall-groups`   | `GET {apiHost}/firewall/v1/firewall-groups`                         | `X-Tenant-ID`                         |                                                                                                                                                                    |
| `alerts`            | `GET {apiHost}/common/v1/alerts`                                    | `X-Tenant-ID`                         | Paginated; we pass `sort=raisedAt:desc` and keep fetching when `pages.total` is missing (Sophos sometimes omits it — without that, only the first page was loaded) |
| `licenses`          | `GET https://api.central.sophos.com/licenses/v1/licenses`           | `X-Tenant-ID`                         | Single GET (not paginated helper)                                                                                                                                  |
| `firewall-licenses` | `GET https://api.central.sophos.com/licenses/v1/licenses/firewalls` | Partner/org/tenant headers            | Paginated                                                                                                                                                          |
| `mdr-threat-feed`   | `GET {apiHost}/firewall/v1/mdr-threat-feed`                         | `X-Tenant-ID`                         | On failure returns empty `items` + note                                                                                                                            |

`{apiHost}` is the tenant’s regional API host from cached `central_tenants.api_host` (or WhoAmI for single-tenant credentials).

## Postman parity / drift watchlist

- **MDR threat feed:** Postman (current) includes paths under `firewall/v1/firewall-config/firewalls/:firewallId/mdr-threat-feed/...`. We call **`/firewall/v1/mdr-threat-feed`** at tenant scope. If Sophos deprecates the tenant-level URL, align with Postman + [developer.sophos.com](https://developer.sophos.com/).
- **Pagination:** We use `page`, `pageSize`, `pageTotal=true` on first page — confirm against latest API docs for each listing endpoint.
- **Licensing:** `licenses/v1/licenses` vs `licenses/v1/licenses/firewalls` — both appear in Postman; we use both for different UI features.

## Candidate endpoints (not implemented)

Useful for future features; verify licence and tenant type before building product on them:

- `common/v1/alerts/search` — filtered alert queries vs full list
- `firewall/v1/firewalls/:firewallId` — single appliance detail / actions
- `account-health-check/v1/*` — health scores (different product surface)
- Partner admin/roles under `partner/v1/admins` — MSP console management, not firewall assessment

## How to verify manually

1. Clone or download [Sophos Central APIs.postman_collection.json](https://github.com/sophos/sophos-central-apis-postman/blob/main/Sophos%20Central%20APIs.postman_collection.json).
2. Import into Postman v11+ per upstream README.
3. Run the same flows as `mode` values above with the same `X-Tenant-ID` / partner headers.
4. Compare JSON shape to what the app caches in `central_tenants` / `central_firewalls`.
