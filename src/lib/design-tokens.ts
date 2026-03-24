/**
 * Design tokens — single source of truth for brand and severity colours.
 *
 * Use these constants wherever JS/TS needs a concrete colour value
 * (charts, SVG attributes, inline styles). For Tailwind classes, prefer
 * the token utilities: `text-brand-accent`, `bg-severity-critical`, etc.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Grade = "A" | "B" | "C" | "D" | "F";

export const BRAND = {
  blue: "#2006F7",
  cyan: "#00EDFF",
  navy: "#001A47",
} as const;

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#EA0022",
  high: "#F29400",
  medium: "#F8E300",
  low: "#00F2B3",
  info: "#009CFB",
};

export const SEVERITY_COLORS_DARK: Record<Severity, string> = {
  critical: "#FF3352",
  high: "#FFB040",
  medium: "#FFE94D",
  low: "#00F2B3",
  info: "#40B8FF",
};

export const GRADE_COLORS: Record<Grade, string> = {
  A: "#00F2B3",
  B: "#00D4A1",
  C: "#F8E300",
  D: "#F29400",
  F: "#EA0022",
};

export function gradeForScore(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function scoreToColor(score: number): string {
  return GRADE_COLORS[gradeForScore(score)];
}

export function severityToColor(severity: string): string {
  return SEVERITY_COLORS[severity as Severity] ?? SEVERITY_COLORS.info;
}

export const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};
