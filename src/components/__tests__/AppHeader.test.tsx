import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { AppHeader } from "@/components/AppHeader";

const setTheme = vi.fn();

const authMock = vi.hoisted(() => ({
  isGuest: false,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", resolvedTheme: "light", setTheme }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: null,
    user: null,
    org: null,
    role: null,
    isGuest: authMock.isGuest,
    isLoading: false,
    needsOrg: false,
    needsMfa: false,
    canManageTeam: false,
    canManageAgents: false,
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

vi.mock("@/lib/sophos-central", () => ({
  getCentralStatus: vi.fn(() => Promise.resolve({ connected: false })),
  syncTenants: vi.fn(() => Promise.resolve([])),
  syncFirewalls: vi.fn(() => Promise.resolve()),
  displayCustomerNameForUi: (stored: string) => stored,
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabase({}) };
});

function minimalHeaderProps() {
  return {
    hasFiles: false,
    fileCount: 0,
    customerName: "",
    environment: "",
    selectedFrameworks: [] as string[],
    reportCount: 0,
  };
}

describe("AppHeader", () => {
  beforeEach(() => {
    setTheme.mockClear();
    authMock.isGuest = false;
  });

  afterEach(() => {
    authMock.isGuest = false;
  });

  it("renders app name/logo", () => {
    renderWithProviders(<AppHeader {...minimalHeaderProps()} />);
    expect(screen.getByRole("heading", { name: /sophos firecomply/i })).toBeVisible();
    expect(screen.getByAltText("Sophos")).toBeVisible();
  });

  it("renders customer name when provided", () => {
    renderWithProviders(
      <AppHeader {...minimalHeaderProps()} customerName="Acme Corp" environment="Production" />,
    );
    expect(screen.getByText("Acme Corp")).toBeVisible();
  });

  it("renders without crashing in guest mode", () => {
    authMock.isGuest = true;
    renderWithProviders(<AppHeader {...minimalHeaderProps()} />);
    expect(screen.getByRole("heading", { name: /sophos firecomply/i })).toBeVisible();
  });
});
