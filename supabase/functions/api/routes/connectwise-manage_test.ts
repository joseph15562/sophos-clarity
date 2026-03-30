import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  connectwiseManageCredentialsPostSchema,
  connectwiseManageTicketPostSchema,
} from "../../_shared/api-schemas.ts";

Deno.test("connectwise-manage: credentials post requires core fields", () => {
  assertEquals(connectwiseManageCredentialsPostSchema.safeParse({}).success, false);
  const ok = connectwiseManageCredentialsPostSchema.safeParse({
    apiBaseUrl: "https://example/",
    integratorCompanyId: "x",
    defaultBoardId: 1,
  });
  assertEquals(ok.success, true);
});

Deno.test("connectwise-manage: ticket post mutual exclusion for company identifiers", () => {
  assertEquals(
    connectwiseManageTicketPostSchema.safeParse({
      summary: "s",
      idempotencyKey: "k",
      customerCompanyId: 1,
      firecomplyCustomerKey: "acme",
    }).success,
    false,
  );
});
