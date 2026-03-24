import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertTriangle, Loader2, Users, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type PageState = "loading" | "accepting" | "success" | "wrong-user" | "already-member" | "expired" | "invalid" | "needs-auth" | "error";

export default function TeamInviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [teamName, setTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const acceptInvite = useCallback(async (accessToken: string) => {
    if (!token) return;
    setPageState("accepting");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/api/se-teams/accept-invite/${token}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_KEY,
        },
      });
      const data = await res.json();

      if (res.ok) {
        setTeamName(data.team_name ?? "");
        setPageState("success");
        return;
      }

      if (res.status === 403 && data.error?.startsWith("This invite is for")) {
        setInviteEmail(data.error.replace("This invite is for ", ""));
        setPageState("wrong-user");
      } else if (res.status === 409) {
        setPageState("already-member");
      } else if (res.status === 410) {
        setPageState("expired");
      } else if (res.status === 404) {
        setPageState("invalid");
      } else {
        setErrorMsg(data.error || "Something went wrong");
        setPageState("error");
      }
    } catch {
      setErrorMsg("Network error — please try again.");
      setPageState("error");
    }
  }, [token]);

  useEffect(() => {
    if (!token) { setPageState("invalid"); return; }

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await acceptInvite(session.access_token);
      } else {
        setPageState("needs-auth");
      }
    };
    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await acceptInvite(session.access_token);
      }
    });
    return () => subscription.unsubscribe();
  }, [token, acceptInvite]);

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: window.location.href,
        scopes: "email profile openid",
      },
    });
  };

  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-[#2006F7] to-[#4A20F7] shadow-lg mb-4">
            <Users className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Sophos FireComply</h1>
          <p className="text-sm text-muted-foreground mt-1">Team Invite</p>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm p-8">
          {(pageState === "loading" || pageState === "accepting") && (
            <div className="text-center space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-[#2006F7] mx-auto" />
              <p className="text-sm text-muted-foreground">
                {pageState === "loading" ? "Checking invite…" : "Joining team…"}
              </p>
            </div>
          )}

          {pageState === "success" && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-semibold">You're in!</h2>
              <p className="text-sm text-muted-foreground">
                You've joined {teamName ? <strong>{teamName}</strong> : "the team"} successfully.
              </p>
              <Button
                className={cn("mt-4 bg-[#2006F7] hover:bg-[#2006F7]/90 text-white")}
                onClick={() => navigate("/health-check-2")}
              >
                Go to Health Check
              </Button>
            </div>
          )}

          {pageState === "needs-auth" && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mx-auto">
                <LogIn className="h-8 w-8 text-[#2006F7]" />
              </div>
              <h2 className="text-lg font-semibold">Sign in to continue</h2>
              <p className="text-sm text-muted-foreground">
                Sign in with your Sophos account to accept this team invite.
              </p>
              <Button
                className={cn("mt-4 bg-[#2006F7] hover:bg-[#2006F7]/90 text-white")}
                onClick={() => void handleSignIn()}
              >
                <LogIn className="h-4 w-4 mr-2" /> Sign in
              </Button>
            </div>
          )}

          {pageState === "wrong-user" && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mx-auto">
                <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold">Wrong account</h2>
              <p className="text-sm text-muted-foreground">
                This invite is for <strong>{inviteEmail}</strong>. Please sign in with that account.
              </p>
            </div>
          )}

          {pageState === "already-member" && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mx-auto">
                <Users className="h-8 w-8 text-[#2006F7]" />
              </div>
              <h2 className="text-lg font-semibold">Already a member</h2>
              <p className="text-sm text-muted-foreground">
                You're already a member of this team.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate("/health-check-2")}
              >
                Go to Health Check
              </Button>
            </div>
          )}

          {pageState === "expired" && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mx-auto">
                <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold">Invite expired</h2>
              <p className="text-sm text-muted-foreground">
                This invite has expired. Ask the team admin to send a new one.
              </p>
            </div>
          )}

          {pageState === "invalid" && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold">Invalid invite</h2>
              <p className="text-sm text-muted-foreground">
                This invite link is invalid or has already been used.
              </p>
            </div>
          )}

          {pageState === "error" && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold">Something went wrong</h2>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
