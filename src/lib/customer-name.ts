/** True when Sophos Central / agents use a generic label instead of a real customer name. */
export function isPlaceholderCustomerName(raw: string): boolean {
  const key = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return (
    key === "thistenant" ||
    key === "unnamed" ||
    key === "unknown" ||
    key === "customer" ||
    key === ""
  );
}

/** Normalise Sophos Central / agent placeholder tenant labels to the org display name. */
export function resolveCustomerName(raw: string, orgName: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || isPlaceholderCustomerName(trimmed)) {
    return String(orgName ?? "").trim() || "My Organisation";
  }
  return trimmed;
}
