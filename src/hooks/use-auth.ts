import { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

export interface OrgInfo {
  id: string;
  name: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  org: OrgInfo | null;
  role: "admin" | "member" | null;
  isGuest: boolean;
  isLoading: boolean;
  needsOrg: boolean;
  needsMfa: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  createOrg: (name: string) => Promise<{ error: string | null }>;
  refreshOrg: () => Promise<void>;
  clearMfaRequired: () => void;
}

async function fetchOrgMembership(userId: string): Promise<{ org: OrgInfo; role: "admin" | "member" } | null> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id, role, organisations(id, name)")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (error || !data) return null;

  const orgData = data.organisations as unknown as { id: string; name: string } | null;
  if (!orgData) return null;

  return {
    org: { id: orgData.id, name: orgData.name },
    role: data.role as "admin" | "member",
  };
}

export function useAuthProvider(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [role, setRole] = useState<"admin" | "member" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsMfa, setNeedsMfa] = useState(false);

  const loadOrg = useCallback(async (uid: string) => {
    const membership = await fetchOrgMembership(uid);
    if (membership) {
      setOrg(membership.org);
      setRole(membership.role);
      return membership;
    } else {
      setOrg(null);
      setRole(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let loadingTimeout: ReturnType<typeof setTimeout> | undefined;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadOrg(s.user.id).finally(() => {
          clearTimeout(loadingTimeout);
          setIsLoading(false);
        });
        loadingTimeout = setTimeout(() => {
          console.warn("[useAuth] loadOrg timed out after 10s — forcing isLoading=false");
          setIsLoading(false);
        }, 10_000);
      } else {
        setIsLoading(false);
      }
    }).catch((err) => {
      console.warn("[useAuth] getSession failed", err);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadOrg(s.user.id).then((membership) => {
          if (event === "SIGNED_IN" && membership) {
            logAudit(membership.org.id, "auth.login", "", "", { email: s?.user?.email ?? undefined }).catch(() => {});
          }
        }).catch((err) => {
          console.warn("[useAuth] loadOrg in onAuthStateChange failed", err);
        });
      } else {
        setOrg(null);
        setRole(null);
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [loadOrg]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // Check if MFA is required
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
      setNeedsMfa(true);
    }

    return { error: null };
  }, []);

  const clearMfaRequired = useCallback(() => {
    setNeedsMfa(false);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    const currentOrgId = org?.id ?? "";
    const currentEmail = user?.email ?? undefined;
    await supabase.auth.signOut();
    setOrg(null);
    setRole(null);
    if (currentOrgId) {
      logAudit(currentOrgId, "auth.logout", "", "", { email: currentEmail }).catch(() => {});
    }
  }, [org, user]);

  const createOrg = useCallback(async (name: string) => {
    if (!user) return { error: "Not authenticated" };

    const { data, error: rpcErr } = await supabase.rpc("create_organisation", { org_name: name });

    if (rpcErr || !data) return { error: rpcErr?.message ?? "Failed to create organisation" };

    const orgData = data as unknown as { id: string; name: string };
    setOrg({ id: orgData.id, name: orgData.name });
    setRole("admin");
    return { error: null };
  }, [user]);

  const refreshOrg = useCallback(async () => {
    if (user) await loadOrg(user.id);
  }, [user, loadOrg]);

  const isGuest = !user;
  const needsOrg = !!user && !org && !isLoading;

  return useMemo(() => ({
    user, session, org, role, isGuest, isLoading, needsOrg, needsMfa,
    signIn, signUp, signOut, createOrg, refreshOrg, clearMfaRequired,
  }), [user, session, org, role, isGuest, isLoading, needsOrg, needsMfa, signIn, signUp, signOut, createOrg, refreshOrg, clearMfaRequired]);
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = AuthContext.Provider;

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
