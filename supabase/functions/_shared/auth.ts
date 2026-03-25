import { hmacVerify } from "./crypto.ts";
import { adminClient, userClient } from "./db.ts";

export async function authenticateAgent(apiKey: string) {
  const prefix = apiKey.slice(0, 8);
  const db = adminClient();
  const { data: agents, error } = await db
    .from("agents")
    .select("*")
    .eq("api_key_prefix", prefix)
    .limit(10);

  if (error || !agents?.length) return null;

  for (const agent of agents) {
    const match = await hmacVerify(apiKey, agent.api_key_hash);
    if (match) return agent;
  }
  return null;
}

export async function getOrgMembership(userId: string) {
  const db = adminClient();
  const { data } = await db
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1)
    .single();
  return data;
}

export async function authenticateSE(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const uc = userClient(authHeader);
  const { data: { user } } = await uc.auth.getUser();
  if (!user) return null;
  const db = adminClient();
  const { data: seProfile } = await db
    .from("se_profiles")
    .select("id, email, display_name, health_check_prepared_by")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!seProfile) return null;
  if (!seProfile.display_name) {
    seProfile.display_name =
      (seProfile.health_check_prepared_by as string) ||
      (user.user_metadata as Record<string, unknown>)?.full_name as string ||
      (user.user_metadata as Record<string, unknown>)?.name as string ||
      null;
  }
  return { user, seProfile };
}

export async function runConfigUploadCleanup() {
  const db = adminClient();
  const now = new Date().toISOString();
  await db.from("config_upload_requests").delete()
    .lt("expires_at", now)
    .in("status", ["pending", "uploaded"]);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  await db.from("config_upload_requests").delete()
    .lt("downloaded_at", fiveDaysAgo)
    .eq("status", "downloaded");
}
