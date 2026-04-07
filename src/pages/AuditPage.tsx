import { Link } from "react-router-dom";
import { PanelRight } from "lucide-react";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuditLog } from "@/components/AuditLog";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import { Button } from "@/components/ui/button";
import { buildManagePanelSearch } from "@/lib/workspace-deeplink";

function AuditPageInner() {
  const { isGuest } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <FireComplyWorkspaceHeader loginShell={isGuest} />
      <WorkspacePrimaryNav
        pageActions={
          <div data-tour="tour-audit-actions">
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link
                to={{
                  pathname: "/",
                  search: buildManagePanelSearch({ panel: "settings", section: "audit" }),
                }}
              >
                <PanelRight className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open in drawer</span>
              </Link>
            </Button>
          </div>
        }
      />
      <main
        className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 assist-chrome-pad-bottom"
        data-tour="tour-page-audit"
      >
        <h1 className="mb-4 text-lg font-semibold tracking-tight text-foreground">Activity log</h1>
        {isGuest ? (
          <p className="text-sm text-muted-foreground">Sign in to view workspace activity.</p>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/30" data-tour="tour-audit-log">
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
