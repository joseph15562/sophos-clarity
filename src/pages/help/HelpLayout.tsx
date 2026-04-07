import { Outlet } from "react-router-dom";
import { AuthProvider, useAuthProvider } from "@/hooks/use-auth";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { HelpDocSideNav } from "@/components/help/HelpDocSideNav";

function HelpLayoutInner() {
  return (
    <div className="min-h-screen bg-background">
      <FireComplyWorkspaceHeader />
      <WorkspacePrimaryNav />
      <main id="main-content" className="mx-auto max-w-[1320px] px-4 md:px-6 py-6 md:py-10">
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,240px)_minmax(0,1fr)] xl:gap-12">
          <HelpDocSideNav />
          <div className="min-w-0 max-w-3xl xl:max-w-none">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function HelpLayout() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <HelpLayoutInner />
    </AuthProvider>
  );
}
