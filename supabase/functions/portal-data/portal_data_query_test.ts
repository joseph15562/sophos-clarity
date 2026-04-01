import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { portalDataGetQuerySchema } from "./portal_data_query.ts";

Deno.test("portal-data query schema: strict rejects unknown keys", () => {
  const bad = portalDataGetQuerySchema.safeParse({
    slug: "demo",
    extra_param: "x",
  } as unknown);
  assertEquals(bad.success, false);
});

Deno.test("portal-data query schema: accepts slug only", () => {
  const ok = portalDataGetQuerySchema.safeParse({ slug: "demo" });
  assertEquals(ok.success, true);
});
