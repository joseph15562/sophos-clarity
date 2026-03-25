import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import { EmptyState } from "@/components/EmptyState";

describe("EmptyState", () => {
  it("renders default title", () => {
    render(<EmptyState />);
    expect(screen.getByText("Nothing here yet")).toBeVisible();
  });

  it("renders custom title", () => {
    render(<EmptyState title="No data" />);
    expect(screen.getByText("No data")).toBeVisible();
  });

  it("renders description when provided", () => {
    render(<EmptyState description="Some desc" />);
    expect(screen.getByText("Some desc")).toBeVisible();
  });

  it("renders action when provided", () => {
    render(<EmptyState action={<button>Click me</button>} />);
    expect(screen.getByRole("button", { name: "Click me" })).toBeVisible();
  });

  it("renders custom icon", () => {
    render(<EmptyState icon={<span data-testid="custom-icon" />} />);
    expect(screen.getByTestId("custom-icon")).toBeVisible();
  });

  it("applies className", () => {
    const { container } = render(<EmptyState className="my-class" />);
    const root = container.firstElementChild;
    expect(root).toHaveClass("my-class");
  });
});
