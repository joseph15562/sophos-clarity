import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { ActiveTeamProvider, useActiveTeam } from "@/hooks/use-active-team";

const mockUseSeTeamsQuery = vi.fn();

vi.mock("@/hooks/queries/use-se-teams-query", () => ({
  useSeTeamsQuery: (seProfileId: string | null) => mockUseSeTeamsQuery(seProfileId),
}));

function createWrapper(queryClient: QueryClient, seProfileId: string | null = "se-profile-1") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ActiveTeamProvider seProfileId={seProfileId}>{children}</ActiveTeamProvider>
      </QueryClientProvider>
    );
  };
}

describe("useActiveTeam", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it("provides empty teams initially", () => {
    mockUseSeTeamsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      status: "success",
    });

    const { result } = renderHook(() => useActiveTeam(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.teams).toEqual([]);
    expect(result.current.activeTeam).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("provides loading state", () => {
    mockUseSeTeamsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isPending: true,
      isFetching: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      status: "pending",
    });

    const { result } = renderHook(() => useActiveTeam(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.teams).toEqual([]);
    expect(result.current.loading).toBe(true);
  });
});
