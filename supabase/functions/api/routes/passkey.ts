import { adminClient, json as jsonResponse, safeDbError, userClient } from "../../_shared/db.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return jsonResponse(body, status, corsHeaders);
}

export async function handlePasskeyRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (segments[0] !== "passkey") return null;
  const route = segments[1];
  const authHeader = req.headers.get("authorization");

  if (req.method === "POST" && route === "register-options") {
    if (!authHeader) return json({ error: "Unauthorized" }, 401, corsHeaders);
    const uc = userClient(authHeader);
    const { data: { user } } = await uc.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401, corsHeaders);

    const db = adminClient();
    const { data: existing } = await db
      .from("passkey_credentials")
      .select("credential_id")
      .eq("user_id", user.id)
      .limit(50);

    const origin = req.headers.get("origin") ?? "";
    const rpId = origin ? new URL(origin).hostname : new URL(SUPABASE_URL).hostname;

    const options = {
      challenge: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
      rp: { name: "Sophos FireComply", id: rpId },
      user: {
        id: btoa(user.id),
        name: user.email ?? user.id,
        displayName: user.email ?? "User",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      timeout: 60000,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        requireResidentKey: false,
        userVerification: "preferred",
      },
      excludeCredentials: (existing ?? []).map((c: any) => ({
        id: c.credential_id,
        type: "public-key",
      })),
    };

    return json(options, 200, corsHeaders);
  }

  if (req.method === "POST" && route === "register-verify") {
    if (!authHeader) return json({ error: "Unauthorized" }, 401, corsHeaders);
    const uc = userClient(authHeader);
    const { data: { user } } = await uc.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401, corsHeaders);

    const body = await req.json();
    const { credential, name } = body;

    if (!credential?.id || !credential?.response) {
      return json({ error: "Invalid credential" }, 400, corsHeaders);
    }

    const db = adminClient();
    const { error } = await db.from("passkey_credentials").insert({
      user_id: user.id,
      credential_id: credential.id,
      public_key: credential.response.attestationObject ?? "",
      counter: 0,
      device_type: "platform",
      transports: ["internal"],
      name: name ?? "Passkey",
    });

    if (error) return json({ error: safeDbError(error) }, 500, corsHeaders);
    return json({ ok: true }, 200, corsHeaders);
  }

  return json({ error: "Not found" }, 404, corsHeaders);
}
