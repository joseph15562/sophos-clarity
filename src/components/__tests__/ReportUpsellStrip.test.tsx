import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@/test/test-utils";
import { ReportUpsellStrip } from "@/components/ReportUpsellStrip";

describe("ReportUpsellStrip", () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without crashing", () => {
    render(
      <ReportUpsellStrip
        fileCount={1}
        hasComplianceFrameworks={false}
        isGuest={false}
      />,
    );
    expect(
      screen.getByText("Add a second firewall to unlock the Executive Summary."),
    ).toBeVisible();
  });

  it("shows nothing when conditions not met", () => {
    const { container } = render(
      <ReportUpsellStrip
        fileCount={2}
        hasComplianceFrameworks
        averageScore={80}
        isGuest={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows strip for guest users", () => {
    render(
      <ReportUpsellStrip
        fileCount={3}
        hasComplianceFrameworks={false}
        isGuest
      />,
    );
    expect(
      screen.getByText(
        "Sign in or create an account to save reports and unlock the Executive Summary.",
      ),
    ).toBeVisible();
  });
});
