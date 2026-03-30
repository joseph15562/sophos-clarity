import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handleSendScheduledReports } from "./index.ts";

Deno.test("send-scheduled-reports: OPTIONS returns 200", async () => {
  const req = new Request("https://example.com/send-scheduled-reports", {
    method: "OPTIONS",
  });
  const res = await handleSendScheduledReports(req);
  assertEquals(res.status, 200);
});
