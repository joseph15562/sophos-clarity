/**
 * Build-time feature toggles. Set in `.env` as `VITE_FEATURE_<NAME>=1` or `true`.
 * Prefer this for risky or low-usage UI until analytics justify default-on.
 */
export function isFeatureEnabled(name: string): boolean {
  const key = `VITE_FEATURE_${name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
  const raw = import.meta.env[key as keyof ImportMetaEnv];
  return raw === "1" || raw === "true";
}
