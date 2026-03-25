import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import { InviteStaff } from "@/components/InviteStaff";

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(() => Promise.resolve()),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    org: { id: "org-test", name: "Test Org" },
    role: "admin" as const,
    session: null,
    user: null,
    isGuest: false,
    isLoading: false,
    needsOrg: false,
    needsMfa: false,
    canManageTeam: true,
    canManageAgents: true,
    canRunAssessments: true,
    isViewerOnly: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    createOrg: vi.fn(),
    refreshOrg: vi.fn(),
    clearMfaRequired: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  const mock = createMockSupabase({
    org_invites: [],
    org_members: [
      {
        id: "mem-1",
        user_id: "user-self",
        role: "admin",
        joined_at: "2024-06-01T00:00:00.000Z",
        org_id: "org-test",
      },
    ],
  });
  mock.auth.getUser = vi.fn(() =>
    Promise.resolve({
      data: { user: { id: "user-self", email: "you@example.com" } },
      error: null,
    }),
  );
  return { supabase: mock };
});

describe("InviteStaff", () => {
  it("renders invite form", async () => {
    renderWithProviders(<InviteStaff />);

    expect(screen.getByPlaceholderText("colleague@company.com")).toBeVisible();
    expect(screen.getByRole("button", { name: /invite/i })).toBeVisible();
    await screen.findByText(/team members/i);
  });

  it("renders members list", async () => {
    renderWithProviders(<InviteStaff />);

    await waitFor(() => {
      expect(screen.getByText(/team members/i)).toBeVisible();
    });

    expect(screen.getByText(/you@example\.com/)).toBeVisible();
    expect(screen.getByText("(you)")).toBeVisible();
  });
});
