/** Prefer dedicated secret so API key HMAC can rotate independently of the service role. */
const HASH_SECRET =
  Deno.env.get("API_KEY_HMAC_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CENTRAL_ENCRYPTION_KEY = Deno.env.get("CENTRAL_ENCRYPTION_KEY") ?? "";

export async function hmacHash(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(HASH_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function hmacVerify(data: string, hash: string): Promise<boolean> {
  const computed = await hmacHash(data);
  return constantTimeEqual(computed, hash);
}

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `ck_${hex}`;
}

async function centralDeriveKeyHkdf(): Promise<CryptoKey> {
  if (!CENTRAL_ENCRYPTION_KEY) throw new Error("CENTRAL_ENCRYPTION_KEY not configured");
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(CENTRAL_ENCRYPTION_KEY),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode("firecomply-central-v1"),
      info: enc.encode("aes-gcm-key"),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Legacy key derivation — kept for decrypting data encrypted before HKDF migration. */
async function centralDeriveKeyLegacy(): Promise<CryptoKey> {
  if (!CENTRAL_ENCRYPTION_KEY) throw new Error("CENTRAL_ENCRYPTION_KEY not configured");
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(CENTRAL_ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function encryptWithKey(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)).then(
    (ciphertext) => {
      const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
      combined.set(iv);
      combined.set(new Uint8Array(ciphertext), iv.length);
      return btoa(String.fromCharCode(...combined));
    },
  );
}

function decryptWithKey(key: CryptoKey, encoded: string): Promise<string> {
  const raw = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext).then(
    (decrypted) => new TextDecoder().decode(decrypted),
  );
}

/** Encrypt using HKDF-derived key (all new encryptions use this). */
export async function centralEncrypt(plaintext: string): Promise<string> {
  const key = await centralDeriveKeyHkdf();
  return encryptWithKey(key, plaintext);
}

/**
 * Decrypt: try HKDF key first, fall back to legacy padEnd key.
 * Callers can pass an optional callback to re-encrypt the value with
 * the new key derivation when the legacy path is used.
 */
export async function centralDecrypt(
  encoded: string,
  onLegacyDecrypt?: (reEncrypted: string) => void | Promise<void>,
): Promise<string> {
  try {
    const key = await centralDeriveKeyHkdf();
    return await decryptWithKey(key, encoded);
  } catch {
    const legacyKey = await centralDeriveKeyLegacy();
    const plaintext = await decryptWithKey(legacyKey, encoded);
    if (onLegacyDecrypt) {
      const reEncrypted = await encryptWithKey(await centralDeriveKeyHkdf(), plaintext);
      await onLegacyDecrypt(reEncrypted);
    }
    return plaintext;
  }
}
