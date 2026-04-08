import { describe, expect, it } from "vitest";
import { isGoogleGeminiRateLimitMessage } from "@/lib/gemini-rate-limit-ui";

describe("isGoogleGeminiRateLimitMessage", () => {
  it("matches FireComply Gemini 429 copy", () => {
    expect(
      isGoogleGeminiRateLimitMessage(
        "Google Gemini rate limit (all models tried). Something something.",
      ),
    ).toBe(true);
  });

  it("rejects unrelated errors", () => {
    expect(isGoogleGeminiRateLimitMessage("Network error")).toBe(false);
    expect(isGoogleGeminiRateLimitMessage(undefined)).toBe(false);
  });
});
