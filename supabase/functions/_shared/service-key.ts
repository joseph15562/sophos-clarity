import { adminClient, safeDbError } from "./db.ts";

async function sha256Hex(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Raw secret from Authorization: Bearer <key> or X-FireComply-Service-Key. */
export function extractServiceKeySecret(req: Request): string | null {
  const dedicated = req.headers.get("x-firecomply-service-key")?.trim();
  if (dedicated) return dedicated;
  const auth = req.headers.get("authorization")?.trim();
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token || token.toLowerCase().startsWith("eyj")) return null; // likely Supabase JWT
  return token;
}

/** Resolve org + scopes for an active org service key (G3.2 Edge validation). */
export async function getServiceKeyContext(
  req: Request,
): Promise<{ orgId: string; scopes: string[]; keyId: string } | null> {
  const secret = extractServiceKeySecret(req);
  if (!secret) return null;
  const keyHash = await sha256Hex(secret);
  const db = adminClient();
  const { data, error } = await db
    .from("org_service_api_keys")
    .select("id, org_id, scopes")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("[service-key]", safeDbError(error));
    return null;
  }
  if (!data) return null;

  const row = data as { id: string; org_id: string; scopes: string[] | null };
  void db
    .from("org_service_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    orgId: row.org_id,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    keyId: row.id,
  };
}
