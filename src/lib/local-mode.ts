/**
 * Local / air-gapped mode: all analysis runs client-side, AI reports disabled,
 * Central integration disabled, everything saved to IndexedDB/localStorage only.
 */

const STORAGE_KEY = "sophos-firecomply-local-mode";

export function isLocalMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setLocalMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
  }
}
