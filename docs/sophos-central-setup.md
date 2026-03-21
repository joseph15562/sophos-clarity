# Sophos Central API Integration — Setup Guide

## Overview

Sophos FireComply can connect to your Sophos Central account to enrich firewall assessments with live data: firmware versions, licence status, active alerts, HA peer health, and MDR threat intelligence. This guide walks you through linking your account.

## Prerequisites

- A **Sophos Central** account (Partner, Organization, or single-tenant Admin)
- **Super Admin** or **Admin** role in Sophos Central
- A FireComply account with an organisation created

## Understanding Account Types

| Type | Who uses it | What it enables |
|------|-------------|-----------------|
| **Partner** | MSPs, VARs, Distributors | See all managed customer tenants and their firewalls |
| **Organization** | Enterprises with sub-estates | See all tenants within the organisation |
| **Tenant** | Single customer | See firewalls in your own estate only |

FireComply auto-detects your account type after connecting.

## Step-by-Step Setup

### 1. Create API Credentials in Sophos Central

1. Sign in to [Sophos Central](https://central.sophos.com)
   - **Partners**: Go to the Partner dashboard
   - **Customers**: Go to Sophos Central Admin
2. Navigate to **Settings & Policies** > **API Credentials Management**
3. Click **Add Credential**
4. Enter a name (e.g., `FireComply`) and optional description
5. Select role: **Service Principal Read-Only** (recommended — FireComply only reads data)
6. Click **Add**
7. **Copy the Client ID** — you'll need this in FireComply
8. **Show and copy the Client Secret** — this is only displayed once. Store it securely.

### 2. Connect in FireComply

1. Sign in to FireComply
2. Scroll to the **Sophos Central Integration** section (within Multi-Tenant Dashboard)
3. Enter your **Client ID** and **Client Secret**
4. Click **Connect**
5. FireComply will validate your credentials, determine your account type, and display the connection status

### 3. Sync Tenants (Partner/Organization only)

After connecting, click **Sync Tenants** to pull your customer list from Sophos Central. This populates the Customer Name dropdown with your managed tenants.

### 4. Link Firewalls to Configs

When you upload a firewall config export:
- FireComply attempts to auto-match by hostname
- You can also manually enter a serial number or select from a dropdown
- Once linked, the association is saved for future assessments

## API Roles Explained

| Role | Permissions | Recommended? |
|------|-------------|--------------|
| Service Principal Read-Only | View endpoints, alerts, firewalls, licences | Yes |
| Service Principal Management | Above + manage endpoints/policies | No (unnecessary) |
| Service Principal Super Admin | Full CRUD access | No (over-privileged) |
| Service Principal Forensics | Live Discover queries | No (not used) |

**FireComply only needs read-only access.** It never modifies your Sophos Central configuration.

## Security

- Your **Client Secret is encrypted** (AES-256-GCM) before being stored in the database
- The encryption key is held server-side and never exposed to the browser
- All Sophos API calls are proxied through a secure backend (Supabase Edge Function)
- Your credentials are scoped to your FireComply organisation via Row Level Security
- You can disconnect at any time to delete all stored credentials

## Data Accessed

FireComply reads the following from your Sophos Central account:

| API | Data | Purpose |
|-----|------|---------|
| WhoAmI | Account type, partner ID | Determine flow (partner vs. tenant) |
| Tenants | Customer names, data regions | Populate customer dropdown |
| Firewalls | Serial, hostname, firmware, model, status, HA | Enrich reports with live device data |
| Firewall Groups | Group names, assignments | Organise firewalls by site/location |
| Alerts | Security, health, connectivity alerts | Surface active issues in reports |
| Licences | Type, expiry date, product code | Licence expiry monitoring |
| MDR Threat Feed | Active threat indicators | Threat intelligence enrichment |

## Rate Limits

Sophos Central enforces the following rate limits per credential set:

- 10 requests/second
- 100 requests/minute
- 1,000 requests/hour
- 200,000 requests/day

FireComply caches data to minimise API calls. Tenant and firewall data is cached for 15 minutes.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Sophos auth failed (401)` | Invalid Client ID or Secret | Re-check credentials in Sophos Central |
| `Sophos auth failed (403)` | Credentials expired or insufficient role | Create new credentials with Read-Only role |
| `WhoAmI failed` | Token was rejected | Disconnect and reconnect with fresh credentials |
| `Tenant not found. Sync tenants first.` | Tenant cache is empty | Click "Sync Tenants" to refresh |
| `CENTRAL_ENCRYPTION_KEY not configured` | Server-side env var missing | Set `CENTRAL_ENCRYPTION_KEY` in Supabase Edge Function secrets |
| Rate limit (429) | Too many API calls | Wait and retry. FireComply implements exponential backoff. |

## FAQ

**Can I use read-only credentials?**
Yes. Service Principal Read-Only is the recommended role. FireComply never writes to Sophos Central.

**What if I rotate my credentials?**
Disconnect in FireComply, create new credentials in Sophos Central, then reconnect with the new values.

**How do I disconnect?**
Click the "Disconnect" button in the Sophos Central Integration section. This deletes all stored credentials and cached data.

**Does this work with the free Supabase tier?**
Yes. The integration uses standard Supabase tables, Edge Functions, and Row Level Security — all available on the free tier.

**Can multiple staff in my organisation use the same Central link?**
Yes. Credentials are stored per organisation, not per user. All members of your FireComply organisation share the same Central connection.

## Developer / API parity (maintainers)

For a mapping of implemented Central routes to Sophos’s official Postman collection and drift watchlist items, see [sophos-central-api-notes.md](./sophos-central-api-notes.md).
