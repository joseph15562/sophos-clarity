import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { serviceKeyIssueBodySchema, serviceKeyRevokeBodySchema } from "./service-key.ts";

Deno.test("service-key issue: requires non-empty label", () => {
  assertEquals(serviceKeyIssueBodySchema.safeParse({ label: "" }).success, false);
  assertEquals(serviceKeyIssueBodySchema.safeParse({ label: "CI" }).success, true);
});

Deno.test("service-key revoke: requires uuid id", () => {
  assertEquals(serviceKeyRevokeBodySchema.safeParse({ id: "x" }).success, false);
  assertEquals(
    serviceKeyRevokeBodySchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" }).success,
    true,
  );
});
