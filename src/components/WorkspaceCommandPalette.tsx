import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Stethoscope,
  Settings,
  ClipboardList,
  Search,
  Cloud,
  Radar,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

const NAV = [
  { to: "/dashboard", label: "Mission control", icon: Radar },
  { to: "/", label: "Assess", icon: LayoutDashboard },
  { to: "/command", label: "Fleet", icon: Monitor },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/central/overview", label: "Sophos Central", icon: Cloud },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/drift", label: "Drift", icon: GitCompare },
  { to: "/playbooks", label: "Playbooks", icon: BookOpen },
  { to: "/api", label: "API & Integrations", icon: Code2 },
  { to: "/audit", label: "Activity log", icon: ClipboardList },
  { to: "/trust", label: "Trust", icon: Shield },
  { to: "/changelog", label: "Updates", icon: ScrollText },
] as const;

/** Dispatched from command palette; Index listens to open ManagementDrawer. */
export const OPEN_MANAGEMENT_EVENT = "firecomply:open-management";

export function WorkspaceCommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const run = useCallback(
    (fn: () => void) => {
      setOpen(false);
      fn();
    },
    [setOpen],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search workspace…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Workspace">
          {NAV.map(({ to, label, icon: Icon }) => (
            <CommandItem key={to} value={`${label} ${to}`} onSelect={() => run(() => navigate(to))}>
              <Icon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="health check se"
            onSelect={() => run(() => navigate("/health-check"))}
          >
            <Stethoscope className="mr-2 h-4 w-4 shrink-0 opacity-70" />
            SE Health Check
          </CommandItem>
          <CommandItem
            value="workspace settings management"
            onSelect={() =>
              run(() => {
                window.dispatchEvent(new CustomEvent(OPEN_MANAGEMENT_EVENT));
              })
            }
          >
            <Settings className="mr-2 h-4 w-4 shrink-0 opacity-70" />
            Workspace settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground flex items-center gap-2">
        <Search className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        <span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>{" "}
          open · navigate · enter
        </span>
      </div>
    </CommandDialog>
  );
}
