import { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface SEProfile {
  id: string;
  email: string;
  displayName: string | null;
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
}

const SOPHOS_DOMAIN_RE = /@sophos\.com$/i;

function isSophosDomain(email: string): boolean {
  return SOPHOS_DOMAIN_RE.test(email.trim());
}

async function fetchSEProfile(userId: string): Promise<SEProfile | null> {
  const { data, error } = await supabase
    .from("se_profiles")
    .select("id, email, display_name")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (error || !data) return null;
  return {
    id: data.id as string,
    email: data.email as string,
    displayName: (data.display_name as string) ?? null,
  };
}

async function createSEProfile(userId: string, email: string): Promise<SEProfile | null> {
  const { data, error } = await supabase
    .from("se_profiles")
    .insert({ user_id: userId, email } as Record<string, unknown>)
    .select("id, email, display_name")
    .single();

  if (error || !data) {
    console.warn("[useSEAuth] createSEProfile failed", error?.message);
    return null;
  }
  return {
    id: data.id as string,
    email: data.email as string,
    displayName: (data.display_name as string) ?? null,
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

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user).finally(() => {
          clearTimeout(timeout);
          setIsLoading(false);
        });
        timeout = setTimeout(() => setIsLoading(false), 10_000);
      } else {
        setIsLoading(false);
      }
    }).catch(() => setIsLoading(false));

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
      clearTimeout(timeout);
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
    signIn, signUp, signOut,
  }), [user, session, seProfile, isLoading, isAuthenticated, signIn, signUp, signOut]);
}

const SEAuthContext = createContext<SEAuthState | null>(null);

export const SEAuthProvider = SEAuthContext.Provider;

export function useSEAuth(): SEAuthState {
  const ctx = useContext(SEAuthContext);
  if (!ctx) throw new Error("useSEAuth must be used within an SEAuthProvider");
  return ctx;
}
