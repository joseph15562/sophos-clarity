import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isFeatureEnabled } from "../feature-flags";

describe("isFeatureEnabled", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_FEATURE_DEMO_FLAG", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when unset", () => {
    expect(isFeatureEnabled("demo-flag")).toBe(false);
  });

  it("returns true for 1 or true", () => {
    vi.stubEnv("VITE_FEATURE_DEMO_FLAG", "1");
    expect(isFeatureEnabled("demo-flag")).toBe(true);
    vi.stubEnv("VITE_FEATURE_DEMO_FLAG", "true");
    expect(isFeatureEnabled("demo-flag")).toBe(true);
  });
});
