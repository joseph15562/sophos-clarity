import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { assessmentsListQuerySchema } from "../../_shared/api-schemas.ts";

Deno.test("assessments list query: rejects out-of-range page", () => {
  assertEquals(assessmentsListQuerySchema.safeParse({ page: "0" }).success, false);
});

Deno.test("assessments list query: accepts defaults", () => {
  const r = assessmentsListQuerySchema.safeParse({});
  assertEquals(r.success, true);
  if (r.success) {
    assertEquals(r.data.page, 1);
    assertEquals(r.data.pageSize, 50);
  }
});
