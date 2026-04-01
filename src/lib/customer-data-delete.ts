/**
 * Helpers for removing org-scoped customer data (assessments, reports, portal links).
 * Postgres `=` on text is case-sensitive; we use `ilike` with escaped literals for cleanup.
 */

/** Escape `%`, `_`, and `\` for PostgREST `ilike` so the pattern matches one literal string. */
export function escapeForExactIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function customerNameVariantsForDelete(customer: {
  name: string;
  originalNames?: string[];
  tenantNameRaw?: string | null;
}): string[] {
  const out = new Set<string>();
  const add = (s: string | null | undefined) => {
    const t = String(s ?? "").trim();
    if (t && t !== "Unnamed") out.add(t);
  };
  add(customer.name);
  if (customer.originalNames) {
    for (const n of customer.originalNames) add(n);
  }
  add(customer.tenantNameRaw);
  return [...out];
}

/** One pass per distinct name ignoring ASCII case (avoids redundant ilike deletes). */
export function dedupeNameVariantsCaseInsensitive(variants: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of variants) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(v);
  }
  return result;
}
