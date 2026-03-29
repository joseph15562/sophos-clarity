import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { AgentFleetPanel } from "@/components/AgentFleetPanel";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.order = () => chain;
  chain.eq = () => chain;
  chain.gte = () => chain;
  chain.limit = () => chain;
  chain.then = (
    onFulfilled?: ((v: unknown) => unknown) | null,
    onRejected?: ((e: unknown) => unknown) | null,
  ) =>
    Promise.resolve({ data: [], error: null }).then(
      onFulfilled ?? undefined,
      onRejected ?? undefined,
    );

  return {
    supabase: {
      from: () => ({ ...chain }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      },
    },
  };
});

import { useAuth } from "@/hooks/use-auth";
const mockUseAuth = vi.mocked(useAuth);

describe("AgentFleetPanel", () => {
  it("returns null for guest users", () => {
    mockUseAuth.mockReturnValue({
      org: { id: "org-test", name: "Test Org" },
      isGuest: true,
    } as ReturnType<typeof useAuth>);
    const { container } = renderWithProviders(<AgentFleetPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when no org", () => {
    mockUseAuth.mockReturnValue({
      org: null,
      isGuest: false,
    } as ReturnType<typeof useAuth>);
    const { container } = renderWithProviders(<AgentFleetPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("shows loading skeleton while fetching agents", () => {
    mockUseAuth.mockReturnValue({
      org: { id: "org-test", name: "Test Org" },
      isGuest: false,
    } as ReturnType<typeof useAuth>);
    renderWithProviders(<AgentFleetPanel />);
    expect(
      screen.getByClassName
        ? document.querySelector(".animate-pulse")
        : document.querySelector(".animate-pulse"),
    ).toBeTruthy();
  });
});
