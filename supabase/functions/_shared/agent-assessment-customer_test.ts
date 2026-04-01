import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { persistedAssessmentCustomerName } from "./agent-assessment-customer.ts";

Deno.test("persistedAssessmentCustomerName: assigned customer wins over Central tenant", () => {
  assertEquals(
    persistedAssessmentCustomerName(
      {
        assigned_customer_name: "Acme Corp",
        tenant_name: "(This tenant)",
        customer_name: "Site A",
      },
      "Site A",
    ),
    "Acme Corp",
  );
});

Deno.test("persistedAssessmentCustomerName: Central tenant wins over site label", () => {
  assertEquals(
    persistedAssessmentCustomerName(
      { tenant_name: "(This tenant)", customer_name: "Sophos Wall DC" },
      "Sophos Wall DC",
    ),
    "(This tenant)",
  );
});

Deno.test("persistedAssessmentCustomerName: unlinked uses body when provided", () => {
  assertEquals(
    persistedAssessmentCustomerName({ customer_name: "Unnamed" }, "Acme HQ"),
    "Acme HQ",
  );
});

Deno.test("persistedAssessmentCustomerName: unlinked falls back to agent customer_name", () => {
  assertEquals(
    persistedAssessmentCustomerName({ customer_name: "Branch 2" }, undefined),
    "Branch 2",
  );
});

Deno.test("persistedAssessmentCustomerName: empty tenant string uses body", () => {
  assertEquals(
    persistedAssessmentCustomerName({ tenant_name: "   ", customer_name: "X" }, "Y"),
    "Y",
  );
});
