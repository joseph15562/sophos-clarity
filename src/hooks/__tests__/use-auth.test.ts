import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@/test/test-utils";

const authMocks = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  const getSession = vi.fn(() =>
    Promise.resolve({ data: { session: null }, error: null }),
  );
  const onAuthStateChange = vi.fn(() => ({
    data: { subscription: { unsubscribe } },
  }));
  return { getSession, onAuthStateChange, unsubscribe };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(() =>
          Promise.resolve({
            data: {
              currentLevel: "aal1",
              nextLevel: "aal1",
              currentAuthenticationMethods: [],
            },
            error: null,
          }),
        ),
      },
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(() => Promise.resolve()),
}));

import { useAuthProvider } from "@/hooks/use-auth";

describe("useAuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    });
  });

  it("starts in loading state and resolves", async () => {
    const { result } = renderHook(() => useAuthProvider());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isGuest).toBe(true);
  });

  it("returns guest state when no session", async () => {
    const { result } = renderHook(() => useAuthProvider());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isGuest).toBe(true);
    expect(result.current.org).toBeNull();
    expect(result.current.session).toBeNull();
  });
});
