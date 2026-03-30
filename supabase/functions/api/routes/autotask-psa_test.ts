import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  autotaskPsaCredentialsPostSchema,
  autotaskPsaTicketPostSchema,
  psaCompanyMappingDeleteSchema,
  psaCompanyMappingPutSchema,
} from "../../_shared/api-schemas.ts";

Deno.test("autotask-psa: company mapping put/delete schemas", () => {
  assertEquals(psaCompanyMappingPutSchema.safeParse({}).success, false);
  assertEquals(
    psaCompanyMappingPutSchema.safeParse({ customerKey: "k", companyId: 1 })
      .success,
    true,
  );
  assertEquals(psaCompanyMappingDeleteSchema.safeParse({}).success, false);
  assertEquals(
    psaCompanyMappingDeleteSchema.safeParse({ customerKey: "k" }).success,
    true,
  );
});

Deno.test("autotask-psa: credentials post requires core fields", () => {
  assertEquals(autotaskPsaCredentialsPostSchema.safeParse({}).success, false);
  const ok = autotaskPsaCredentialsPostSchema.safeParse({
    apiZoneBaseUrl: "https://example/",
    username: "u",
    defaultQueueId: 1,
    defaultPriority: 1,
    defaultStatus: 1,
    defaultSource: 1,
    defaultTicketType: 1,
  });
  assertEquals(ok.success, true);
});

Deno.test("autotask-psa: ticket post mutual exclusion for company identifiers", () => {
  assertEquals(
    autotaskPsaTicketPostSchema.safeParse({
      title: "t",
      idempotencyKey: "k",
      companyId: 1,
      firecomplyCustomerKey: "acme",
    }).success,
    false,
  );
  assertEquals(
    autotaskPsaTicketPostSchema.safeParse({
      title: "t",
      idempotencyKey: "k",
      companyId: 1,
    }).success,
    true,
  );
});
