/**
 * Legacy localStorage key for "Prepared by" before it moved to `se_profiles.health_check_prepared_by`.
 * Still read once to migrate into the database; do not use for new writes.
 */
export const SE_HEALTH_CHECK_PREPARED_BY_KEY = "se-health-check-prepared-by";

export function loadSeHealthCheckPreparedBy(): string {
  try {
    return localStorage.getItem(SE_HEALTH_CHECK_PREPARED_BY_KEY) ?? "";
  } catch {
    return "";
  }
}
