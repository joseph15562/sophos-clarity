import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEAuthGate } from "@/components/SEAuthGate";
import { useSEAuthProvider, SEAuthProvider } from "@/hooks/use-se-auth";
import { ActiveTeamProvider } from "@/hooks/use-active-team";
import { CompleteProfileGate } from "./health-check/CompleteProfileGate";
import { HealthCheckInner } from "./health-check/HealthCheckInner";

export default function HealthCheck() {
  const seAuth = useSEAuthProvider();

  if (seAuth.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <span
          className="h-9 w-9 rounded-full border-2 border-[#001A47]/20 border-t-[#2006F7] dark:border-white/25 dark:border-t-[#00F2B3] animate-spin"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Loading SE Health Check…</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            If nothing appears after a few seconds, refresh the page or check your connection.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 text-xs text-brand-accent hover:underline"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }

  if (!seAuth.isAuthenticated) {
    const sophosSession = !!seAuth.user?.email && /@sophos\.com$/i.test(seAuth.user.email.trim());
    if (seAuth.user && sophosSession && !seAuth.seProfile) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
          <Card className="max-w-lg w-full border-[#F29400]/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-[#F29400] shrink-0" aria-hidden />
                Couldn&apos;t load your SE profile
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                You&apos;re signed in as{" "}
                <span className="font-medium text-foreground">{seAuth.user.email}</span>, but this
                app couldn&apos;t read or create your row in{" "}
                <code className="text-xs bg-muted px-1 rounded">se_profiles</code>. That usually
                means database permissions (RLS), a missing migration, or a network issue — not your
                password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask your admin to verify{" "}
                <code className="text-xs bg-muted px-1 rounded">se_profiles</code> and Supabase
                policies, then try again.
              </p>
              <Button
                type="button"
                variant="default"
                className="w-full"
                onClick={() => void seAuth.signOut()}
              >
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return <SEAuthGate onSignIn={seAuth.signIn} onSignUp={seAuth.signUp} />;
  }

  if (seAuth.seProfile && !seAuth.seProfile.profileCompleted) {
    return <CompleteProfileGate seAuth={seAuth} />;
  }

  return (
    <SEAuthProvider value={seAuth}>
      <ActiveTeamProvider seProfileId={seAuth.seProfile?.id ?? null}>
        <HealthCheckInner />
      </ActiveTeamProvider>
    </SEAuthProvider>
  );
}
