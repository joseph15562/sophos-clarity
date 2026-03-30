import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { inviteBodySchema } from "./portal-viewers.ts";

Deno.test("portal-viewers invite: rejects bad email", () => {
  assertEquals(inviteBodySchema.safeParse({ email: "nope" }).success, false);
});

Deno.test("portal-viewers invite: accepts email and optional name", () => {
  assertEquals(
    inviteBodySchema.safeParse({ email: "a@b.co", name: "Jane" }).success,
    true,
  );
});
