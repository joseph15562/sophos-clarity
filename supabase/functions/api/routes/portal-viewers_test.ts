import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { inviteBodySchema } from "./portal-viewers.ts";

Deno.test("portal-viewers invite: rejects bad email", () => {
  assertEquals(
    inviteBodySchema.safeParse({ email: "nope", portal_slug: "acme-a1b2" }).success,
    false,
  );
});

Deno.test("portal-viewers invite: rejects missing slug", () => {
  assertEquals(inviteBodySchema.safeParse({ email: "a@b.co", name: "Jane" }).success, false);
});

Deno.test("portal-viewers invite: accepts email, slug, optional name", () => {
  assertEquals(
    inviteBodySchema.safeParse({
      email: "a@b.co",
      name: "Jane",
      portal_slug: "acme-a1b2c3d4",
    }).success,
    true,
  );
});
