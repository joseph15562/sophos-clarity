/**
 * HMAC-signed, time-bounded token binding WebAuthn login challenges to auth.users.id.
 * Prevents login-verify from accepting assertions without a prior login-options call.
 */

const TTL_SEC = 300;

function encoder(): TextEncoder {
  return new TextEncoder();
}

async function hmacKeyMaterial(secret: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", encoder().encode(secret));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const raw = await hmacKeyMaterial(secret);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/** Prefer dedicated secret; fall back to service role so deploys work without a new env var. */
export function passkeyChallengeSecret(): string {
  return Deno.env.get("PASSKEY_CHALLENGE_SECRET") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "dev-only-passkey-challenge-secret";
}

export async function signPasskeyChallengeToken(
  userId: string,
  challengeStdBase64: string,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const payload = JSON.stringify({
    sub: userId,
    chal: challengeStdBase64,
    exp,
  });
  const key = await importHmacKey(passkeyChallengeSecret());
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder().encode(payload)),
  );
  const sigB64 = btoa(String.fromCharCode(...sig));
  return `${btoa(payload)}.${sigB64}`;
}

export async function verifyPasskeyChallengeToken(
  token: string,
): Promise<{ sub: string; chal: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try {
    payload = atob(parts[0]);
  } catch {
    return null;
  }
  const key = await importHmacKey(passkeyChallengeSecret());
  let sigBytes: Uint8Array;
  try {
    sigBytes = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  const expectedSig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder().encode(payload)),
  );
  if (sigBytes.length !== expectedSig.length) return null;
  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= sigBytes[i] ^ expectedSig[i];
  }
  if (diff !== 0) return null;

  let data: { sub?: string; chal?: string; exp?: number };
  try {
    data = JSON.parse(payload);
  } catch {
    return null;
  }
  if (
    typeof data.sub !== "string" || !data.sub ||
    typeof data.chal !== "string" || !data.chal ||
    typeof data.exp !== "number"
  ) {
    return null;
  }
  if (data.exp < Math.floor(Date.now() / 1000)) return null;
  return { sub: data.sub, chal: data.chal };
}
