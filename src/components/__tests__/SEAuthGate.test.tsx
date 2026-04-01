import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, within } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { SEAuthGate } from "@/components/SEAuthGate";

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabase({}) };
});

describe("SEAuthGate", () => {
  const onSignIn = vi.fn();
  const onSignUp = vi.fn();

  beforeEach(() => {
    onSignIn.mockReset();
    onSignUp.mockReset();
    onSignIn.mockResolvedValue({ error: null });
    onSignUp.mockResolvedValue({ error: null, needsEmailConfirmation: true });
  });

  it("renders sign-in form", () => {
    renderWithProviders(<SEAuthGate onSignIn={onSignIn} onSignUp={onSignUp} />);

    expect(screen.getByRole("heading", { name: /se sign in/i })).toBeVisible();
    const emailInput = screen.getByPlaceholderText("firstname.lastname@sophos.com");
    expect(emailInput).toBeVisible();
    const form = emailInput.closest("form");
    expect(form).toBeTruthy();
    expect(within(form as HTMLElement).getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });

  it("validates sophos.com email domain", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SEAuthGate onSignIn={onSignIn} onSignUp={onSignUp} />);

    const emailInput = screen.getByPlaceholderText("firstname.lastname@sophos.com");
    await user.type(emailInput, "x@gmail.com");
    await user.type(screen.getAllByPlaceholderText("••••••••")[0], "password12");
    const form = emailInput.closest("form");
    await user.click(within(form as HTMLElement).getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText(/only @sophos\.com email addresses are allowed/i)).toBeVisible();
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it("shows sign-up option", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SEAuthGate onSignIn={onSignIn} onSignUp={onSignUp} />);

    await user.click(screen.getByRole("button", { name: /^register$/i }));

    expect(screen.getByPlaceholderText("e.g. Joseph McDonald")).toBeVisible();
    const form = screen.getByPlaceholderText("e.g. Joseph McDonald").closest("form");
    expect(
      within(form as HTMLElement).getByRole("button", { name: /^create account$/i }),
    ).toBeVisible();
  });
});
