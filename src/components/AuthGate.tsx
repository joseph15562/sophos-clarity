import { useState, useCallback } from "react";
import { LogIn, UserPlus, ArrowRight, AlertCircle, Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  onSignUp: (email: string, password: string) => Promise<{ error: string | null }>;
  onSkip: () => void;
}

export function AuthGate({ onSignIn, onSignUp, onSkip }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const handlePasskeyLogin = useCallback(async () => {
    if (!email.trim()) {
      setError("Enter your email first, then click Sign in with Passkey");
      return;
    }
    setError(null);
    setPasskeyLoading(true);

    try {
      const fnHeaders = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };

      const optionsRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/passkey/login-options`,
        {
          method: "POST",
          headers: fnHeaders,
          body: JSON.stringify({ email: email.trim() }),
        }
      );

      if (!optionsRes.ok) {
        const body = await optionsRes.text().catch(() => "");
        throw new Error(body ? JSON.parse(body).error : "Failed to get login options");
      }

      const options = await optionsRes.json();

      const assertion = await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(atob(options.challenge), (c) => c.charCodeAt(0)),
          allowCredentials: (options.allowCredentials ?? []).map((c: any) => ({
            ...c,
            id: Uint8Array.from(atob(c.id), (ch) => ch.charCodeAt(0)),
          })),
        },
      });

      if (!assertion) throw new Error("Authentication cancelled");

      const pkc = assertion as PublicKeyCredential;
      const response = pkc.response as AuthenticatorAssertionResponse;

      const verifyRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/passkey/login-verify`,
        {
          method: "POST",
          headers: fnHeaders,
          body: JSON.stringify({
            email: email.trim(),
            credential: {
              id: pkc.id,
              rawId: btoa(String.fromCharCode(...new Uint8Array(pkc.rawId))),
              type: pkc.type,
              response: {
                authenticatorData: btoa(String.fromCharCode(...new Uint8Array(response.authenticatorData))),
                clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
                signature: btoa(String.fromCharCode(...new Uint8Array(response.signature))),
              },
            },
          }),
        }
      );

      if (!verifyRes.ok) throw new Error("Passkey verification failed");

      const verifyData = await verifyRes.json();
      if (verifyData.session?.access_token && verifyData.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: verifyData.session.access_token,
          refresh_token: verifyData.session.refresh_token,
        });
      } else {
        setError("Passkey verified but session could not be created. Please sign in with your password.");
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "NotAllowedError") {
        setError(err.message);
      }
    }
    setPasskeyLoading(false);
  }, [email]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (mode === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    const fn = mode === "signin" ? onSignIn : onSignUp;
    const result = await fn(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (mode === "signup") {
      setSignupSuccess(true);
    }
  }, [email, password, confirmPassword, mode, onSignIn, onSignUp]);

  if (signupSuccess) {
    return (
      <div className="max-w-md mx-auto mt-16 rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-[#00995a]/10 flex items-center justify-center mx-auto">
          <UserPlus className="h-6 w-6 text-[#00995a] dark:text-[#00F2B3]" />
        </div>
        <h2 className="text-lg font-display font-bold text-foreground">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We've sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
          Click the link to activate your account, then sign in.
        </p>
        <button
          onClick={() => { setMode("signin"); setSignupSuccess(false); }}
          className="text-sm text-[#2006F7] dark:text-[#00EDFF] hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 rounded-xl border border-border bg-card overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => { setMode("signin"); setError(null); }}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${mode === "signin" ? "text-foreground border-b-2 border-[#2006F7] dark:border-[#00EDFF]" : "text-muted-foreground hover:text-foreground"}`}
        >
          <LogIn className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          Sign In
        </button>
        <button
          onClick={() => { setMode("signup"); setError(null); }}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${mode === "signup" ? "text-foreground border-b-2 border-[#2006F7] dark:border-[#00EDFF]" : "text-muted-foreground hover:text-foreground"}`}
        >
          <UserPlus className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>

        {mode === "signup" && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
              autoComplete="new-password"
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-[#EA0022] bg-[#EA0022]/5 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#2006F7] hover:bg-[#10037C] text-white px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
          ) : (
            <>
              {mode === "signin" ? "Sign In" : "Create Account"}
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>

        {mode === "signin" && (
          <button
            type="button"
            onClick={handlePasskeyLogin}
            disabled={passkeyLoading}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-border hover:bg-muted/50 text-foreground px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {passkeyLoading ? (
              <span className="animate-spin h-4 w-4 border-2 border-foreground/30 border-t-foreground rounded-full" />
            ) : (
              <>
                <Fingerprint className="h-4 w-4" />
                Sign in with Passkey
              </>
            )}
          </button>
        )}

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-[10px] text-muted-foreground uppercase tracking-wider">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          Continue as guest — data stays in this browser only
        </button>
      </form>
    </div>
  );
}
