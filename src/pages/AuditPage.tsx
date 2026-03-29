import { Link } from "react-router-dom";
import { ArrowLeft, ScrollText, PanelRight } from "lucide-react";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuditLog } from "@/components/AuditLog";
import { Button } from "@/components/ui/button";
import { buildManagePanelSearch } from "@/lib/workspace-deeplink";

function AuditPageInner() {
  const { org, isGuest } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Button variant="ghost" size="sm" className="gap-2" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Assess
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
            <Link
              to={{
                pathname: "/",
                search: buildManagePanelSearch({ panel: "settings", section: "audit" }),
              }}
            >
              <PanelRight className="h-3.5 w-3.5" />
              Open in workspace drawer
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-brand-accent" />
            <h1 className="text-base font-semibold tracking-tight">Activity log</h1>
          </div>
          {org && (
            <span className="ml-auto truncate text-xs text-muted-foreground hidden sm:inline max-w-[200px]">
              {org.name}
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {isGuest ? (
          <p className="text-sm text-muted-foreground">Sign in to view workspace activity.</p>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/30">
            <AuditLog layout="page" />
          </div>
        )}
      </main>
    </div>
  );
}

export default function AuditPage() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <AuditPageInner />
    </AuthProvider>
  );
}
