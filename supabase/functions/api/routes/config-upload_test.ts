import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { configUploadRequestBodySchema } from "./config-upload.ts";

Deno.test("config-upload-request body: rejects invalid expires_in_days", () => {
  assertEquals(configUploadRequestBodySchema.safeParse({ expires_in_days: 99 }).success, false);
});

Deno.test("config-upload-request body: accepts empty object (all optional)", () => {
  assertEquals(configUploadRequestBodySchema.safeParse({}).success, true);
});

Deno.test("config-upload-request body: accepts allowed expiry literal", () => {
  assertEquals(configUploadRequestBodySchema.safeParse({ expires_in_days: 7 }).success, true);
});
