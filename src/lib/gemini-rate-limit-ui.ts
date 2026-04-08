/** Seconds to disable Retry after our Gemini rate-limit error — immediate retries almost always 429 again. */
export const GEMINI_RATE_LIMIT_RETRY_COOLDOWN_SEC = 65;

export function isGoogleGeminiRateLimitMessage(message: string | undefined): boolean {
  if (!message) return false;
  return /google gemini rate limit/i.test(message);
}
