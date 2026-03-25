import { describe, it, expect, vi } from "vitest";
import { act, render, renderWithProviders, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { OrgSetup } from "@/components/OrgSetup";

describe("OrgSetup", () => {
  it("renders organisation setup form", () => {
    render(
      <OrgSetup
        userEmail="test@test.com"
        onCreateOrg={vi.fn().mockResolvedValue({ error: null })}
        onSignOut={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: /organisation/i })
    ).toBeVisible();
    expect(screen.getByText("test@test.com")).toBeVisible();
  });

  it("calls onCreateOrg with org name on submit", async () => {
    const user = userEvent.setup();
    const onCreateOrg = vi.fn().mockResolvedValue({ error: null });

    renderWithProviders(
      <OrgSetup
        userEmail="test@test.com"
        onCreateOrg={onCreateOrg}
        onSignOut={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText("e.g. Acme IT Solutions"),
      "My Org"
    );
    await user.click(
      screen.getByRole("button", { name: /create organisation/i })
    );

    expect(onCreateOrg).toHaveBeenCalledWith("My Org");
  });

  it("shows error when onCreateOrg returns error", async () => {
    const user = userEvent.setup();
    const onCreateOrg = vi
      .fn()
      .mockResolvedValue({ error: "Name taken" });

    renderWithProviders(
      <OrgSetup
        userEmail="test@test.com"
        onCreateOrg={onCreateOrg}
        onSignOut={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText("e.g. Acme IT Solutions"),
      "Taken Name"
    );
    await user.click(
      screen.getByRole("button", { name: /create organisation/i })
    );

    expect(await screen.findByText("Name taken")).toBeVisible();
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    let resolveCreate!: (value: { error: string | null }) => void;
    const pending = new Promise<{ error: string | null }>((resolve) => {
      resolveCreate = resolve;
    });
    const onCreateOrg = vi.fn(() => pending);

    renderWithProviders(
      <OrgSetup
        userEmail="test@test.com"
        onCreateOrg={onCreateOrg}
        onSignOut={vi.fn()}
      />
    );

    await user.type(
      screen.getByPlaceholderText("e.g. Acme IT Solutions"),
      "Loading Org"
    );

    const submit = screen.getByRole("button", { name: /create organisation/i });
    await user.click(submit);

    expect(submit).toBeDisabled();
    expect(submit.querySelector(".animate-spin")).toBeTruthy();

    await act(async () => {
      resolveCreate({ error: null });
      await pending;
    });
  });

  it("calls onSignOut", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    renderWithProviders(
      <OrgSetup
        userEmail="test@test.com"
        onCreateOrg={vi.fn().mockResolvedValue({ error: null })}
        onSignOut={onSignOut}
      />
    );

    await user.click(screen.getByRole("button", { name: /^sign out$/i }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
