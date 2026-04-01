import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handleProcessJobOutboxRequest } from "./handler.ts";

Deno.test("process-job-outbox: wrong bearer when CRON_SECRET set returns 401", async () => {
  const prev = Deno.env.get("CRON_SECRET");
  try {
    Deno.env.set("CRON_SECRET", "deno-test-cron-secret");
    const req = new Request("https://example.com/process-job-outbox", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    const res = await handleProcessJobOutboxRequest(req);
    assertEquals(res.status, 401);
  } finally {
    if (prev === undefined) Deno.env.delete("CRON_SECRET");
    else Deno.env.set("CRON_SECRET", prev);
  }
});
