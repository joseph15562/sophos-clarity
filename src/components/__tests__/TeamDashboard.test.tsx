import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/test-utils";
import { TeamDashboard } from "@/components/TeamDashboard";

const mockUseHealthChecksQuery = vi.fn();

vi.mock("@/hooks/queries", () => ({
  queryKeys: {
    healthChecks: {
      list: (teamId: string) => ["health-checks", teamId],
    },
  },
  useHealthChecksQuery: (teamId: string) => mockUseHealthChecksQuery(teamId),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabase({}) };
});

const TEAM_ID = "team-xyz";
const SE_ID = "se-self";

function sampleRow() {
  return {
    id: "hc-1",
    customer_name: "Contoso",
    overall_score: 82,
    overall_grade: "B",
    findings_count: 4,
    firewall_count: 2,
    checked_at: new Date().toISOString(),
    summary_json: { topFindings: ["Outdated firmware"] },
    se_user_id: SE_ID,
    se_profiles: { display_name: "You" },
  };
}

describe("TeamDashboard", () => {
  beforeEach(() => {
    mockUseHealthChecksQuery.mockReset();
  });

  it("renders loading state", async () => {
    const user = userEvent.setup();
    mockUseHealthChecksQuery.mockReturnValue({
      data: [sampleRow()],
      isLoading: true,
    });

    renderWithProviders(<TeamDashboard activeTeamId={TEAM_ID} seProfileId={SE_ID} />);

    await user.click(screen.getByRole("button", { name: /team dashboard/i }));

    expect(screen.getByRole("button", { name: /refresh/i })).toBeDisabled();
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders empty state with no data", async () => {
    const user = userEvent.setup();
    mockUseHealthChecksQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });

    renderWithProviders(<TeamDashboard activeTeamId={TEAM_ID} seProfileId={SE_ID} />);

    await user.click(screen.getByRole("button", { name: /team dashboard/i }));

    expect(screen.getByText(/no health checks in this team yet/i)).toBeVisible();
  });

  it("renders score cards with data", async () => {
    const user = userEvent.setup();
    mockUseHealthChecksQuery.mockReturnValue({
      data: [sampleRow()],
      isLoading: false,
    });

    renderWithProviders(<TeamDashboard activeTeamId={TEAM_ID} seProfileId={SE_ID} />);

    await user.click(screen.getByRole("button", { name: /team dashboard/i }));

    expect(screen.getByText("Total Checks")).toBeVisible();
    expect(screen.getByText("Avg Score")).toBeVisible();
    expect(screen.getByText("82%")).toBeVisible();
    expect(screen.getByText("Contoso")).toBeVisible();
  });
});
