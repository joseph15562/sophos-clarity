import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export const CENTRAL_SUBLINKS = [
  { to: "/central/overview", label: "Overview" },
  { to: "/central/tenants", label: "Tenants" },
  { to: "/central/firewalls", label: "Firewalls" },
  { to: "/central/alerts", label: "Alerts" },
  { to: "/central/mdr", label: "MDR" },
  { to: "/central/groups", label: "Groups" },
  { to: "/central/licensing", label: "Licensing" },
  { to: "/central/sync", label: "Sync" },
] as const;

export function CentralSubnav() {
  return (
    <div className="border-b border-border/60 bg-muted/20" data-tour="central-subnav">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-4 py-2 sm:px-6">
        {CENTRAL_SUBLINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-[#2006F7]/15 text-[#2006F7] dark:bg-[#00EDFF]/10 dark:text-[#00EDFF]"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
