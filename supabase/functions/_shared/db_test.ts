import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { safeDbError, safeError } from "./db.ts";

Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");

Deno.test("safeError returns default fallback for Error", () => {
  const msg = safeError(new Error("secret db connection string"));
  assertEquals(msg, "Internal server error");
});

Deno.test("safeError returns custom fallback", () => {
  const msg = safeError(new Error("oops"), "Something went wrong");
  assertEquals(msg, "Something went wrong");
});

Deno.test("safeError handles non-Error values", () => {
  const msg = safeError("string error");
  assertEquals(msg, "Internal server error");
});

Deno.test("safeError handles null/undefined", () => {
  assertEquals(safeError(null), "Internal server error");
  assertEquals(safeError(undefined), "Internal server error");
});

Deno.test("safeDbError returns generic message", () => {
  const msg = safeDbError({
    message: "relation 'users' does not exist",
    code: "42P01",
  });
  assertEquals(msg, "Database query failed");
});

Deno.test("safeDbError handles null", () => {
  const msg = safeDbError(null);
  assertEquals(msg, "Database query failed");
});
