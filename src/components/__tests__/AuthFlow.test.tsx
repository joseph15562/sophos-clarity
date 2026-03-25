import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session, User } from "@supabase/supabase-js";
import { renderWithProviders, screen } from "@/test/test-utils";
import type { AuthState } from "@/hooks/use-auth";
import { AuthFlow } from "@/components/AuthFlow";

function AuthedShell(props: { onShowAuth?: () => void }) {
  void props.onShowAuth;
  return <div>Authed workspace</div>;
}

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabase({}) };
});

function buildAuth(overrides: Partial<AuthState> = {}): AuthState {
  return {
    user: null,
    session: null,
    org: null,
    role: null,
    isGuest: true,
    isLoading: false,
    needsOrg: false,
    needsMfa: false,
    canManageTeam: false,
    canManageAgents: false,
    canRunAssessments: true,
    isViewerOnly: false,
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue(),
    createOrg: vi.fn().mockResolvedValue({ error: null }),
    refreshOrg: vi.fn().mockResolvedValue(),
    clearMfaRequired: vi.fn(),
    ...overrides,
  };
}

describe("AuthFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    const auth = buildAuth({ isLoading: true });
    renderWithProviders(
      <AuthFlow auth={auth}>
        <div>Child content</div>
      </AuthFlow>,
    );

    expect(screen.getByText(/loading/i)).toBeVisible();
    expect(screen.getByAltText("Sophos")).toBeVisible();
  });

  it("renders auth gate when not authenticated", () => {
    const auth = buildAuth({ isGuest: true, isLoading: false });
    renderWithProviders(
      <AuthFlow auth={auth}>
        <div>Child content</div>
      </AuthFlow>,
    );

    expect(screen.getByRole("heading", { name: /sign in to sophos firecomply/i })).toBeVisible();
  });

  it("renders children when authenticated", () => {
    const user = { id: "u1", email: "user@example.com" } as User;
    const auth = buildAuth({
      user,
      session: {} as Session,
      org: { id: "o1", name: "Acme" },
      role: "admin",
      isGuest: false,
      needsOrg: false,
      needsMfa: false,
      canManageTeam: true,
      canManageAgents: true,
      canRunAssessments: true,
      isViewerOnly: false,
    });

    renderWithProviders(
      <AuthFlow auth={auth}>
        <AuthedShell />
      </AuthFlow>,
    );

    expect(screen.getByText("Authed workspace")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /sign in to sophos firecomply/i }),
    ).not.toBeInTheDocument();
  });
});
