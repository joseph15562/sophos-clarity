/**
 * Vertical slices for `HealthCheckInnerLayout` extraction (god-file reduction).
 * Move JSX per section with colocated hooks when splitting the layout.
 */
export const HEALTH_CHECK_LAYOUT_SECTIONS = [
  "upload",
  "team",
  "followups",
  "pdf_strip",
  "dialogs",
] as const;

export type HealthCheckLayoutSection = (typeof HEALTH_CHECK_LAYOUT_SECTIONS)[number];
