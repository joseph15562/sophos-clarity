import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useResolvedIsDark } from "@/hooks/use-resolved-appearance";
import { cn } from "@/lib/utils";

export type WorkspaceSubpageHeaderProps = {
  title: string;
  titleIcon?: ReactNode;
  /** Shown to the right of the theme toggle (e.g. primary actions). */
  actions?: ReactNode;
  /** `wide` matches hub pages (`max-w-7xl`); `docs` matches Trust / What&apos;s new (`max-w-3xl`). */
  container?: "wide" | "docs";
};

/**
 * Sticky workspace subpage header: Home crumb, title, theme toggle, optional actions.
 * Same navy banner as Report Centre in light and dark mode so hub subpages stay on-brand.
 */
export function WorkspaceSubpageHeader({
  title,
  titleIcon,
  actions,
  container = "wide",
}: WorkspaceSubpageHeaderProps) {
  const { setTheme } = useTheme();
  const isDark = useResolvedIsDark();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-gradient-to-r from-[#001A47] to-[#00102e] backdrop-blur-xl">
      <div
        className={cn(
          "mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:px-6",
          container === "docs" ? "max-w-3xl" : "max-w-7xl",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            aria-label="Home"
            className="flex shrink-0 items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white/80"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <span className="text-white/20" aria-hidden>
            /
          </span>
          <div className="flex min-w-0 items-center gap-2">
            {titleIcon ? (
              <span className="flex shrink-0 text-[#00EDFF] [&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem]">
                {titleIcon}
              </span>
            ) : null}
            <h1 className="truncate text-sm font-bold tracking-tight text-white sm:text-base">
              {title}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {actions}
        </div>
      </div>
    </header>
  );
}
