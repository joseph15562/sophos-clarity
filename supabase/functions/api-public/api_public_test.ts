import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handleApiPublicRequest } from "./index.ts";

Deno.test("api-public: OPTIONS returns 204", async () => {
  const req = new Request("https://example.com/functions/v1/api-public/shared/foo", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
  const res = await handleApiPublicRequest(req);
  assertEquals(res.status, 204);
});

Deno.test("api-public: unknown GET path returns 404", async () => {
  const req = new Request("https://example.com/functions/v1/api-public/unknown-segment", {
    method: "GET",
    headers: { Origin: "http://localhost:5173" },
  });
  const res = await handleApiPublicRequest(req);
  assertEquals(res.status, 404);
});
