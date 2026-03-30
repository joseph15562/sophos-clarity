import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  adminResetMfaBodySchema,
  agentRegisterBodySchema,
  agentVerifyIdentityBodySchema,
  assessmentsListQuerySchema,
  authMfaRecoveryBodySchema,
  autotaskPsaTicketPostSchema,
  connectwiseCredentialsPostSchema,
  connectwiseManageTicketPostSchema,
  healthCheckBulkTeamBodySchema,
  psaCompanyMappingPutSchema,
  seTeamCreateBodySchema,
} from "./api-schemas.ts";

Deno.test("agentRegisterBodySchema accepts minimal valid body", () => {
  const r = agentRegisterBodySchema.safeParse({
    name: "Edge-1",
    firewall_host: "10.0.0.1",
  });
  assertEquals(r.success, true);
  if (r.success) assertEquals(r.data.firewall_host, "10.0.0.1");
});

Deno.test("agentRegisterBodySchema rejects empty name", () => {
  const r = agentRegisterBodySchema.safeParse({ name: "", firewall_host: "x" });
  assertEquals(r.success, false);
});

Deno.test("agentVerifyIdentityBodySchema requires email and totpCode", () => {
  assertEquals(agentVerifyIdentityBodySchema.safeParse({}).success, false);
  assertEquals(
    agentVerifyIdentityBodySchema.safeParse({
      email: "a@b.co",
      totpCode: "123456",
    }).success,
    true,
  );
});

Deno.test("adminResetMfaBodySchema requires uuid targetUserId", () => {
  assertEquals(
    adminResetMfaBodySchema.safeParse({ targetUserId: "not-uuid" }).success,
    false,
  );
  assertEquals(
    adminResetMfaBodySchema.safeParse({
      targetUserId: "550e8400-e29b-41d4-a716-446655440000",
    }).success,
    true,
  );
});

Deno.test("authMfaRecoveryBodySchema requires email", () => {
  assertEquals(
    authMfaRecoveryBodySchema.safeParse({ targetEmail: "bad" }).success,
    false,
  );
  assertEquals(
    authMfaRecoveryBodySchema.safeParse({ targetEmail: "u@example.com" })
      .success,
    true,
  );
});

Deno.test("assessmentsListQuerySchema defaults and clamps", () => {
  const a = assessmentsListQuerySchema.safeParse({});
  assertEquals(a.success, true);
  if (a.success) {
    assertEquals(a.data.page, 1);
    assertEquals(a.data.pageSize, 50);
  }
  const b = assessmentsListQuerySchema.safeParse({ page: "2", pageSize: "10" });
  assertEquals(b.success, true);
  if (b.success) {
    assertEquals(b.data.page, 2);
    assertEquals(b.data.pageSize, 10);
  }
  assertEquals(
    assessmentsListQuerySchema.safeParse({ page: "0" }).success,
    false,
  );
  assertEquals(
    assessmentsListQuerySchema.safeParse({ pageSize: "101" }).success,
    false,
  );
});

Deno.test("healthCheckBulkTeamBodySchema requires uuid ids", () => {
  assertEquals(
    healthCheckBulkTeamBodySchema.safeParse({
      ids: ["not-uuid"],
      team_id: null,
    }).success,
    false,
  );
  assertEquals(
    healthCheckBulkTeamBodySchema.safeParse({
      ids: ["550e8400-e29b-41d4-a716-446655440000"],
      team_id: null,
    }).success,
    true,
  );
});

Deno.test("seTeamCreateBodySchema requires non-empty name", () => {
  assertEquals(seTeamCreateBodySchema.safeParse({ name: "" }).success, false);
  assertEquals(
    seTeamCreateBodySchema.safeParse({ name: "Alpha" }).success,
    true,
  );
});

Deno.test("connectwiseCredentialsPostSchema requires ids and keys", () => {
  assertEquals(connectwiseCredentialsPostSchema.safeParse({}).success, false);
  assertEquals(
    connectwiseCredentialsPostSchema.safeParse({
      publicMemberId: "x",
      subscriptionKey: "y",
    }).success,
    true,
  );
});

Deno.test("psaCompanyMappingPutSchema requires customerKey and companyId", () => {
  assertEquals(psaCompanyMappingPutSchema.safeParse({}).success, false);
  assertEquals(
    psaCompanyMappingPutSchema.safeParse({ customerKey: "acme", companyId: 1 })
      .success,
    true,
  );
});

Deno.test("autotaskPsaTicketPostSchema rejects companyId and firecomplyCustomerKey together", () => {
  assertEquals(
    autotaskPsaTicketPostSchema.safeParse({
      title: "t",
      idempotencyKey: "k",
      companyId: 1,
      firecomplyCustomerKey: "acme",
    }).success,
    false,
  );
  assertEquals(
    autotaskPsaTicketPostSchema.safeParse({
      title: "t",
      idempotencyKey: "k",
      companyId: 1,
    }).success,
    true,
  );
});

Deno.test("connectwiseManageTicketPostSchema rejects both company identifiers", () => {
  assertEquals(
    connectwiseManageTicketPostSchema.safeParse({
      summary: "s",
      idempotencyKey: "k",
      customerCompanyId: 1,
      firecomplyCustomerKey: "acme",
    }).success,
    false,
  );
});
