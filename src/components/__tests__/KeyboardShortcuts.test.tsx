import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcuts";

describe("KeyboardShortcuts", () => {
  it("renders when open is true", () => {
    render(
      <KeyboardShortcutsModal open onClose={vi.fn()} />,
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("Keyboard Shortcuts")).toBeVisible();
    expect(screen.getByText("Navigation")).toBeVisible();
  });

  it("does not render content when open is false", () => {
    render(
      <KeyboardShortcutsModal open={false} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeInTheDocument();
  });

  it("calls onClose when closed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <KeyboardShortcutsModal open onClose={onClose} />,
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});
