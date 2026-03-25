import { vi } from "vitest";

type MockData = Record<string, unknown[]>;

interface ChainResult {
  data: unknown[] | unknown | null;
  error: null | { message: string };
  count: number | null;
}

function buildChain(rows: unknown[]): Record<string, (...args: unknown[]) => unknown> {
  let filtered = [...rows];
  const chain: Record<string, (...args: unknown[]) => unknown> = {};

  const self = () => chain;

  chain.select = vi.fn((_cols?: string, _opts?: { count?: string; head?: boolean }) => {
    if (_opts?.head) {
      return Promise.resolve({ data: null, error: null, count: filtered.length });
    }
    return chain;
  });
  chain.insert = vi.fn((_row: unknown) => Promise.resolve({ data: _row, error: null }));
  chain.update = vi.fn((_vals: unknown) => chain);
  chain.upsert = vi.fn((_row: unknown) => Promise.resolve({ data: _row, error: null }));
  chain.delete = vi.fn(() => chain);
  chain.eq = vi.fn((_col: string, _val: unknown) => {
    filtered = filtered.filter((r: any) => r[_col] === _val);
    return chain;
  });
  chain.neq = vi.fn(self);
  chain.gt = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lt = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.like = vi.fn(self);
  chain.ilike = vi.fn(self);
  chain.in = vi.fn(self);
  chain.is = vi.fn(self);
  chain.not = vi.fn(self);
  chain.or = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn((_n: number) => {
    filtered = filtered.slice(0, _n);
    return chain;
  });
  chain.range = vi.fn(self);
  chain.single = vi.fn(() =>
    Promise.resolve({ data: filtered[0] ?? null, error: null })
  );
  chain.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: filtered[0] ?? null, error: null })
  );
  chain.then = (onFulfilled: (val: ChainResult) => unknown) =>
    Promise.resolve(onFulfilled({ data: filtered, error: null, count: filtered.length }));

  return chain;
}

export function createMockSupabase(data: MockData = {}) {
  const client = {
    from: vi.fn((table: string) => buildChain(data[table] ?? [])),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: null }, error: null })
      ),
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: null }, error: null })
      ),
      signInWithPassword: vi.fn(() =>
        Promise.resolve({ data: { user: null, session: null }, error: null })
      ),
      signUp: vi.fn(() =>
        Promise.resolve({ data: { user: null, session: null }, error: null })
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: vi.fn((_cb: unknown) => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      mfa: {
        enroll: vi.fn(() => Promise.resolve({ data: null, error: null })),
        challenge: vi.fn(() => Promise.resolve({ data: null, error: null })),
        verify: vi.fn(() => Promise.resolve({ data: null, error: null })),
        getAuthenticatorAssuranceLevel: vi.fn(() =>
          Promise.resolve({
            data: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [] },
            error: null,
          })
        ),
      },
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
        download: vi.fn(() => Promise.resolve({ data: null, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })),
      })),
    },
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
  };

  return client;
}

/**
 * Call in beforeEach to replace the real Supabase client with a mock.
 * Returns the mock so tests can configure per-table data and assert calls.
 *
 * Usage:
 *   let mockSb: ReturnType<typeof createMockSupabase>;
 *   beforeEach(() => { mockSb = installMockSupabase({ org_members: [...] }); });
 */
export function installMockSupabase(data: MockData = {}) {
  const mock = createMockSupabase(data);
  vi.doMock("@/integrations/supabase/client", () => ({
    supabase: mock,
    getSupabasePublicEdgeAuth: () => ({ url: "http://test.supabase.co", anonKey: "test-key" }),
  }));
  return mock;
}
