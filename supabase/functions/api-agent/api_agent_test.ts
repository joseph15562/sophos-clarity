import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handleApiAgentRequest } from "./index.ts";

const stubCors = (): Record<string, string> => ({
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  Vary: "Origin",
});

Deno.test("handleApiAgentRequest OPTIONS returns 204 with CORS headers", async () => {
  const req = new Request("https://example.supabase.co/functions/v1/api-agent/config", {
    method: "OPTIONS",
  });
  const res = await handleApiAgentRequest(req, { getCorsHeaders: stubCors });
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");
});

Deno.test("handleApiAgentRequest rejects missing X-API-Key", async () => {
  const req = new Request("https://example.supabase.co/functions/v1/api-agent/config", {
    method: "GET",
  });
  const res = await handleApiAgentRequest(req, { getCorsHeaders: stubCors });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "Missing X-API-Key header");
});

Deno.test("handleApiAgentRequest rejects invalid API key", async () => {
  const req = new Request("https://example.supabase.co/functions/v1/api-agent/config", {
    method: "GET",
    headers: { "X-API-Key": "bad" },
  });
  const res = await handleApiAgentRequest(req, {
    getCorsHeaders: stubCors,
    authenticateAgent: async () => null,
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "Invalid API key");
});

Deno.test("handleApiAgentRequest GET config returns agent fields", async () => {
  const agent = {
    id: "ag-1",
    name: "Edge",
    customer_name: "Acme",
    environment: "prod",
    schedule_cron: "0 * * * *",
    firewall_host: "10.0.0.1",
    firewall_port: 4444,
    firmware_version_override: null,
    tenant_id: "t1",
    tenant_name: "Tenant",
  };
  const req = new Request("https://example.supabase.co/functions/v1/api-agent/config", {
    method: "GET",
    headers: { "X-API-Key": "ck_test" },
  });
  const res = await handleApiAgentRequest(req, {
    getCorsHeaders: stubCors,
    authenticateAgent: async () => agent,
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.id, "ag-1");
  assertEquals(body.name, "Edge");
  assertEquals(body.customer_name, "Acme");
  assertEquals(body.firewall_host, "10.0.0.1");
});
