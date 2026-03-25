import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { QuickActions } from "@/components/QuickActions";

describe("QuickActions", () => {
  it("renders all action buttons", () => {
    render(<QuickActions />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("calls onNavigate with action id when clicked", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<QuickActions onNavigate={onNavigate} />);
    await user.click(screen.getAllByRole("button")[0]);
    expect(onNavigate).toHaveBeenCalledWith(expect.any(String));
  });

  it("renders without crashing with no props", () => {
    const { container } = render(<QuickActions />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
