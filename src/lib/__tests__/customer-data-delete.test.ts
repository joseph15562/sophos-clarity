import { describe, it, expect } from "vitest";
import {
  customerNameVariantsForDelete,
  dedupeNameVariantsCaseInsensitive,
  escapeForExactIlike,
} from "@/lib/customer-data-delete";

describe("customer-data-delete", () => {
  it("escapes ilike wildcards", () => {
    expect(escapeForExactIlike("100%")).toBe("100\\%");
    expect(escapeForExactIlike("a_b")).toBe("a\\_b");
    expect(escapeForExactIlike("x\\y")).toBe("x\\\\y");
  });

  it("collects name variants", () => {
    expect(
      customerNameVariantsForDelete({
        name: "Acme",
        originalNames: ["acme", "ACME"],
        tenantNameRaw: "Tenant A",
      }).sort(),
    ).toEqual(["Acme", "acme", "ACME", "Tenant A"].sort());
  });

  it("dedupes case-insensitively", () => {
    expect(dedupeNameVariantsCaseInsensitive(["Acme", "ACME", "acme"])).toEqual(["Acme"]);
  });
});
