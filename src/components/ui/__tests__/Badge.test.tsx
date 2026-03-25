import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Test</Badge>);
    expect(screen.getByText("Test")).toBeVisible();
  });

  it("applies default variant classes", () => {
    const { container } = render(<Badge>Default</Badge>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("bg-primary");
  });

  it("applies destructive variant", () => {
    const { container } = render(<Badge variant="destructive">Bad</Badge>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("bg-destructive");
  });

  it("merges custom className", () => {
    const { container } = render(<Badge className="my-class">X</Badge>);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("my-class");
  });
});
