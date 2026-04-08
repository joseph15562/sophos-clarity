import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { pathSegmentsAfterApiPathname } from "./api-path.ts";

Deno.test("pathSegmentsAfterApiPathname: Supabase functions URL", () => {
  assertEquals(
    pathSegmentsAfterApiPathname("/functions/v1/api/send-saved-library-report"),
    ["send-saved-library-report"],
  );
});

Deno.test("pathSegmentsAfterApiPathname: send-report nested path", () => {
  assertEquals(
    pathSegmentsAfterApiPathname("/functions/v1/api/send-report/saved-library"),
    [
      "send-report",
      "saved-library",
    ],
  );
});

Deno.test("pathSegmentsAfterApiPathname: bare path (gateway strips prefix)", () => {
  assertEquals(pathSegmentsAfterApiPathname("/firewalls"), ["firewalls"]);
});

Deno.test("pathSegmentsAfterApiPathname: simple /api/… URL", () => {
  assertEquals(pathSegmentsAfterApiPathname("/api/assessments"), [
    "assessments",
  ]);
});
