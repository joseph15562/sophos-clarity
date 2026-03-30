import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  agentHeartbeatBodySchema,
  agentRegisterBodySchema,
  agentSubmitBodySchema,
  agentVerifyIdentityBodySchema,
} from "../../_shared/api-schemas.ts";

Deno.test("agent routes: register body schema", () => {
  assertEquals(agentRegisterBodySchema.safeParse({ name: "", firewall_host: "x" }).success, false);
  assertEquals(
    agentRegisterBodySchema.safeParse({ name: "Edge", firewall_host: "10.0.0.1" }).success,
    true,
  );
});

Deno.test("agent routes: heartbeat body accepts empty object", () => {
  assertEquals(agentHeartbeatBodySchema.safeParse({}).success, true);
});

Deno.test("agent routes: submit body accepts empty object (passthrough)", () => {
  assertEquals(agentSubmitBodySchema.safeParse({}).success, true);
});

Deno.test("agent routes: verify-identity body schema", () => {
  assertEquals(agentVerifyIdentityBodySchema.safeParse({}).success, false);
  assertEquals(
    agentVerifyIdentityBodySchema.safeParse({ email: "a@b.co", totpCode: "123456" }).success,
    true,
  );
});
