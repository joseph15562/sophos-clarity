import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function suppressBoundaryConsole() {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Child content")).toBeVisible();
  });

  it("shows fallback UI when child throws", () => {
    suppressBoundaryConsole();
    function BadChild() {
      throw new Error("fail");
    }
    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>
    );
    expect(
      screen.getByRole("heading", { name: "Something went wrong" })
    ).toBeVisible();
  });

  it("shows custom fallback title", () => {
    suppressBoundaryConsole();
    function BadChild() {
      throw new Error("fail");
    }
    render(
      <ErrorBoundary fallbackTitle="Custom Error">
        <BadChild />
      </ErrorBoundary>
    );
    expect(screen.getByRole("heading", { name: "Custom Error" })).toBeVisible();
  });

  it("shows error message", () => {
    suppressBoundaryConsole();
    function BadChild() {
      throw new Error("test msg");
    }
    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("test msg")).toBeVisible();
  });

  it("Try Again button resets error", async () => {
    suppressBoundaryConsole();
    const user = userEvent.setup();
    let shouldThrow = true;
    function MaybeThrow() {
      if (shouldThrow) throw new Error("boom");
      return <div>Back to normal</div>;
    }
    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    );
    expect(
      screen.getByRole("heading", { name: "Something went wrong" })
    ).toBeVisible();
    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: /Try Again/i }));
    expect(screen.getByText("Back to normal")).toBeVisible();
  });
});
