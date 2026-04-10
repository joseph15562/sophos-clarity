/**
 * Redis-backed sliding-window rate limiter for Edge Functions.
 * Uses the existing Upstash Redis client from upstash-redis.ts.
 * When Redis is not configured, the limiter is permissive (always allows).
 */
import { Redis } from "https://esm.sh/@upstash/redis@1.34.3";

let client: Redis | null | undefined;

function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL")?.trim();
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN")?.trim();
  if (!url || !token) {
    client = null;
    return null;
  }
  client = new Redis({ url, token });
  return client;
}

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Check and increment a sliding-window counter.
 * @param key   Unique key, e.g. `rl:api:{userId}`
 * @param max   Maximum requests allowed in the window
 * @param windowSeconds  Window duration (default 60)
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  const r = getRedis();
  if (!r || max <= 0) {
    return { limited: false, remaining: max, retryAfterSeconds: 0 };
  }
  try {
    const count = await r.incr(key);
    if (count === 1) {
      await r.expire(key, windowSeconds);
    }
    const ttl = await r.ttl(key);
    const remaining = Math.max(0, max - count);
    return {
      limited: count > max,
      remaining,
      retryAfterSeconds: count > max ? Math.max(ttl, 1) : 0,
    };
  } catch {
    return { limited: false, remaining: max, retryAfterSeconds: 0 };
  }
}

/**
 * Parse an env var as a positive integer rate limit. Returns `defaultMax` when
 * the var is unset, and 0 (disabled) when set to "0" / "off" / "false".
 */
export function rateLimitFromEnv(key: string, defaultMax: number): number {
  const raw = Deno.env.get(key)?.trim().toLowerCase();
  if (raw === "0" || raw === "off" || raw === "false") return 0;
  if (!raw) return defaultMax;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return defaultMax;
  return n;
}
