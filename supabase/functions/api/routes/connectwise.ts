import { getOrgMembership } from "../../_shared/auth.ts";
import {
  connectWiseFetchToken,
  connectWisePartnerGetJson,
} from "../../_shared/connectwise-cloud.ts";
import { centralDecrypt, centralEncrypt } from "../../_shared/crypto.ts";
import { adminClient, json as jsonResponse, safeDbError, userClient } from "../../_shared/db.ts";

function publicIdSuffix(id: string): string {
  const t = id.trim();
  if (t.length <= 8) return t;
  return t.slice(-8);
}

async function requireOrgAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ orgId: string } | Response> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  const uc = userClient(authHeader);
  const {
    data: { user },
  } = await uc.auth.getUser();
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  const membership = await getOrgMembership(user.id);
  if (!membership || membership.role !== "admin") {
    return jsonResponse({ error: "Admin access required" }, 403, corsHeaders);
  }
  return { orgId: membership.org_id };
}

async function loadDecryptedCredentials(
  db: ReturnType<typeof adminClient>,
  orgId: string,
): Promise<{ publicMemberId: string; subscriptionKey: string; scope: string } | null> {
  const { data: row, error } = await db
    .from("connectwise_cloud_credentials")
    .select("encrypted_public_member_id, encrypted_subscription_key, scope")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error || !row) return null;
  const publicMemberId = await centralDecrypt(row.encrypted_public_member_id as string);
  const subscriptionKey = await centralDecrypt(row.encrypted_subscription_key as string);
  const scope = ((row.scope as string) || "Partner").trim() || "Partner";
  return { publicMemberId, subscriptionKey, scope };
}

export async function handleConnectWiseRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (segments[0] !== "connectwise") return null;

  const admin = await requireOrgAdmin(req, corsHeaders);
  if (admin instanceof Response) return admin;
  const { orgId } = admin;

  function j(body: unknown, status = 200) {
    return jsonResponse(body, status, corsHeaders);
  }

  const route = segments[1];
  const db = adminClient();

  /** Partner Cloud GET /whoami — see https://developers.cloudservices.connectwise.com/getstarted */
  if (route === "whoami" && req.method === "GET" && segments.length === 2) {
    const creds = await loadDecryptedCredentials(db, orgId);
    if (!creds) return j({ error: "No ConnectWise credentials stored" }, 404);
    try {
      const { access_token } = await connectWiseFetchToken(
        creds.publicMemberId,
        creds.subscriptionKey,
        creds.scope,
      );
      const profile = await connectWisePartnerGetJson(
        access_token,
        creds.subscriptionKey,
        "/whoami",
      );
      return j({ ok: true, whoami: profile });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ConnectWise request failed";
      return j({ error: msg }, 400);
    }
  }

  if (route === "credentials" && req.method === "POST") {
    let body: { publicMemberId?: string; subscriptionKey?: string; scope?: string };
    try {
      body = await req.json();
    } catch {
      return j({ error: "Invalid JSON" }, 400);
    }
    const publicMemberId = typeof body.publicMemberId === "string" ? body.publicMemberId.trim() : "";
    const subscriptionKey = typeof body.subscriptionKey === "string" ? body.subscriptionKey.trim() : "";
    const scopeRaw = typeof body.scope === "string" ? body.scope.trim() : "Partner";
    const scope = scopeRaw === "Distributor" ? "Distributor" : "Partner";
    if (!publicMemberId || !subscriptionKey) {
      return j({ error: "publicMemberId and subscriptionKey are required" }, 400);
    }

    try {
      const { expires_in } = await connectWiseFetchToken(publicMemberId, subscriptionKey, scope);
      const encPub = await centralEncrypt(publicMemberId);
      const encKey = await centralEncrypt(subscriptionKey);
      const suffix = publicIdSuffix(publicMemberId);
      const now = new Date().toISOString();

      const { data: existing } = await db
        .from("connectwise_cloud_credentials")
        .select("connected_at")
        .eq("org_id", orgId)
        .maybeSingle();

      const connectedAt =
        existing && typeof (existing as { connected_at?: string }).connected_at === "string"
          ? (existing as { connected_at: string }).connected_at
          : now;

      const { error: upErr } = await db.from("connectwise_cloud_credentials").upsert(
        {
          org_id: orgId,
          encrypted_public_member_id: encPub,
          encrypted_subscription_key: encKey,
          scope,
          public_id_suffix: suffix,
          connected_at: connectedAt,
          last_token_ok_at: now,
          last_error: null,
        },
        { onConflict: "org_id" },
      );
      if (upErr) return j({ error: safeDbError(upErr) }, 500);
      return j({ ok: true, expires_in, public_id_suffix: suffix, scope });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Token request failed";
      return j({ error: msg }, 400);
    }
  }

  if (route === "credentials" && req.method === "DELETE") {
    const { error: delErr } = await db.from("connectwise_cloud_credentials").delete().eq("org_id", orgId);
    if (delErr) return j({ error: safeDbError(delErr) }, 500);
    return j({ ok: true });
  }

  if (route === "test" && req.method === "POST") {
    const creds = await loadDecryptedCredentials(db, orgId);
    if (!creds) return j({ error: "No ConnectWise credentials stored" }, 404);

    try {
      const { expires_in } = await connectWiseFetchToken(
        creds.publicMemberId,
        creds.subscriptionKey,
        creds.scope,
      );
      await db
        .from("connectwise_cloud_credentials")
        .update({ last_token_ok_at: new Date().toISOString(), last_error: null })
        .eq("org_id", orgId);
      return j({ ok: true, expires_in });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Token request failed";
      await db.from("connectwise_cloud_credentials").update({ last_error: msg }).eq("org_id", orgId);
      return j({ error: msg }, 400);
    }
  }

  return null;
}
