import { useState, useCallback } from "react";
import { useAbortableInFlight } from "@/hooks/use-abortable-in-flight";
import { LogIn, UserPlus, ArrowRight, AlertCircle, Fingerprint, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AuthSignUpResult } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  onSignUp: (email: string, password: string) => Promise<AuthSignUpResult>;
  onSkip: () => void;
  onEnterDemo?: () => Promise<{ error: string | null }>;
}

export function AuthGate({ onSignIn, onSignUp, onSkip, onEnterDemo }: Props) {
  const nextFetchSignal = useAbortableInFlight();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handlePasskeyLogin = useCallback(async () => {
    if (!email.trim()) {
      setError("Enter your email first, then click Sign in with Passkey");
      return;
    }
    setError(null);
    setPasskeyLoading(true);
    const signal = nextFetchSignal();

    try {
      const fnHeaders = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };

      const optionsRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-public/passkey/login-options`,
        {
          method: "POST",
          signal,
          headers: fnHeaders,
          body: JSON.stringify({ email: email.trim() }),
        },
      );

      if (!optionsRes.ok) {
        const body = await optionsRes.text().catch(() => "");
        throw new Error(body ? JSON.parse(body).error : "Failed to get login options");
      }

      const options = await optionsRes.json();
      const { challengeToken, ...webauthnOptions } = options as {
        challengeToken?: string;
        challenge?: string;
        allowCredentials?: Array<Record<string, string>>;
        [key: string]: unknown;
      };
      if (!challengeToken || typeof challengeToken !== "string") {
        throw new Error("Login options missing challenge token — update the app or edge function.");
      }

      const assertion = await navigator.credentials.get({
        publicKey: {
          ...webauthnOptions,
          challenge: Uint8Array.from(atob(options.challenge), (c) => c.charCodeAt(0)),
          allowCredentials: (options.allowCredentials ?? []).map((c: Record<string, string>) => ({
            ...c,
            id: Uint8Array.from(atob(c.id), (ch) => ch.charCodeAt(0)),
          })),
        },
      });

      if (!assertion) throw new Error("Authentication cancelled");

      const pkc = assertion as PublicKeyCredential;
      const response = pkc.response as AuthenticatorAssertionResponse;

      const verifyRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-public/passkey/login-verify`,
        {
          method: "POST",
          signal,
          headers: fnHeaders,
          body: JSON.stringify({
            email: email.trim(),
            challengeToken,
            credential: {
              id: pkc.id,
              rawId: btoa(String.fromCharCode(...new Uint8Array(pkc.rawId))),
              type: pkc.type,
              response: {
                authenticatorData: btoa(
                  String.fromCharCode(...new Uint8Array(response.authenticatorData)),
                ),
                clientDataJSON: btoa(
                  String.fromCharCode(...new Uint8Array(response.clientDataJSON)),
                ),
                signature: btoa(String.fromCharCode(...new Uint8Array(response.signature))),
              },
            },
          }),
        },
      );

      if (!verifyRes.ok) throw new Error("Passkey verification failed");

      const verifyData = await verifyRes.json();
      if (verifyData.session?.access_token && verifyData.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: verifyData.session.access_token,
          refresh_token: verifyData.session.refresh_token,
        });
      } else {
        setError(
          "Passkey verified but session could not be created. Please sign in with your password.",
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (err instanceof Error && err.name !== "NotAllowedError") {
        setError(err.message);
      }
    }
    setPasskeyLoading(false);
  }, [email, nextFetchSignal]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
      try {
        if (mode === "signin") {
          const result = await onSignIn(email.trim(), password);
          if (result.error) {
            setError(result.error);
            toast.error(result.error);
          }
        } else {
          const result = await onSignUp(email.trim(), password);
          if (result.error) {
            setError(result.error);
            toast.error(result.error);
          } else if (result.needsEmailConfirmation) {
            setSignupSuccess(true);
            toast.success("Account created — confirm your email, then sign in.", {
              duration: 12_000,
            });
          } else {
            toast.success(
              "You're signed in. Complete organisation setup next — then you can save reports to the cloud.",
              { duration: 10_000 },
            );
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, confirmPassword, mode, onSignIn, onSignUp],
  );

  if (signupSuccess) {
    return (
      <div className="max-w-md mx-auto mt-16 rounded-[32px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.99),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(10,14,26,0.98),rgba(12,18,34,0.98))] p-8 text-center space-y-4 shadow-[0_20px_60px_rgba(32,6,247,0.10)] overflow-hidden">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
          Enterprise workspace
        </div>
        <div className="h-14 w-14 rounded-2xl bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 flex items-center justify-center mx-auto">
          <UserPlus className="h-7 w-7 text-[#007A5A] dark:text-[#00F2B3]" />
        </div>
        <h2 className="text-2xl font-display font-black text-foreground tracking-tight">
          Confirm your email
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We&apos;ve sent a link to <span className="font-medium text-foreground">{email}</span>.
          Until you confirm, you stay signed out — saved reports and cloud features need a verified
          sign-in. Open the email, confirm, then use{" "}
          <span className="font-medium text-foreground">Sign In</span> below.
        </p>
        <button
          onClick={() => {
            setMode("signin");
            setSignupSuccess(false);
          }}
          className="text-sm text-brand-accent hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 mb-16 rounded-[32px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.08),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.99),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.08),transparent_28%),linear-gradient(135deg,rgba(8,13,26,0.98),rgba(12,18,34,0.98))] overflow-hidden shadow-[0_24px_70px_rgba(32,6,247,0.10)]">
      <div className="h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />

      <div className="px-6 pt-6 pb-4 space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
          Firewall Compliance Workspace
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-display font-black text-foreground tracking-tight">
            Sign in to Sophos FireComply
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Access premium reporting, saved assessments, managed firewall workflows, and
            customer-ready compliance deliverables.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card/70 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Save
            </p>
            <p className="text-xs font-semibold text-foreground mt-1">
              Assessments and generated reports
            </p>
          </div>
          <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card/70 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Manage
            </p>
            <p className="text-xs font-semibold text-foreground mt-1">
              Teams, connectors, and Sophos Central
            </p>
          </div>
          <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card/70 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Deliver
            </p>
            <p className="text-xs font-semibold text-foreground mt-1">
              Executive and compliance-ready outputs
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div data-tour="auth-tabs" className="mx-6 flex rounded-2xl bg-muted/30 p-1 mb-2">
        <button
          onClick={() => {
            setMode("signin");
            setError(null);
          }}
          className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${mode === "signin" ? "bg-background text-brand-accent shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <LogIn className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          Sign In
        </button>
        <button
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
          className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${mode === "signup" ? "bg-background text-brand-accent shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <UserPlus className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="rounded-2xl border border-border/50 bg-card/75 p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              className="bg-background/80"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="bg-background/80"
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Confirm Password
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="bg-background/80"
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-[#EA0022] bg-[#EA0022]/5 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? (
              <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>
                {mode === "signin" ? "Sign In" : "Create Account"}
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>

          {mode === "signin" && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePasskeyLogin}
              disabled={passkeyLoading}
              data-tour="auth-passkey"
              className="w-full gap-2"
            >
              {passkeyLoading ? (
                <span className="animate-spin h-4 w-4 border-2 border-foreground/30 border-t-foreground rounded-full" />
              ) : (
                <>
                  <Fingerprint className="h-4 w-4" />
                  Sign in with Passkey
                </>
              )}
            </Button>
          )}
        </div>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-transparent px-3 text-[10px] text-muted-foreground uppercase tracking-wider">
              or
            </span>
          </div>
        </div>

        {onEnterDemo && (
          <Button
            type="button"
            variant="outline"
            data-tour="auth-demo"
            onClick={async () => {
              setError(null);
              setDemoLoading(true);
              try {
                const result = await onEnterDemo();
                if (result.error) {
                  setError(result.error);
                  toast.error(result.error);
                }
              } finally {
                setDemoLoading(false);
              }
            }}
            disabled={demoLoading}
            className="w-full gap-2 border-brand-accent/20 text-brand-accent hover:bg-brand-accent/5"
          >
            {demoLoading ? (
              <span className="animate-spin h-4 w-4 border-2 border-brand-accent/30 border-t-brand-accent rounded-full" />
            ) : (
              <>
                <Play className="h-4 w-4" />
                Demo mode
              </>
            )}
          </Button>
        )}

        <div
          data-tour="auth-guest"
          className="rounded-2xl border border-dashed border-border bg-background/50 px-4 py-3 text-center"
        >
          <button
            type="button"
            onClick={onSkip}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Continue as guest — data stays in this browser only
          </button>
        </div>
      </form>
    </div>
  );
}
