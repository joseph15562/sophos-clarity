import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { adminResetMfaBodySchema, authMfaRecoveryBodySchema } from "../../_shared/api-schemas.ts";

Deno.test("admin routes: reset-mfa body schema", () => {
  assertEquals(adminResetMfaBodySchema.safeParse({}).success, false);
  assertEquals(
    adminResetMfaBodySchema.safeParse({
      targetUserId: "550e8400-e29b-41d4-a716-446655440000",
    }).success,
    true,
  );
});

Deno.test("admin routes: mfa-recovery body schema", () => {
  assertEquals(authMfaRecoveryBodySchema.safeParse({ targetEmail: "bad" }).success, false);
  assertEquals(authMfaRecoveryBodySchema.safeParse({ targetEmail: "u@example.com" }).success, true);
});
