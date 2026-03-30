import type { Session, User } from "@supabase/supabase-js";

/** Stable fake IDs — not expected to exist in production DB; org-scoped Supabase calls may no-op or error. */
export const E2E_BYPASS_USER_ID = "00000000-0000-4000-8000-00000000e2e1";
export const E2E_BYPASS_ORG_ID = "00000000-0000-4000-8000-00000000e2e2";

/**
 * When `VITE_E2E_AUTH_BYPASS=1` is baked into the bundle **and** the app runs on loopback,
 * `useAuth` can synthesize a signed-in admin session without Supabase credentials.
 * Never enable on public hostnames — production builds with this flag still require loopback.
 */
export function isE2EAuthBypassAllowed(): boolean {
  if (import.meta.env.VITE_E2E_AUTH_BYPASS !== "1") return false;
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (h === "localhost" || h === "[::1]") return true;
  if (h === "127.0.0.1") return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

export function buildE2EAuthBypassUser(): User {
  const now = new Date().toISOString();
  return {
    id: E2E_BYPASS_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "e2e-bypass@local.test",
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    factors: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  } as User;
}

export function buildE2EAuthBypassSession(user: User): Session {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: "e2e-bypass-access-token",
    refresh_token: "e2e-bypass-refresh-token",
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: "bearer",
    user,
  };
}

export function buildE2EAuthBypassOrg(): { id: string; name: string } {
  return { id: E2E_BYPASS_ORG_ID, name: "E2E Workspace" };
}
