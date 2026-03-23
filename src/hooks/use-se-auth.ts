import { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface SEProfile {
  id: string;
  email: string;
  displayName: string | null;
  /** Optional report cover line; null = fall back to display name / email. */
  healthCheckPreparedBy: string | null;
  /** Job title shown on report emails (e.g. "Sophos Sales Engineer"). */
  seTitle: string | null;
}

export interface SEAuthState {
  user: User | null;
  session: Session | null;
  seProfile: SEProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Re-fetch `se_profiles` row for the signed-in user (e.g. after updating preferences). */
  reloadSeProfile: () => Promise<void>;
}

const SOPHOS_DOMAIN_RE = /@sophos\.com$/i;

function isSophosDomain(email: string): boolean {
  return SOPHOS_DOMAIN_RE.test(email.trim());
}

async function fetchSEProfile(userId: string): Promise<SEProfile | null> {
  const { data, error } = await supabase
    .from("se_profiles")
    .select("id, email, display_name, health_check_prepared_by, se_title")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (error || !data) return null;
  return {
    id: data.id as string,
    email: data.email as string,
    displayName: (data.display_name as string) ?? null,
    healthCheckPreparedBy: (data.health_check_prepared_by as string) ?? null,
    seTitle: (data.se_title as string) ?? null,
  };
}

async function createSEProfile(userId: string, email: string): Promise<SEProfile | null> {
  const { data, error } = await supabase
    .from("se_profiles")
    .insert({ user_id: userId, email } as Record<string, unknown>)
    .select("id, email, display_name, health_check_prepared_by, se_title")
    .single();

  if (error || !data) {
    console.warn("[useSEAuth] createSEProfile failed", error?.message);
    return null;
  }
  return {
    id: data.id as string,
    email: data.email as string,
    displayName: (data.display_name as string) ?? null,
    healthCheckPreparedBy: (data.health_check_prepared_by as string) ?? null,
    seTitle: (data.se_title as string) ?? null,
  };
}

export function useSEAuthProvider(): SEAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [seProfile, setSEProfile] = useState<SEProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (u: User) => {
    if (!u.email || !isSophosDomain(u.email)) {
      setSEProfile(null);
      return;
    }
    let profile = await fetchSEProfile(u.id);
    if (!profile) {
      profile = await createSEProfile(u.id, u.email);
    }
    setSEProfile(profile);
  }, []);

  const reloadSeProfile = useCallback(async () => {
    if (!user?.id || !user.email || !isSophosDomain(user.email)) return;
    const profile = await fetchSEProfile(user.id);
    if (profile) setSEProfile(profile);
  }, [user]);

  useEffect(() => {
    let profileTimeout: ReturnType<typeof setTimeout> | undefined;
    /** Never leave the UI stuck on loading if getSession or Supabase hangs */
    const bootTimeout = setTimeout(() => setIsLoading(false), 12_000);

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        clearTimeout(bootTimeout);
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          loadProfile(s.user).finally(() => {
            clearTimeout(profileTimeout);
            setIsLoading(false);
          });
          profileTimeout = setTimeout(() => setIsLoading(false), 10_000);
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => {
        clearTimeout(bootTimeout);
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user).catch(() => {});
      } else {
        setSEProfile(null);
      }
    });

    return () => {
      clearTimeout(bootTimeout);
      clearTimeout(profileTimeout);
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSophosDomain(email)) {
      return { error: "Only @sophos.com email addresses can access the SE Health Check tool." };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!isSophosDomain(email)) {
      return { error: "Only @sophos.com email addresses can register for the SE Health Check tool." };
    }
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSEProfile(null);
  }, []);

  const isAuthenticated = !!user && !!seProfile;

  return useMemo(() => ({
    user, session, seProfile, isLoading, isAuthenticated,
    signIn, signUp, signOut, reloadSeProfile,
  }), [user, session, seProfile, isLoading, isAuthenticated, signIn, signUp, signOut, reloadSeProfile]);
}

const SEAuthContext = createContext<SEAuthState | null>(null);

export const SEAuthProvider = SEAuthContext.Provider;

export function useSEAuth(): SEAuthState {
  const ctx = useContext(SEAuthContext);
  if (!ctx) throw new Error("useSEAuth must be used within an SEAuthProvider");
  return ctx;
}
