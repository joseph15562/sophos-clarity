const PLACEHOLDER_NAMES = /^\s*(\(this tenant\)|unnamed|unknown|customer)\s*$/i;

/** Normalise Sophos Central / agent placeholder tenant labels to the org display name. */
export function resolveCustomerName(raw: string, orgName: string): string {
  if (!raw || PLACEHOLDER_NAMES.test(raw)) return orgName || "My Organisation";
  return raw;
}
