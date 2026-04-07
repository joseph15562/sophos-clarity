import { NavLink, useLocation } from "react-router-dom";
import { BookMarked } from "lucide-react";
import { cn } from "@/lib/utils";
import { HELP_DOC_NAV, type HelpDocNavItem } from "@/data/help-doc-nav";

function itemLooksActive(pathname: string, item: HelpDocNavItem, navLinkActive: boolean) {
  if (navLinkActive) return true;
  if (item.activeWhenPathPrefix && pathname.startsWith(item.activeWhenPathPrefix)) return true;
  return item.activeWhenExactPaths?.some((p) => pathname === p) ?? false;
}

function navClassName(active: boolean) {
  return cn(
    "block rounded-lg px-3 py-2 text-sm transition-colors border border-transparent",
    active
      ? "bg-brand-accent/10 text-foreground font-semibold border-brand-accent/20"
      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
  );
}

export function HelpDocSideNav() {
  const { pathname } = useLocation();

  return (
    <>
      <aside className="hidden xl:block">
        <nav aria-label="Documentation" className="sticky top-28 space-y-6 pr-2">
          <div className="flex items-center gap-2 text-foreground font-display font-bold text-sm border-b border-border/60 pb-3">
            <BookMarked className="h-4 w-4 text-brand-accent shrink-0" />
            Documentation
          </div>
          {HELP_DOC_NAV.map((section) => (
            <div key={section.id}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        navClassName(itemLooksActive(pathname, item, isActive))
                      }
                    >
                      <span className="block">{item.label}</span>
                      <span className="block text-[10px] font-normal text-muted-foreground mt-0.5 leading-snug">
                        {item.description}
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="xl:hidden rounded-xl border border-border/60 bg-muted/30 px-3 py-2 mb-4">
        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Documentation
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {HELP_DOC_NAV.flatMap((s) => s.items).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
                  itemLooksActive(pathname, item, isActive)
                    ? "border-brand-accent/40 bg-brand-accent/10 text-foreground font-medium"
                    : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
}
