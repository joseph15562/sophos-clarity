import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handleFirewallRoutes } from "./firewalls.ts";

const cors: Record<string, string> = {};

Deno.test("firewalls: returns null when path does not match", async () => {
  const req = new Request("https://example.com/api/other", { method: "GET" });
  const res = await handleFirewallRoutes(
    req,
    new URL(req.url),
    ["other"],
    cors,
  );
  assertEquals(res, null);
});

Deno.test("firewalls: 401 without JWT or service key", async () => {
  const req = new Request("https://example.com/api/firewalls", {
    method: "GET",
  });
  const res = await handleFirewallRoutes(
    req,
    new URL(req.url),
    ["firewalls"],
    cors,
  );
  assertEquals(res?.status, 401);
});
