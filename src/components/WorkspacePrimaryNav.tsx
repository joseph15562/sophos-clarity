import { Fragment, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Monitor,
  Users,
  FileText,
  BarChart3,
  GitCompare,
  BookOpen,
  Code2,
  Shield,
  ScrollText,
  Cloud,
  Radar,
  LifeBuoy,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const NAV_ITEMS = [
  { to: "/dashboard", icon: Radar, label: "Mission control" },
  { to: "/", icon: LayoutDashboard, label: "Assess" },
  { to: "/command", icon: Monitor, label: "Fleet" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/central", icon: Cloud, label: "Central" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/insights", icon: BarChart3, label: "Insights" },
  { to: "/drift", icon: GitCompare, label: "Drift" },
  { to: "/playbooks", icon: BookOpen, label: "Playbooks" },
  { to: "/api", icon: Code2, label: "API" },
  { to: "/trust", icon: Shield, label: "Trust" },
  { to: "/changelog", icon: ScrollText, label: "Updates" },
  { to: "/help", icon: LifeBuoy, label: "Docs" },
] as const;

export type WorkspacePrimaryNavProps = {
  /**
   * Renders **below** the navy workspace tab bar, on the normal page surface (not inside the menu chrome).
   */
  pageActions?: ReactNode;
};

/** Active tab for primary workspace routes (e.g. saved reports live under `/reports/...`). */
export function isWorkspaceNavItemActive(pathname: string, to: string): boolean {
  if (to === "/reports") {
    return pathname === "/reports" || pathname.startsWith("/reports/");
  }
  if (to === "/central") {
    return pathname === "/central" || pathname.startsWith("/central/");
  }
  if (to === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (to === "/help") {
    return pathname === "/help" || pathname.startsWith("/help/");
  }
  return pathname === to;
}

const navShell =
  "workspace-nav-bar no-print relative isolate border-b border-[#10037C]/20 bg-[linear-gradient(90deg,#000d28_0%,#001850_38%,#12007a_55%,#0D0268_100%)] shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55),0_0_60px_-20px_rgba(0,237,255,0.12)] backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md";
const navShellStyle = { backgroundColor: "#001030" } as const;

function WorkspacePageToolbar({ children }: { children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label="Page actions"
      className="no-print border-b border-border bg-muted/50 dark:bg-muted/25"
    >
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center justify-end gap-2 px-4 py-3 md:px-6">
        {children}
      </div>
    </div>
  );
}

/**
 * Navy workspace tabs under the main header. Optional {@link pageActions} render on the **page**
 * background in a separate band below the nav (not part of the dark menu strip).
 */
export function WorkspacePrimaryNav({ pageActions }: WorkspacePrimaryNavProps = {}) {
  const { org, isGuest } = useAuth();
  const location = useLocation();

  const signedIn = Boolean(org && !isGuest);

  if (!signedIn) {
    if (!pageActions) return null;
    return <WorkspacePageToolbar>{pageActions}</WorkspacePageToolbar>;
  }

  return (
    <Fragment>
      <nav
        className={navShell}
        style={navShellStyle}
        aria-label="Workspace"
        data-tour="workspace-primary-nav"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00EDFF]/35 to-transparent" />
          <div className="absolute inset-y-0 left-1/2 h-full w-[min(55%,420px)] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-[#00EDFF]/95 to-transparent opacity-90 blur-[0.5px] motion-reduce:animate-none animate-fc-nav-shimmer" />
        </div>
        <div className="relative z-[1] mx-auto flex max-w-[1320px] items-center gap-1 overflow-x-auto px-4 scrollbar-hide md:px-6">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = isWorkspaceNavItemActive(location.pathname, to);
            return (
              <Link
                key={to}
                to={to}
                className={`relative z-[1] flex items-center gap-1.5 rounded-t-md px-3 py-2.5 text-[11px] font-medium transition-[color,background-color,border-color,box-shadow,transform] whitespace-nowrap ${
                  active
                    ? "text-white border-b-2 border-[#00EDFF] font-semibold drop-shadow-[0_0_18px_rgba(0,237,255,0.55)] shadow-[0_-12px_28px_-8px_rgba(0,237,255,0.2)]"
                    : "text-[#9BB0D3] hover:text-white border-b-2 border-transparent hover:bg-white/[0.1] hover:scale-[1.02] motion-reduce:hover:scale-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      {pageActions ? <WorkspacePageToolbar>{pageActions}</WorkspacePageToolbar> : null}
    </Fragment>
  );
}
