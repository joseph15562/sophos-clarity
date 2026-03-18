import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Canonical label for a parsed file: user label or fileName with .html/.htm stripped. */
export function getFileLabel(f: { label?: string; fileName: string }): string {
  return f.label ?? f.fileName.replace(/\.(html|htm)$/i, "");
}

/** Normalise thrown values to a string message for user display. */
export function normalizeErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
