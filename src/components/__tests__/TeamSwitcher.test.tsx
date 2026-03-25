import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import type { SETeam } from "@/hooks/use-active-team";
import { TeamSwitcher } from "@/components/TeamSwitcher";

const activeTeamState = vi.hoisted(() => ({
  teams: [] as SETeam[],
  activeTeamId: null as string | null,
  setActiveTeamId: vi.fn(),
  loading: false,
}));

vi.mock("@/hooks/use-active-team", () => ({
  useActiveTeam: () => ({
    teams: activeTeamState.teams,
    activeTeamId: activeTeamState.activeTeamId,
    setActiveTeamId: activeTeamState.setActiveTeamId,
    loading: activeTeamState.loading,
  }),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabase({}) };
});

function teamFixture(overrides: Partial<SETeam> = {}): SETeam {
  return {
    id: "team-1",
    name: "Alpha Team",
    created_by: "user-1",
    created_at: new Date().toISOString(),
    role: "admin",
    is_primary: true,
    member_count: 2,
    ...overrides,
  };
}

describe("TeamSwitcher", () => {
  beforeEach(() => {
    activeTeamState.teams = [];
    activeTeamState.activeTeamId = null;
    activeTeamState.loading = false;
    activeTeamState.setActiveTeamId.mockClear();
  });

  it("renders nothing when no teams", () => {
    const { container } = renderWithProviders(<TeamSwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it("renders team select when teams exist", () => {
    activeTeamState.teams = [teamFixture({ id: "t-a", name: "SE East" })];
    activeTeamState.activeTeamId = "t-a";

    renderWithProviders(<TeamSwitcher />);

    expect(screen.getByRole("combobox")).toBeVisible();
    expect(screen.getByText("SE East")).toBeVisible();
  });
});
