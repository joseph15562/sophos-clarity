import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import { PasskeyManager } from "@/components/PasskeyManager";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  return {
    supabase: createMockSupabase({ passkey_credentials: [] }),
    getSupabasePublicEdgeAuth: vi.fn(() => ({
      url: "http://test.supabase.co",
      anonKey: "test-key",
    })),
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    org: null,
    isGuest: false,
  }),
}));

describe("PasskeyManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders passkey registration section", async () => {
    renderWithProviders(<PasskeyManager />);

    expect(screen.getByText("Passkeys")).toBeVisible();
    expect(screen.getByRole("button", { name: /register new passkey/i })).toBeVisible();
    expect(screen.getByPlaceholderText(/passkey name/i)).toBeVisible();

    await waitFor(() => {
      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith("passkey_credentials");
    });
  });

  it("shows empty state when no passkeys", async () => {
    renderWithProviders(<PasskeyManager />);

    await waitFor(() => {
      expect(screen.getByText(/no passkeys registered/i)).toBeVisible();
    });
  });
});
