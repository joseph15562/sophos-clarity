import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import { ScheduledReportSettings } from "@/components/ScheduledReportSettings";

const authFixture = vi.hoisted(() => ({
  org: { id: "org-test-1", name: "Test Org" },
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  return {
    supabase: createMockSupabase({ scheduled_reports: [] }),
    getSupabasePublicEdgeAuth: vi.fn(() => ({
      url: "http://test.supabase.co",
      anonKey: "test-key",
    })),
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    org: authFixture.org,
    user: { id: "user-1" },
    isGuest: false,
    session: null,
    role: "admin" as const,
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

describe("ScheduledReportSettings", () => {
  it("renders scheduled reports heading", async () => {
    renderWithProviders(<ScheduledReportSettings />);

    expect(screen.getByText(/scheduled delivery/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /new schedule/i })).toBeVisible();

    await waitFor(() => {
      expect(screen.getByText(/no scheduled reports yet/i)).toBeVisible();
    });
  });

  it("shows empty state when no reports", async () => {
    renderWithProviders(<ScheduledReportSettings />);

    await waitFor(() => {
      expect(screen.getByText(/no scheduled reports yet/i)).toBeVisible();
    });
  });
});
