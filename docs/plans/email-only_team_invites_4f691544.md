---
name: Email-Only Team Invites
overview: Replace the invite code system with email-only invites. Admin enters a colleague's email, system sends a branded email with a one-click join link. No codes involved. The invite_code column on se_teams is dropped and a new se_team_invites table tracks pending/accepted invites.
todos:
  - id: migration
    content: "Create migration: se_team_invites table, drop invite_code from se_teams"
    status: completed
  - id: edge-invite-routes
    content: Add invite routes (send, accept, list, revoke) and remove code-based join/regenerate routes from edge function
    status: completed
  - id: accept-page
    content: Build TeamInviteAccept page + add route to App.tsx
    status: completed
  - id: drawer-update
    content: "Update both Management Drawers: remove code UI, add email invite + pending invites list"
    status: completed
  - id: cleanup-types
    content: Remove invite_code from SETeam interface and team list/create responses
    status: completed
  - id: deploy
    content: Push migration, deploy edge function, push to GitHub
    status: in_progress
isProject: false
---

# Email-Only Team Invites

## Current State

Teams use an `invite_code` on `se_teams` that is shared manually. A colleague enters the code in the Management drawer to join. This is being replaced with admin-only email invites.

## Changes

### Database

New migration `20250327000000_se_team_email_invites.sql`:

```sql
-- New invites table
create table public.se_team_invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.se_teams(id) on delete cascade,
  invited_by  uuid not null references public.se_profiles(id),
  email       text not null,
  token       text not null unique default gen_random_uuid()::text,
  status      text not null default 'pending'
                check (status in ('pending','accepted','expired')),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- Drop invite_code from se_teams
alter table public.se_teams drop column invite_code;
```

### Edge Function ([supabase/functions/api/index.ts](supabase/functions/api/index.ts))

**Remove:**

- `POST /api/se-teams/join` (join by code)
- `POST /api/se-teams/:id/regenerate-invite`
- `invite_code` from team list/create responses

**Add:**

- `POST /api/se-teams/:id/invite` -- admin sends invite email; body: `{ email }`. Creates `se_team_invites` row, sends branded email with link `APP_URL/team-invite/{token}`. Only `@sophos.com` emails allowed.
- `GET /api/se-teams/accept-invite/:token` -- public-ish route (SE must be signed in). Looks up invite, verifies the signed-in user's email matches, auto-adds them to the team, sets invite status to `accepted`.
- `GET /api/se-teams/:id/invites` -- admin lists pending invites for a team
- `DELETE /api/se-teams/:id/invites/:inviteId` -- admin revokes a pending invite

**Modify:**

- `GET /api/se-teams` -- remove `invite_code` from response
- `POST /api/se-teams` -- no longer returns `invite_code`

### Frontend: Accept Invite Page

New page: `src/pages/TeamInviteAccept.tsx`, route: `/team-invite/:token`

- Branded page (Sophos style, like ConfigUpload)
- If signed in as matching SE: auto-accept, show success, redirect to health check page
- If signed in as different user: show "this invite is for {email}"
- If not signed in: show sign-in prompt, then auto-accept after auth
- If expired/invalid: show appropriate error

Route added to [src/App.tsx](src/App.tsx):

```tsx
<Route path="/team-invite/:token" element={<TeamInviteAccept />} />
```

### Frontend: Management Drawer

Update [src/components/SeHealthCheckManagementDrawer2.tsx](src/components/SeHealthCheckManagementDrawer2.tsx) and [src/components/SeHealthCheckManagementDrawer.tsx](src/components/SeHealthCheckManagementDrawer.tsx):

**Remove:**

- "Join team" section (code input)
- Invite code display on expanded team
- "New invite code" / regenerate button

**Replace with (admin only):**

- "Invite member" section: email input + Send button
- Pending invites list under expanded team (email, status, revoke button)

### Email Template

Branded Sophos email (same style as config upload emails):

- Subject: `You've been invited to join "{team_name}" on Sophos FireComply`
- Body: "{inviter_name} has invited you to join the {team_name} team. Click to accept."
- CTA button: "Join Team"
- Expires after 14 days

### `use-active-team.tsx`

Remove `invite_code` from the `SETeam` interface since it no longer exists.