import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import { PageSkeleton } from "@/components/PageSkeleton";

describe("PageSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<PageSkeleton />);
    expect(container).toBeInTheDocument();
  });

  it("renders multiple skeleton elements", () => {
    render(<PageSkeleton />);
    const withPulse = document.querySelectorAll('[class*="animate-pulse"]');
    const withRole = document.querySelectorAll("[role]");
    expect(withPulse.length + withRole.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("generic").length).toBeGreaterThan(0);
  });
});
