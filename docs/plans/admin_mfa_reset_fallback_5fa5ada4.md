---
name: Admin MFA reset fallback
overview: Add admin ability to reset another user's MFA factors, plus a fallback recovery method (email-based MFA bypass link) so users locked out of their authenticator can regain access.
todos:
  - id: admin-reset-endpoint
    content: Add POST /api/admin/reset-mfa Edge Function endpoint (verify admin role, delete MFA factors)
    status: completed
  - id: admin-reset-ui
    content: Add Reset MFA button to InviteStaff team member rows (admin-only)
    status: completed
  - id: recovery-endpoint
    content: Add POST /api/auth/mfa-recovery Edge Function endpoint (magic link + MFA factor cleanup)
    status: completed
  - id: recovery-ui
    content: Add 'Lost access to authenticator?' fallback link to MfaVerification screen
    status: completed
  - id: deploy-redeploy
    content: Redeploy Edge Function with --no-verify-jwt
    status: completed
isProject: false
---

# Admin MFA Reset and Fallback Recovery

## What Changes

### 1. Admin "Reset MFA" button in Team Management

In `[src/components/InviteStaff.tsx](src/components/InviteStaff.tsx)`, add a "Reset MFA" action button next to each team member (visible only to admins, not for self). Clicking it calls a new Edge Function endpoint that unenrolls all TOTP factors for that user.

### 2. New Edge Function endpoint: `POST /api/admin/reset-mfa`

In `[supabase/functions/api/index.ts](supabase/functions/api/index.ts)`, add a new admin route block:

- Authenticates the caller via their JWT (must be a logged-in user)
- Verifies the caller is an `admin` in the same org as the target user
- Uses `supabase.auth.admin.mfa.deleteFactor()` to remove all TOTP factors for the target user
- Logs the action via an audit insert

```
POST /api/admin/reset-mfa
Body: { targetUserId: string }
Auth: Bearer JWT + apikey
```

### 3. Email-based MFA bypass (fallback for locked-out users)

Add a "Lost access to authenticator?" link on the `[MfaVerification](src/components/MfaVerification.tsx)` screen that:

- Calls a new Edge Function endpoint `POST /api/auth/mfa-recovery` with the user's email
- The endpoint generates a time-limited magic link via `admin.generateLink({ type: "magiclink" })`
- Sends a recovery email (via Supabase's built-in email) with a one-time bypass link
- When the user clicks the link and lands back in the app, their MFA factors are automatically unenrolled so they can re-enroll fresh

### 4. New Edge Function endpoint: `POST /api/auth/mfa-recovery`

- Takes `{ email: string }`
- Looks up the user, verifies they have TOTP factors enrolled
- Generates a magic link that, when used, also triggers MFA factor deletion
- This is safe because the user must have access to their email (a second factor in itself)

## Files Changed

- `**src/components/InviteStaff.tsx**` -- Add "Reset MFA" button per member row, call new endpoint
- `**src/components/MfaVerification.tsx**` -- Add "Lost access to authenticator?" recovery link and flow
- `**supabase/functions/api/index.ts**` -- Add `/api/admin/reset-mfa` and `/api/auth/mfa-recovery` endpoints

