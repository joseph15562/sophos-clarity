import { useTheme } from "next-themes";

/** Matches the blocking script in `index.html` before next-themes hydrates `resolvedTheme`. */
export function documentThemeClass(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Stable dark/light for styling when `resolvedTheme` is still undefined (e.g. theme is "system"
 * on first client render). Avoids a flash of light-mode-only UI while `<html class="dark">`.
 */
export function useResolvedIsDark(): boolean {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme === "dark") return true;
  if (resolvedTheme === "light") return false;
  return documentThemeClass() === "dark";
}

export function useResolvedThemeClass(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme === "dark" || resolvedTheme === "light") return resolvedTheme;
  return documentThemeClass();
}
