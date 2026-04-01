import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Semantic accents for stat widgets — light mode uses deep hues; dark keeps neon. */
export type StatAccent = "green" | "amber" | "red" | "violet" | "purple" | "cyan" | "slate";

const HEX_NORMALIZE = (h: string) => h.replace(/\s/g, "").toLowerCase();

/** Map export / brand hex to a small set for typography + surfaces. */
export function accentKindFromHex(hex: string): StatAccent {
  const h = HEX_NORMALIZE(hex);
  if (h === "#fff" || h === "#ffffff") return "slate";
  if (h.endsWith("f2b3") || h === "00f2b3") return "green";
  if (h.endsWith("f29400") || h.includes("f29400")) return "amber";
  if (h.endsWith("ea0022") || h.includes("ea0022")) return "red";
  if (h.endsWith("00edff") || h.includes("00edff")) return "cyan";
  if (h.endsWith("5a00ff") || h.includes("5a00ff")) return "purple";
  if (h.endsWith("2006f7") || h.includes("2006f7")) return "violet";
  return "slate";
}

/** Primary metric / value — strong contrast on light backgrounds. */
export function statValueTextClass(accent: StatAccent): string {
  switch (accent) {
    case "green":
      return "text-emerald-800 dark:text-[#00F2B3]";
    case "amber":
      return "text-amber-950 dark:text-[#F29400]";
    case "red":
      return "text-rose-800 dark:text-[#EA0022]";
    case "cyan":
      return "text-cyan-900 dark:text-[#5CEFFF]";
    case "violet":
      return "text-violet-900 dark:text-[#C4B5FD]";
    case "purple":
      return "text-purple-900 dark:text-[#D8B4FE]";
    default:
      return "text-slate-800 dark:text-zinc-200";
  }
}

/** Icons and small labels sitting on pale tints. */
export function statIconTextClass(accent: StatAccent): string {
  switch (accent) {
    case "green":
      return "text-emerald-700 dark:text-[#00F2B3]";
    case "amber":
      return "text-amber-800 dark:text-[#F29400]";
    case "red":
      return "text-rose-700 dark:text-[#EA0022]";
    case "cyan":
      return "text-cyan-800 dark:text-[#5CEFFF]";
    case "violet":
      return "text-violet-800 dark:text-[#C4B5FD]";
    case "purple":
      return "text-purple-800 dark:text-[#D8B4FE]";
    default:
      return "text-slate-700 dark:text-zinc-300";
  }
}

/** Outer card: calm light surface; gradient only in dark (via overlay). */
export function statCardShellClass(): string {
  return cn(
    "relative isolate overflow-hidden rounded-xl border shadow-sm",
    "border-slate-200/90 bg-card",
    "dark:border-white/[0.06] dark:bg-transparent dark:shadow-none",
  );
}

export function statDarkGradientOverlayStyle(hex: string): CSSProperties {
  return {
    background: `linear-gradient(145deg, ${hex}14, ${hex}06)`,
  };
}
