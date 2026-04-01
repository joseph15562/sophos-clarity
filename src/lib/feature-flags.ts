/**
 * Env-driven flags for staged rollouts (no bundled SDK). Set in Vite env, e.g. VITE_FEATURE_EXAMPLE=1.
 * REVIEW program: use for risky surfaces before full defaults.
 */
function parseFlagValue(raw: string | undefined): boolean {
  if (raw == null || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function readFeatureFlagEnv(name: string): boolean {
  const key = `VITE_FEATURE_${name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
  try {
    return parseFlagValue((import.meta.env as Record<string, string | undefined>)[key]);
  } catch {
    return false;
  }
}

export const isFeatureEnabled = readFeatureFlagEnv;
