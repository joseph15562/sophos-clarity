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
          <header className="border-b border-[#10037C]/20 bg-[radial-gradient(circle_at_top_left,rgba(0,237,255,0.10),transparent_18%),radial-gradient(circle_at_top_right,rgba(32,6,247,0.20),transparent_24%),linear-gradient(90deg,#00163d_0%,#001A47_42%,#10037C_100%)] shadow-[0_16px_40px_rgba(0,10,35,0.32)]">
            <div className="max-w-[1320px] mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-elevated shrink-0">
                <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 mb-1 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00F2B3]" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#B6C4FF]">Firewall Compliance Workspace</span>
                </div>
                <h1 className="text-lg font-display font-black text-white leading-tight tracking-tight">Sophos FireComply</h1>
                <p className="text-[11px] text-[#9BB0D3] max-w-2xl">Executive-ready firewall security assessments, managed reporting, and compliance deliverables.</p>
              </div>
              <div className="hidden md:flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] text-[#B6C4FF] shrink-0">
                <span className="inline-block h-2 w-2 rounded-full bg-[#00F2B3]" />
                Boardroom-ready reporting
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
          <header className="border-b border-[#10037C]/20 bg-[radial-gradient(circle_at_top_left,rgba(0,237,255,0.10),transparent_18%),radial-gradient(circle_at_top_right,rgba(32,6,247,0.20),transparent_24%),linear-gradient(90deg,#00163d_0%,#001A47_42%,#10037C_100%)] shadow-[0_16px_40px_rgba(0,10,35,0.32)]">
            <div className="max-w-[1320px] mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-elevated shrink-0">
                <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 mb-1 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00F2B3]" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#B6C4FF]">Workspace setup</span>
                </div>
                <h1 className="text-lg font-display font-black text-white leading-tight tracking-tight">Sophos FireComply</h1>
                <p className="text-[11px] text-[#9BB0D3] max-w-2xl">Set up your organisation workspace to unlock saved assessments, team management, and managed reporting.</p>
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
          <header className="border-b border-[#10037C]/20 bg-[radial-gradient(circle_at_top_left,rgba(0,237,255,0.10),transparent_18%),radial-gradient(circle_at_top_right,rgba(32,6,247,0.20),transparent_24%),linear-gradient(90deg,#00163d_0%,#001A47_42%,#10037C_100%)] shadow-[0_16px_40px_rgba(0,10,35,0.32)]">
            <div className="max-w-[1320px] mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-elevated shrink-0">
                <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 mb-1 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00F2B3]" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#B6C4FF]">Secure verification</span>
                </div>
                <h1 className="text-lg font-display font-black text-white leading-tight tracking-tight">Sophos FireComply</h1>
                <p className="text-[11px] text-[#9BB0D3] max-w-2xl">Complete multi-factor verification to enter your workspace securely.</p>
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
