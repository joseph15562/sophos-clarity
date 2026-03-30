/**
 * Optional Upstash Redis REST cache (741 pilot).
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN; if unset, cache helpers no-op.
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

export async function redisGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  const v = await r.get<string>(key);
  return v ?? null;
}

export async function redisSet(
  key: string,
  value: string,
  exSeconds: number,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(key, value, { ex: exSeconds });
}
