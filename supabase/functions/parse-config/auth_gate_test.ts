import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { parseConfigEarlyResponse } from "./auth_gate.ts";

Deno.test("parse-config auth gate: OPTIONS returns 200 with CORS", async () => {
  const req = new Request("https://example.com/parse-config", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
  const res = parseConfigEarlyResponse(req);
  assertEquals(res !== null, true);
  assertEquals(res!.status, 200);
  assertEquals(res!.headers.get("Access-Control-Allow-Origin") !== null, true);
});

Deno.test("parse-config auth gate: POST without Authorization returns 401", () => {
  const req = new Request("https://example.com/parse-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const res = parseConfigEarlyResponse(req);
  assertEquals(res !== null, true);
  assertEquals(res!.status, 401);
});

Deno.test("parse-config auth gate: POST with Authorization returns null (defer to handler)", () => {
  const req = new Request("https://example.com/parse-config", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer x",
    },
    body: "{}",
  });
  assertEquals(parseConfigEarlyResponse(req), null);
});
