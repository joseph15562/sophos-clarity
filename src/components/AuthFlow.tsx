import {
  useState,
  ReactNode,
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
} from "react";
import { AuthProvider, type AuthState } from "@/hooks/use-auth";
import { AuthGate } from "@/components/AuthGate";
import { OrgSetup } from "@/components/OrgSetup";
import { MfaVerification } from "@/components/MfaVerification";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useResolvedThemeClass } from "@/hooks/use-resolved-appearance";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AuthFlowProps {
  auth: AuthState;
  children: ReactNode;
}

function AuthChromeHeader({
  isDark,
  badge,
  subtitle,
  rightPill,
}: {
  isDark: boolean;
  badge: string;
  subtitle: string;
  rightPill?: string;
}) {
  const { setTheme } = useTheme();

  return (
    <header
      className={cn(
        "border-b",
        isDark
          ? "border-[#10037C]/20 bg-[radial-gradient(circle_at_top_left,rgba(0,237,255,0.10),transparent_18%),radial-gradient(circle_at_top_right,rgba(32,6,247,0.20),transparent_24%),linear-gradient(90deg,#00163d_0%,#001A47_42%,#10037C_100%)] shadow-[0_16px_40px_rgba(0,10,35,0.32)]"
          : "border-border bg-card/90 backdrop-blur-md shadow-sm",
      )}
    >
      <div className="max-w-[1320px] mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl border shadow-elevated shrink-0",
            isDark ? "border-white/10 bg-white/5" : "border-border bg-background",
          )}
        >
          <img
            src={isDark ? "/sophos-icon-white.svg" : "/brand/sophos-icon-blue.svg"}
            alt="Sophos"
            className="h-7 w-7"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "mb-1 inline-flex max-w-full shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1",
              isDark
                ? "border-white/10 bg-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
                : "border-border bg-muted/80 text-foreground shadow-none",
            )}
          >
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                isDark ? "bg-[#00F2B3]" : "bg-emerald-600",
              )}
            />
            <span
              className={cn(
                "text-[9px] font-semibold uppercase tracking-[0.22em]",
                isDark ? "text-[#D6E0FF]" : "text-foreground",
              )}
            >
              {badge}
            </span>
          </div>
          <h1
            className={cn(
              "text-lg font-display font-black leading-tight tracking-tight",
              isDark ? "text-white" : "text-foreground",
            )}
          >
            Sophos FireComply
          </h1>
          <p
            className={cn(
              "max-w-2xl text-[11px] leading-snug",
              isDark ? "text-[#9BB0D3]" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </p>
        </div>
        {rightPill != null && (
          <div
            className={cn(
              "hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-1.5 text-[10px] font-medium md:flex",
              isDark
                ? "border-white/10 bg-white/[0.06] text-[#D6E0FF]"
                : "border-border bg-muted/80 text-foreground",
            )}
          >
            <span
              className={cn(
                "inline-block h-2 w-2 shrink-0 rounded-full",
                isDark ? "bg-[#00F2B3]" : "bg-emerald-600",
              )}
            />
            {rightPill}
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={cn(
            "h-8 w-8 shrink-0 rounded-xl border",
            isDark
              ? "border-white/25 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/18 hover:text-white"
              : "border-border bg-background text-foreground hover:bg-muted",
          )}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

/**
 * Wraps the main app content with auth gating logic:
 * - Loading state
 * - Guest gate (sign in / skip)
 * - Org setup (for new users)
 * - MFA verification
 * - Main content (when authenticated)
 */
export function AuthFlow({ auth, children }: AuthFlowProps) {
  const [guestMode, setGuestMode] = useState(false);
  const theme = useResolvedThemeClass();
  const isDark = theme === "dark";

  if (auth.isLoading) {
    return (
      <AuthProvider value={auth}>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
          <img
            src={isDark ? "/sophos-icon-white.svg" : "/brand/sophos-icon-blue.svg"}
            alt="Sophos"
            className="h-10 w-10 opacity-60"
          />
          <span
            className={cn(
              "animate-spin h-8 w-8 border-[3px] border-t-[#2006F7] rounded-full",
              isDark ? "border-white/20" : "border-border",
            )}
          />
          <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
        </div>
      </AuthProvider>
    );
  }

  if (auth.isGuest && !guestMode) {
    return (
      <AuthProvider value={auth}>
        <div className="min-h-screen bg-background">
          <AuthChromeHeader
            isDark={isDark}
            badge="Firewall Compliance Workspace"
            subtitle="Executive-ready firewall security assessments, managed reporting, and compliance deliverables."
            rightPill="Boardroom-ready reporting"
          />
          <AuthGate
            onSignIn={auth.signIn}
            onSignUp={auth.signUp}
            onSkip={() => setGuestMode(true)}
            onEnterDemo={
              import.meta.env.VITE_PUBLIC_DEMO_ENABLED === "1" ? auth.enterDemoMode : undefined
            }
          />
        </div>
      </AuthProvider>
    );
  }

  if (auth.needsOrg) {
    return (
      <AuthProvider value={auth}>
        <div className="min-h-screen bg-background">
          <AuthChromeHeader
            isDark={isDark}
            badge="Workspace setup"
            subtitle="Set up your organisation workspace to unlock saved assessments, team management, and managed reporting."
          />
          <OrgSetup
            userEmail={auth.user?.email ?? ""}
            onCreateOrg={auth.createOrg}
            onSignOut={auth.signOut}
          />
        </div>
      </AuthProvider>
    );
  }

  if (auth.needsMfa) {
    return (
      <AuthProvider value={auth}>
        <div className="min-h-screen bg-background">
          <AuthChromeHeader
            isDark={isDark}
            badge="Secure verification"
            subtitle="Complete multi-factor verification to enter your workspace securely."
          />
          <MfaVerification
            onVerified={() => auth.clearMfaRequired()}
            onCancel={() => auth.signOut()}
          />
        </div>
      </AuthProvider>
    );
  }

  const child = Children.only(children);
  const onShowAuth = auth.isGuest ? () => setGuestMode(false) : undefined;

  return (
    <AuthProvider value={auth}>
      <ErrorBoundary fallbackTitle="Application failed to load">
        {isValidElement(child)
          ? cloneElement(child as ReactElement<{ onShowAuth?: () => void }>, { onShowAuth })
          : children}
      </ErrorBoundary>
    </AuthProvider>
  );
}
