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
 * Keeps light (card bar) vs dark (navy gradient) in sync with Customer Management.
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
    <header
      className={cn(
        "sticky top-0 z-40 border-b",
        isDark ? "border-white/[0.06]" : "border-border/60 bg-card/50",
      )}
      style={
        isDark
          ? {
              background:
                "radial-gradient(circle at top left, rgba(0,237,255,0.10), transparent 18%), radial-gradient(circle at top right, rgba(32,6,247,0.20), transparent 24%), linear-gradient(90deg, #00163d 0%, #001A47 42%, #10037C 100%)",
            }
          : undefined
      }
    >
      <div
        className={cn(
          "mx-auto flex min-h-14 items-center justify-between gap-3 px-4 py-3 sm:px-6",
          container === "docs" ? "max-w-3xl" : "max-w-7xl",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            aria-label="Home"
            className={cn(
              "flex shrink-0 items-center gap-1.5 text-sm transition-colors",
              isDark ? "text-white/60 hover:text-white" : "text-[#2006F7] hover:text-[#10037C]",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <span className={isDark ? "text-white/30" : "text-border"} aria-hidden>
            /
          </span>
          <div className="flex min-w-0 items-center gap-2">
            {titleIcon ? (
              <span
                className={cn(
                  "flex shrink-0 [&_svg]:h-5 [&_svg]:w-5",
                  isDark ? "text-[#00EDFF]" : "text-[#2006F7]",
                )}
              >
                {titleIcon}
              </span>
            ) : null}
            <h1
              className={cn(
                "truncate text-base font-semibold tracking-tight sm:text-lg",
                isDark ? "text-white" : "text-foreground",
              )}
            >
              {title}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl border transition-colors",
              isDark
                ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                : "border-border bg-muted/60 text-foreground hover:bg-muted",
            )}
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
