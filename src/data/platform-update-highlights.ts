/**
 * “Platform updates” summary card on `/changelog` (top of Updates page).
 *
 * When you ship user-visible work, update the month + highlights here in the same
 * commit as new bullets in `ChangelogPage.tsx` so the card stays in sync.
 */
export type PlatformHighlightTag = "new" | "improved" | "fixed";

export type PlatformHighlightLine = {
  tag: PlatformHighlightTag;
  text: string;
};

export const PLATFORM_UPDATE_CARD = {
  /** Optional marketing or release label (omit when not versioning the app this way). */
  versionLabel: null as string | null,
  /** Must match the newest `<section>` month heading in ChangelogPage (`YYYY-MM`). */
  monthKey: "2026-04",
  /** Human-readable month for the card (keep aligned with `monthKey`). */
  monthLabel: "April 2026",
  /** 1–4 short lines; mirror the themes of the latest month’s shipped work. */
  highlights: [
    {
      tag: "new" as const,
      text: "Global Tours/Shortcuts + route-aware AI on every page; Mission Control plus Central Alerts/MDR prefetch; Central Groups + MDR merged on Edge; Central tenant sync fixes for inventory.",
    },
    {
      tag: "improved" as const,
      text: "Workspace header (Central popover), unified hub chrome, Central Alerts/MDR merged requests + mission-alerts browser snapshot for faster return visits, API Explorer live keys, changelog threats from Sophos advisories RSS, signed-in firmware table from Central inventory.",
    },
    {
      tag: "improved" as const,
      text: "Visual polish: ambient mesh + motion-safe pulse, glass panels, gradient title, primary button glow, nav shimmer, richer assist bar.",
    },
  ] satisfies PlatformHighlightLine[],
};
