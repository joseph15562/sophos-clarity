import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { connectwiseCredentialsPostSchema } from "../../_shared/api-schemas.ts";

Deno.test("connectwise cloud credentials post schema", () => {
  assertEquals(connectwiseCredentialsPostSchema.safeParse({}).success, false);
  assertEquals(
    connectwiseCredentialsPostSchema.safeParse({
      publicMemberId: "x",
      subscriptionKey: "y",
    }).success,
    true,
  );
});
