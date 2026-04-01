import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  passkeyChallengeSecret,
  signPasskeyChallengeToken,
  verifyPasskeyChallengeToken,
} from "./passkey-challenge-token.ts";

Deno.test("passkey challenge token round-trip", async () => {
  const prev = Deno.env.get("PASSKEY_CHALLENGE_SECRET");
  Deno.env.set("PASSKEY_CHALLENGE_SECRET", "unit-test-secret-key");

  try {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    const chal = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const tok = await signPasskeyChallengeToken(userId, chal);
    const out = await verifyPasskeyChallengeToken(tok);
    assertEquals(out?.sub, userId);
    assertEquals(out?.chal, chal);
  } finally {
    if (prev === undefined) Deno.env.delete("PASSKEY_CHALLENGE_SECRET");
    else Deno.env.set("PASSKEY_CHALLENGE_SECRET", prev);
  }
});

Deno.test("passkey challenge token rejects tampered payload", async () => {
  const prev = Deno.env.get("PASSKEY_CHALLENGE_SECRET");
  Deno.env.set("PASSKEY_CHALLENGE_SECRET", "unit-test-secret-key-2");

  try {
    const tok = await signPasskeyChallengeToken(
      "550e8400-e29b-41d4-a716-446655440001",
      "YWJj",
    );
    const [payloadB64, sigB64] = tok.split(".");
    const tampered = btoa(JSON.stringify({ sub: "evil", chal: "YWJj", exp: 9999999999 }));
    const forged = `${tampered}.${sigB64}`;
    const out = await verifyPasskeyChallengeToken(forged);
    assertEquals(out, null);
  } finally {
    if (prev === undefined) Deno.env.delete("PASSKEY_CHALLENGE_SECRET");
    else Deno.env.set("PASSKEY_CHALLENGE_SECRET", prev);
  }
});

Deno.test("passkeyChallengeSecret is non-empty in test env", () => {
  assertEquals(typeof passkeyChallengeSecret(), "string");
  assertEquals(passkeyChallengeSecret().length > 0, true);
});
