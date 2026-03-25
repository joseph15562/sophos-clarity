import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { StatCard } from "@/components/ui/StatCard";

const baseProps = {
  border: "border-border",
  bg: "bg-card",
  iconBg: "bg-muted",
  valueColor: "text-foreground",
  icon: "https://example.com/icon.png" as const,
};

describe("StatCard", () => {
  it("renders value and label", () => {
    render(
      <StatCard {...baseProps} value={42} label="Rules" />,
    );
    expect(screen.getByText("42")).toBeVisible();
    expect(screen.getByText("Rules")).toBeVisible();
  });

  it("renders as button when onClick provided", () => {
    render(
      <StatCard {...baseProps} value={1} label="X" onClick={() => {}} />,
    );
    expect(screen.getByRole("button")).toBeVisible();
  });

  it("renders as div when no onClick", () => {
    const { container } = render(
      <StatCard {...baseProps} value={1} label="X" />,
    );
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("div.rounded-xl")).toBeTruthy();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <StatCard {...baseProps} value={1} label="X" onClick={onClick} />,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders string icon as image", () => {
    const { container } = render(
      <StatCard
        {...baseProps}
        icon="https://example.com/icon.png"
        value={0}
        label="L"
      />,
    );
    const img = container.querySelector("img.sophos-icon");
    expect(img).toBeTruthy();
    expect(img).toHaveAttribute("src", "https://example.com/icon.png");
  });

  it("renders ReactNode icon", () => {
    render(
      <StatCard
        {...baseProps}
        icon={<span data-testid="custom-icon" />}
        value={0}
        label="L"
      />,
    );
    expect(screen.getByTestId("custom-icon")).toBeVisible();
  });
});
