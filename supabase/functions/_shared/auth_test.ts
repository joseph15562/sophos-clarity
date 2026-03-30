import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-secret-key-for-hmac");

const { authenticateAgent, getOrgMembership, authenticateSE } = await import(
  "./auth.ts"
);
type AuthAdminClient = import("./auth.ts").AuthAdminClient;
const { hmacHash } = await import("./crypto.ts");

function agentsAdmin(
  result: { data: unknown[] | null; error: unknown },
): AuthAdminClient {
  return {
    from(table: string) {
      if (table !== "agents") throw new Error(`unexpected table ${table}`);
      return {
        select(_cols: string) {
          return this;
        },
        eq(_col: string, _val: string) {
          return this;
        },
        limit(_n: number) {
          return Promise.resolve(result) as Promise<
            { data: unknown; error: unknown }
          >;
        },
      };
    },
  } as unknown as AuthAdminClient;
}

function orgMembersAdmin(
  result: { data: unknown; error: unknown },
): AuthAdminClient {
  return {
    from(table: string) {
      if (table !== "org_members") throw new Error(`unexpected table ${table}`);
      return {
        select(_cols: string) {
          return this;
        },
        eq(_col: string, _val: string) {
          return this;
        },
        limit(_n: number) {
          return this;
        },
        single() {
          return Promise.resolve(result) as Promise<
            { data: unknown; error: unknown }
          >;
        },
      };
    },
  } as unknown as AuthAdminClient;
}

function seProfilesAdmin(
  result: { data: unknown; error: unknown },
): AuthAdminClient {
  return {
    from(table: string) {
      if (table !== "se_profiles") throw new Error(`unexpected table ${table}`);
      return {
        select(_cols: string) {
          return this;
        },
        eq(_col: string, _val: string) {
          return this;
        },
        maybeSingle() {
          return Promise.resolve(result) as Promise<
            { data: unknown; error: unknown }
          >;
        },
      };
    },
  } as unknown as AuthAdminClient;
}

Deno.test("authenticateSE returns null when Authorization header is missing", async () => {
  const req = new Request("https://example.com/api/test");
  const result = await authenticateSE(req);
  assertEquals(result, null);
});

Deno.test("authenticateSE returns null when getUser returns no user", async () => {
  const req = new Request("https://example.com/api/test", {
    headers: { authorization: "Bearer fake" },
  });
  const result = await authenticateSE(req, {
    createUserClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
    }),
  });
  assertEquals(result, null);
});

Deno.test("authenticateSE returns null when se_profile row is missing", async () => {
  const req = new Request("https://example.com/api/test", {
    headers: { authorization: "Bearer x" },
  });
  const admin = seProfilesAdmin({ data: null, error: null });
  const result = await authenticateSE(req, {
    createUserClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-1", user_metadata: {} } },
        }),
      },
    }),
    admin,
  });
  assertEquals(result, null);
});

Deno.test("authenticateSE returns user and profile when stubbed chain succeeds", async () => {
  const req = new Request("https://example.com/api/test", {
    headers: { authorization: "Bearer x" },
  });
  const admin = seProfilesAdmin({
    data: {
      id: "se-1",
      email: "se@example.com",
      display_name: "SE One",
      health_check_prepared_by: null,
    },
    error: null,
  });
  const result = await authenticateSE(req, {
    createUserClient: () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: { id: "user-1", user_metadata: { full_name: "Ignored" } },
          },
        }),
      },
    }),
    admin,
  });
  assertEquals(result?.user.id, "user-1");
  assertEquals(result?.seProfile.display_name, "SE One");
});

Deno.test("authenticateSE fills display_name from user_metadata when profile has none", async () => {
  const req = new Request("https://example.com/api/test", {
    headers: { authorization: "Bearer x" },
  });
  const admin = seProfilesAdmin({
    data: {
      id: "se-1",
      email: "se@example.com",
      display_name: null,
      health_check_prepared_by: null,
    },
    error: null,
  });
  const result = await authenticateSE(req, {
    createUserClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "u1", user_metadata: { name: "From Meta" } } },
        }),
      },
    }),
    admin,
  });
  assertEquals(result?.seProfile.display_name, "From Meta");
});

Deno.test("authenticateAgent returns null when query errors", async () => {
  const admin = agentsAdmin({ data: null, error: { message: "db down" } });
  const out = await authenticateAgent("ck_" + "a".repeat(64), { admin });
  assertEquals(out, null);
});

Deno.test("authenticateAgent returns null when no agent rows", async () => {
  const admin = agentsAdmin({ data: [], error: null });
  const key = "ck_" + "b".repeat(64);
  const out = await authenticateAgent(key, { admin });
  assertEquals(out, null);
});

Deno.test("authenticateAgent returns null when hashes do not match", async () => {
  const key = "ck_" + "c".repeat(64);
  const prefix = key.slice(0, 8);
  const admin = agentsAdmin({
    data: [{ id: "a1", api_key_prefix: prefix, api_key_hash: "0".repeat(64) }],
    error: null,
  });
  const out = await authenticateAgent(key, { admin });
  assertEquals(out, null);
});

Deno.test("authenticateAgent returns matching agent when hash verifies", async () => {
  const key = "ck_" + "d".repeat(64);
  const prefix = key.slice(0, 8);
  const hash = await hmacHash(key);
  const row = {
    id: "agent-99",
    api_key_prefix: prefix,
    api_key_hash: hash,
    name: "Test Agent",
    org_id: "org-1",
  };
  const admin = agentsAdmin({ data: [row], error: null });
  const out = await authenticateAgent(key, { admin });
  assertEquals(out?.id, "agent-99");
  assertEquals(out?.name, "Test Agent");
});

Deno.test("getOrgMembership returns null when no row", async () => {
  const admin = orgMembersAdmin({ data: null, error: { code: "PGRST116" } });
  const m = await getOrgMembership("user-x", { admin });
  assertEquals(m, null);
});

Deno.test("getOrgMembership returns org_id and role", async () => {
  const admin = orgMembersAdmin({
    data: { org_id: "org-1", role: "admin" },
    error: null,
  });
  const m = await getOrgMembership("user-y", { admin });
  assertEquals(m, { org_id: "org-1", role: "admin" });
});
