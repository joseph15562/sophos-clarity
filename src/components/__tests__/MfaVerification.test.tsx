import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { MfaVerification } from "@/components/MfaVerification";

const mfaMocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  listFactors: vi.fn(),
  mfaChallenge: vi.fn(),
  mfaVerify: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mfaMocks.toastError(...args),
    success: (...args: unknown[]) => mfaMocks.toastSuccess(...args),
  },
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  const supabase = createMockSupabase({});
  Object.assign(supabase.auth.mfa as Record<string, ReturnType<typeof vi.fn>>, {
    listFactors: mfaMocks.listFactors,
    challenge: mfaMocks.mfaChallenge,
    verify: mfaMocks.mfaVerify,
  });
  return { supabase };
});

describe("MfaVerification", () => {
  const onVerified = vi.fn();

  beforeEach(() => {
    onVerified.mockReset();
    mfaMocks.toastError.mockReset();
    mfaMocks.toastSuccess.mockReset();
    mfaMocks.listFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1" }], all: [] },
      error: null,
    });
    mfaMocks.mfaChallenge.mockResolvedValue({
      data: { id: "challenge-1" },
      error: null,
    });
    mfaMocks.mfaVerify.mockResolvedValue({ error: null });
  });

  it("renders OTP input", async () => {
    renderWithProviders(<MfaVerification onVerified={onVerified} />);

    expect(screen.getByRole("heading", { name: /verify your identity/i })).toBeVisible();
    expect(screen.getByPlaceholderText("000000")).toBeVisible();
    expect(screen.getByText(/enter the 6-digit code from your authenticator app/i)).toBeVisible();
    await waitFor(() => expect(mfaMocks.mfaChallenge).toHaveBeenCalled());
  });

  it("calls onVerified when code is verified", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MfaVerification onVerified={onVerified} />);

    await waitFor(() => expect(mfaMocks.mfaChallenge).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText("000000"), "123456");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() => expect(mfaMocks.mfaVerify).toHaveBeenCalled());
    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(mfaMocks.toastSuccess).toHaveBeenCalledWith("Verified");
  });

  it("shows error on invalid code", async () => {
    const user = userEvent.setup();
    mfaMocks.mfaVerify.mockResolvedValue({ error: { message: "Invalid TOTP code" } });

    renderWithProviders(<MfaVerification onVerified={onVerified} />);

    await waitFor(() => expect(mfaMocks.mfaChallenge).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText("000000"), "999999");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() => expect(mfaMocks.toastError).toHaveBeenCalled());
    expect(mfaMocks.toastError).toHaveBeenCalledWith("Invalid code — please try again");
    expect(onVerified).not.toHaveBeenCalled();
  });
});
