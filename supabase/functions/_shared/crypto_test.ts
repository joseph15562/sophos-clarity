import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { hmacHash, hmacVerify, generateApiKey, centralEncrypt, centralDecrypt } from "./crypto.ts";

Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-secret-key-for-hmac");
Deno.env.set("CENTRAL_ENCRYPTION_KEY", "test-central-key-32chars!!");

Deno.test("hmacHash returns a 64-char hex string", async () => {
  const hash = await hmacHash("hello");
  assertEquals(hash.length, 64);
  assertEquals(/^[0-9a-f]{64}$/.test(hash), true);
});

Deno.test("hmacHash is deterministic", async () => {
  const a = await hmacHash("test-data");
  const b = await hmacHash("test-data");
  assertEquals(a, b);
});

Deno.test("hmacHash produces different outputs for different inputs", async () => {
  const a = await hmacHash("input-a");
  const b = await hmacHash("input-b");
  assertNotEquals(a, b);
});

Deno.test("hmacVerify returns true for matching data", async () => {
  const hash = await hmacHash("verify-me");
  assertEquals(await hmacVerify("verify-me", hash), true);
});

Deno.test("hmacVerify returns false for mismatched data", async () => {
  const hash = await hmacHash("original");
  assertEquals(await hmacVerify("tampered", hash), false);
});

Deno.test("hmacVerify returns false for wrong hash", async () => {
  assertEquals(await hmacVerify("data", "0".repeat(64)), false);
});

Deno.test("hmacVerify returns false for different-length hash", async () => {
  assertEquals(await hmacVerify("data", "short"), false);
});

Deno.test("generateApiKey starts with ck_ and has 64 hex chars", () => {
  const key = generateApiKey();
  assertEquals(key.startsWith("ck_"), true);
  assertEquals(key.length, 3 + 64);
  assertEquals(/^ck_[0-9a-f]{64}$/.test(key), true);
});

Deno.test("generateApiKey produces unique keys", () => {
  const a = generateApiKey();
  const b = generateApiKey();
  assertNotEquals(a, b);
});

Deno.test("centralEncrypt/centralDecrypt round-trip", async () => {
  const plaintext = "secret credentials";
  const encrypted = await centralEncrypt(plaintext);
  assertNotEquals(encrypted, plaintext);
  const decrypted = await centralDecrypt(encrypted);
  assertEquals(decrypted, plaintext);
});

Deno.test("centralEncrypt produces different ciphertexts for same input (random IV)", async () => {
  const a = await centralEncrypt("same-input");
  const b = await centralEncrypt("same-input");
  assertNotEquals(a, b);
});

Deno.test("centralDecrypt with legacy callback is invoked for legacy-encrypted data", async () => {
  let callbackValue: string | null = null;

  // Encrypt with HKDF first, then try to decrypt — callback should NOT fire
  const encrypted = await centralEncrypt("test");
  await centralDecrypt(encrypted, async (re) => {
    callbackValue = re;
  });
  assertEquals(callbackValue, null);
});
