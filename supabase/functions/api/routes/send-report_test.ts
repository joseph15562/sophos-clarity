import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { sendReportBodySchema } from "./send-report.ts";

Deno.test("send-report: rejects without attachment payload", () => {
  assertEquals(
    sendReportBodySchema.safeParse({ customer_email: "a@b.co" }).success,
    false,
  );
});

Deno.test("send-report: accepts email with pdf_base64", () => {
  assertEquals(
    sendReportBodySchema.safeParse({
      customer_email: "a@b.co",
      pdf_base64: "UEsDBA==",
    }).success,
    true,
  );
});
