/**
 * Read a claim from an unverified JWT payload (browser-safe, no crypto).
 * Used for UX checks only (e.g. warn if service_role was pasted instead of anon).
 */
export function readJwtPayloadClaim(jwt: string, claim: string): unknown {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return undefined;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const json = atob(b64);
    const payload = JSON.parse(json) as Record<string, unknown>;
    return payload[claim];
  } catch {
    return undefined;
  }
}
