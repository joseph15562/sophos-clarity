import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { ReportCards } from "@/components/ReportCards";

const authMock = vi.hoisted(() => ({
  isViewerOnly: false,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: null,
    user: null,
    org: null,
    role: authMock.isViewerOnly ? "viewer" : "admin",
    isGuest: false,
    isLoading: false,
    needsOrg: false,
    needsMfa: false,
    canManageTeam: !authMock.isViewerOnly,
    canManageAgents: !authMock.isViewerOnly,
    canRunAssessments: !authMock.isViewerOnly,
    isViewerOnly: authMock.isViewerOnly,
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
  return { supabase: createMockSupabase({}) };
});

function defaultHandlers() {
  return {
    onGenerateIndividual: vi.fn(),
    onGenerateExecutive: vi.fn(),
    onGenerateExecutiveOnePager: vi.fn(),
    onGenerateCompliance: vi.fn(),
    onGenerateAll: vi.fn(),
  };
}

describe("ReportCards", () => {
  beforeEach(() => {
    authMock.isViewerOnly = false;
  });

  it("renders report generation cards", () => {
    renderWithProviders(
      <ReportCards fileCount={1} localMode={false} isViewerOnly={false} {...defaultHandlers()} />,
    );

    expect(screen.getByRole("heading", { name: /generate reports/i })).toBeVisible();
    expect(screen.getByText(/turn analysis into/i)).toBeVisible();
  });

  it("shows action buttons for different report types when allowed", () => {
    renderWithProviders(
      <ReportCards fileCount={2} localMode={false} isViewerOnly={false} {...defaultHandlers()} />,
    );

    expect(screen.getByRole("button", { name: /generate 2 reports/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /generate executive brief/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /generate one-pager/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /generate compliance report/i })).toBeVisible();
    expect(
      screen.getByRole("button", { name: /generate all reports \+ executive brief/i }),
    ).toBeVisible();
  });

  it("uses viewer-only behaviour when isViewerOnly is true", () => {
    authMock.isViewerOnly = true;

    renderWithProviders(
      <ReportCards fileCount={2} localMode={false} isViewerOnly {...defaultHandlers()} />,
    );

    expect(screen.getAllByRole("button", { name: /view only/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /generate all reports/i })).not.toBeInTheDocument();
  });
});
