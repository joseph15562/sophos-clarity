import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { passkeyRegisterVerifyBodySchema } from "../../_shared/api-schemas.ts";

Deno.test("passkey register-verify body schema", () => {
  assertEquals(passkeyRegisterVerifyBodySchema.safeParse({}).success, false);
  assertEquals(
    passkeyRegisterVerifyBodySchema.safeParse({ credential: { id: "cred-1" } })
      .success,
    true,
  );
});
