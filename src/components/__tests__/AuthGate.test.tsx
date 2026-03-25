import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabase({}) };
});

describe("AuthGate", () => {
  const onSignIn = vi.fn();
  const onSignUp = vi.fn();
  const onSkip = vi.fn();

  beforeEach(() => {
    onSignIn.mockReset();
    onSignUp.mockReset();
    onSkip.mockReset();
    onSignIn.mockResolvedValue({ error: null });
    onSignUp.mockResolvedValue({ error: null });
  });

  it("renders sign-in form", () => {
    renderWithProviders(<AuthGate onSignIn={onSignIn} onSignUp={onSignUp} onSkip={onSkip} />);

    expect(screen.getByRole("heading", { name: /sign in to sophos firecomply/i })).toBeVisible();
    const emailInput = screen.getByPlaceholderText("you@company.com");
    expect(emailInput).toBeVisible();
    const form = emailInput.closest("form");
    expect(form).toBeTruthy();
    expect(within(form as HTMLElement).getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });

  it("renders sign-up form when toggled", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthGate onSignIn={onSignIn} onSignUp={onSignUp} onSkip={onSkip} />);

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByText(/confirm password/i)).toBeVisible();
    const form = screen.getByPlaceholderText("you@company.com").closest("form");
    expect(
      within(form as HTMLElement).getByRole("button", { name: /^create account$/i }),
    ).toBeVisible();
  });

  it("shows error on invalid email", async () => {
    const user = userEvent.setup();
    onSignIn.mockResolvedValue({ error: "Invalid email or password" });

    renderWithProviders(<AuthGate onSignIn={onSignIn} onSignUp={onSignUp} onSkip={onSkip} />);

    await user.type(screen.getByPlaceholderText("you@company.com"), "wrong@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    const form = screen.getByPlaceholderText("you@company.com").closest("form");
    await user.click(within(form as HTMLElement).getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("Invalid email or password")).toBeVisible();
  });

  it("passkey login section renders", () => {
    renderWithProviders(<AuthGate onSignIn={onSignIn} onSignUp={onSignUp} onSkip={onSkip} />);

    expect(screen.getByRole("button", { name: /sign in with passkey/i })).toBeVisible();
  });
});
