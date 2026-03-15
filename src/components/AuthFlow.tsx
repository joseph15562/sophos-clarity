import { useState, ReactNode, Children, cloneElement, isValidElement, type ReactElement } from "react";
import { AuthProvider, type AuthState } from "@/hooks/use-auth";
import { AuthGate } from "@/components/AuthGate";
import { OrgSetup } from "@/components/OrgSetup";
import { MfaVerification } from "@/components/MfaVerification";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export interface AuthFlowProps {
  auth: AuthState;
  children: ReactNode;
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

  if (auth.isLoading) {
    return (
      <AuthProvider value={auth}>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
          <img src="/sophos-icon-white.svg" alt="Sophos" className="h-10 w-10 opacity-60" />
          <span className="animate-spin h-8 w-8 border-[3px] border-white/20 border-t-[#2006F7] rounded-full" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
        </div>
      </AuthProvider>
    );
  }

  if (auth.isGuest && !guestMode) {
    return (
      <AuthProvider value={auth}>
        <div className="min-h-screen bg-background">
          <header className="border-b border-[#10037C]/20 bg-[#001A47]">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
              <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
              <div className="flex-1">
                <h1 className="text-base font-display font-bold text-white leading-tight tracking-tight">Sophos FireComply</h1>
                <p className="text-[11px] text-[#6A889B]">Firewall Configuration Assessment & Compliance Reporting</p>
              </div>
            </div>
          </header>
          <AuthGate onSignIn={auth.signIn} onSignUp={auth.signUp} onSkip={() => setGuestMode(true)} />
        </div>
      </AuthProvider>
    );
  }

  if (auth.needsOrg) {
    return (
      <AuthProvider value={auth}>
        <div className="min-h-screen bg-background">
          <header className="border-b border-[#10037C]/20 bg-[#001A47]">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
              <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
              <div className="flex-1">
                <h1 className="text-base font-display font-bold text-white leading-tight tracking-tight">Sophos FireComply</h1>
                <p className="text-[11px] text-[#6A889B]">Firewall Configuration Assessment & Compliance Reporting</p>
              </div>
            </div>
          </header>
          <OrgSetup userEmail={auth.user?.email ?? ""} onCreateOrg={auth.createOrg} onSignOut={auth.signOut} />
        </div>
      </AuthProvider>
    );
  }

  if (auth.needsMfa) {
    return (
      <AuthProvider value={auth}>
        <div className="min-h-screen bg-background">
          <header className="border-b border-[#10037C]/20 bg-[#001A47]">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
              <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
              <div className="flex-1">
                <h1 className="text-base font-display font-bold text-white leading-tight tracking-tight">Sophos FireComply</h1>
                <p className="text-[11px] text-[#6A889B]">Firewall Configuration Assessment & Compliance Reporting</p>
              </div>
            </div>
          </header>
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
