# FireComply — Tenant model and data isolation

This document describes how multi-tenancy and access control work in FireComply: organisations, roles, and who can see what.

---

## Overview

- **Tenant** = one **organisation** (e.g. one MSP or partner).
- All assessment and portal data is scoped by **organisation ID** (`org_id`). Row Level Security (RLS) in Supabase enforces that users only access their organisation’s data.
- **Guest users** (not signed in) use the app with **local storage only**; no cloud data is read or written. To save or load assessments in the cloud, users must sign in and belong to an organisation.

---

## Organisations and roles

- **Organisations**  
  Each MSP/partner is represented by one organisation (`organisations` table: `id`, `name`, `created_at`). Created when the first user signs up and calls `create_organisation` (see `src/hooks/use-auth.ts`).

- **Org members**  
  Users are linked to an organisation via `org_members` (`org_id`, `user_id`, `role`). Roles are:
  - **admin** — Full control: manage team, invite users, Sophos Central, settings; can run assessments and view everything.
  - **engineer** — Manage agents; run assessments; view reports and dashboards.
  - **member** — Run assessments; view reports and dashboards; no team or agent management.
  - **viewer** — Read-only: view saved assessments and reports; **cannot** run new assessments, generate reports, or save to cloud.

Role checks are used in the app (e.g. `canManageTeam`, `canRunAssessments`, `isViewerOnly`) and should be enforced by the backend/RLS so that viewers cannot trigger report generation or write assessment data.

---

## Who can see what

| User type   | Cloud assessments | Run / generate reports | Save to cloud | Manage team / Central / agents |
|------------|-------------------|-------------------------|---------------|----------------------------------|
| Guest      | No                | Yes (local only)       | No            | No                               |
| Viewer     | Yes (own org only)| No                      | No            | No                               |
| Member     | Yes (own org only)| Yes                     | Yes           | No                               |
| Engineer   | Yes (own org only)| Yes                     | Yes           | Agents only                      |
| Admin      | Yes (own org only)| Yes                     | Yes           | Yes                              |

- **Data isolation**: RLS policies filter rows by `org_id` derived from the authenticated user’s JWT (e.g. via `org_members`). Users in Organisation A cannot see or modify Organisation B’s assessments, portal data, or settings.
- **Guest**: No `org_id`; no cloud reads or writes. All state is in IndexedDB/localStorage.

---

## Client portal (`/portal/:tenantId`)

- **tenantId** can be:
  - A **portal slug** (e.g. a short, shareable name configured per org) — used for public or unauthenticated access; the edge function `portal-data` returns data for that slug.
  - An **organisation UUID** — when the user is authenticated, the app can load portal data via Supabase with RLS so only that org’s data is returned.
- Portal data (score history, findings, compliance, reports, feedback) is always scoped to a single organisation. Slug-based access is read-only and intended for sharing with customers; authenticated access uses the same RLS boundaries.

---

## Implementation references

- **Auth and roles**: `src/hooks/use-auth.ts` — `fetchOrgMembership`, `canManageTeam`, `canRunAssessments`, `isViewerOnly`, etc.
- **Schema and RLS**: Supabase migrations (e.g. `supabase/migrations/001_multi_tenant.sql` or equivalent) define `organisations`, `org_members`, and RLS policies on `assessments` and related tables.
- **Cloud CRUD**: `src/lib/assessment-cloud.ts` — all operations should use the authenticated user’s org; RLS enforces that only rows for that org are returned or updated.
- **Invite flow**: Only **admins** should be able to invite new users; invites associate the new user with the same organisation and a role (e.g. member). See `docs/ROADMAP.md` and `src/components/InviteStaff.tsx`.

---

## Summary

- One **organisation** per MSP/partner; **org_id** on all tenant data.
- **RLS** ensures users only access their org’s data.
- **Viewers** are read-only; they must not be able to run assessments or save to cloud (enforce in UI and backend).
- **Guests** have no cloud access; everything is local.
- **Portal** access is by slug (public) or org id (authenticated), always scoped to one org.
