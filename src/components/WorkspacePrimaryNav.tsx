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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Assess" },
  { to: "/command", icon: Monitor, label: "Fleet" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/insights", icon: BarChart3, label: "Insights" },
  { to: "/drift", icon: GitCompare, label: "Drift" },
  { to: "/playbooks", icon: BookOpen, label: "Playbooks" },
  { to: "/api", icon: Code2, label: "API" },
  { to: "/trust", icon: Shield, label: "Trust" },
  { to: "/changelog", icon: ScrollText, label: "Updates" },
] as const;

/** Active tab for primary workspace routes (e.g. saved reports live under `/reports/...`). */
export function isWorkspaceNavItemActive(pathname: string, to: string): boolean {
  if (to === "/reports") {
    return pathname === "/reports" || pathname.startsWith("/reports/");
  }
  return pathname === to;
}

/**
 * Primary workspace tabs (Assess, Fleet, …) shown under the main header when the user
 * is signed in with an organisation. Used on Assess and every hub page.
 */
export function WorkspacePrimaryNav() {
  const { org, isGuest } = useAuth();
  const location = useLocation();

  if (isGuest || !org) return null;

  return (
    <nav
      className="workspace-nav-bar border-b border-[#10037C]/15 bg-[linear-gradient(90deg,#001030_0%,#001440_42%,#0D0268_100%)] no-print"
      style={{ backgroundColor: "#001030" }}
      aria-label="Workspace"
    >
      <div className="max-w-[1320px] mx-auto px-4 md:px-6 flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const active = isWorkspaceNavItemActive(location.pathname, to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                active
                  ? "text-white border-b-2 border-[#00EDFF]"
                  : "text-[#9BB0D3] hover:text-white border-b-2 border-transparent"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
