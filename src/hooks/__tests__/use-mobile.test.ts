import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@/test/test-utils";
import { useIsMobile } from "@/hooks/use-mobile";

describe("useIsMobile", () => {
  const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth");

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    if (innerWidthDescriptor) {
      Object.defineProperty(window, "innerWidth", innerWidthDescriptor);
    } else {
      delete (window as { innerWidth?: number }).innerWidth;
    }
  });

  it("returns false for wide viewport", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("returns true for narrow viewport", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 600,
    });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
