import { useState, useCallback } from "react";
import { LogIn, UserPlus, ArrowRight, AlertCircle, Shield } from "lucide-react";
import { toast } from "sonner";
import type { AuthSignUpResult } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  onSignUp: (email: string, password: string, fullName?: string) => Promise<AuthSignUpResult>;
}

const SOPHOS_DOMAIN_RE = /@sophos\.com$/i;

export function SEAuthGate({ onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmedEmail = email.trim();

      if (!trimmedEmail || !password.trim()) {
        setError("Email and password are required");
        return;
      }

      if (!SOPHOS_DOMAIN_RE.test(trimmedEmail)) {
        setError(
          "Only @sophos.com email addresses are allowed. Please use your Sophos corporate email.",
        );
        return;
      }

      if (mode === "signup" && password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      if (mode === "signup" && !fullName.trim()) {
        setError("Full name is required");
        return;
      }

      if (mode === "signup" && password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }

      setLoading(true);
      try {
        if (mode === "signin") {
          const result = await onSignIn(trimmedEmail, password);
          if (result.error) {
            setError(result.error);
            toast.error(result.error);
          }
        } else {
          const result = await onSignUp(trimmedEmail, password, fullName.trim());
          if (result.error) {
            setError(result.error);
            toast.error(result.error);
          } else if (result.needsEmailConfirmation) {
            setSignupSuccess(true);
            toast.success("Account created — confirm your email, then sign in.", {
              duration: 12_000,
            });
          } else {
            toast.success("You're signed in. Complete your SE profile if prompted.", {
              duration: 10_000,
            });
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [email, fullName, password, confirmPassword, mode, onSignIn, onSignUp],
  );

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card p-8 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 flex items-center justify-center mx-auto">
            <UserPlus className="h-6 w-6 text-[#007A5A] dark:text-[#00F2B3]" />
          </div>
          <h2 className="text-lg font-display font-bold text-foreground">Confirm your email</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a link to <span className="font-medium text-foreground">{email}</span>.
            Until you confirm, you stay signed out. Open the email, activate your account, then use
            Sign In.
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
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      data-testid="se-health-check-auth-gate"
    >
      <header className="border-b border-[#10037C]/20 bg-[#001A47]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-display font-bold text-white leading-tight tracking-tight">
              Sophos SE Health Check
            </h1>
            <p className="text-[11px] text-[#6A889B]">
              Snapshot firewall best-practice check for Sophos Sales Engineers
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="h-14 w-14 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center mx-auto">
              <Shield className="h-8 w-8 text-brand-accent" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">SE Sign In</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              This tool is restricted to Sophos employees. Please use your{" "}
              <span className="font-medium text-foreground">@sophos.com</span> email address.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card overflow-hidden">
            <div className="flex border-b border-border">
              <button
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${mode === "signin" ? "text-foreground border-b-2 border-[#2006F7] dark:border-[#00EDFF]" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LogIn className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                Sign In
              </button>
              <button
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${mode === "signup" ? "text-foreground border-b-2 border-[#2006F7] dark:border-[#00EDFF]" : "text-muted-foreground hover:text-foreground"}`}
              >
                <UserPlus className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Joseph McDonald"
                    className="bg-background/80"
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Sophos Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="firstname.lastname@sophos.com"
                  className="bg-background/80"
                  autoComplete="email"
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
                  className="bg-background/80"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
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
                    className="bg-background/80"
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
            </form>
          </div>

          <p className="text-center text-[10px] text-muted-foreground">
            Your SE account is separate from the MSP FireComply platform. Sophos employees can use
            both independently.
          </p>
        </div>
      </div>
    </div>
  );
}
