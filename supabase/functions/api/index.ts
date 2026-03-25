import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { json as jsonResponse, safeError } from "../_shared/db.ts";

import { handleAdminRoutes } from "./routes/admin.ts";
import { handleAgentRoutes } from "./routes/agent.ts";
import { handleAssessmentRoutes } from "./routes/assessments.ts";
import { handleConfigUploadRoutes } from "./routes/config-upload.ts";
import { handleFirewallRoutes } from "./routes/firewalls.ts";
import { handleHealthCheckRoutes } from "./routes/health-checks.ts";
import { handlePasskeyRoutes } from "./routes/passkey.ts";
import { handleSeTeamRoutes } from "./routes/se-teams.ts";
import { handleSendReportRoutes } from "./routes/send-report.ts";

let corsHeaders: Record<string, string> = {};
function json(body: unknown, status = 200) {
  return jsonResponse(body, status, corsHeaders);
}

const API_MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Route Auth Matrix ──
// Gateway JWT is ENABLED (config.toml). All routes require a valid JWT.
//
// Public routes (shared reports, passkey login, guest config upload) have
// moved to the api-public function. Agent API-key routes have moved to
// the api-agent function.
//
//   Route prefix              Auth mechanism
//   ─────────────────────────  ─────────────────────────────────────
//   agent/register|delete|…   JWT via userClient + getUser
//   passkey/register-*         JWT via userClient + getUser
//   admin/*                    JWT + org admin role check
//   assessments                JWT via userClient + getUser
//   se-teams/*                 JWT via authenticateSE
//   health-checks/*            JWT via authenticateSE
//   config-upload-request(s)   JWT via authenticateSE
//   config-upload/:token/…     JWT via authenticateSE (resend/download/claim/central-data/delete)
//   firewalls                  JWT via userClient + getUser
//   send-report                JWT via authenticateSE

// ── Main router ──

serve(async (req: Request) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > API_MAX_BODY_BYTES) {
    return json({ error: `Request body too large (${Math.round(contentLength / 1024)} KB). Maximum is ${API_MAX_BODY_BYTES / 1024 / 1024} MB.` }, 413);
  }

  try {
  const url = new URL(req.url);
  const path = url.pathname;
  const match = path.match(/\/api\/?(.*)$/);
  const rest = (match ? match[1] : path).replace(/\/$/, "") || "";
  const segments = rest.split("/").filter(Boolean);

  const agentRes = await handleAgentRoutes(req, url, segments, corsHeaders);
  if (agentRes !== null) return agentRes;

  const passkeyRes = await handlePasskeyRoutes(req, url, segments, corsHeaders);
  if (passkeyRes !== null) return passkeyRes;

  const adminRes = await handleAdminRoutes(req, url, segments, corsHeaders);
  if (adminRes !== null) return adminRes;

  const assessmentRes = await handleAssessmentRoutes(req, url, segments, corsHeaders);
  if (assessmentRes !== null) return assessmentRes;

  const seTeamRes = await handleSeTeamRoutes(req, url, segments, corsHeaders);
  if (seTeamRes !== null) return seTeamRes;

  const healthCheckRes = await handleHealthCheckRoutes(req, url, segments, corsHeaders);
  if (healthCheckRes !== null) return healthCheckRes;

  const configUploadRes = await handleConfigUploadRoutes(req, url, segments, corsHeaders);
  if (configUploadRes !== null) return configUploadRes;

  const firewallRes = await handleFirewallRoutes(req, url, segments, corsHeaders);
  if (firewallRes !== null) return firewallRes;

  const sendReportRes = await handleSendReportRoutes(req, url, segments, corsHeaders);
  if (sendReportRes !== null) return sendReportRes;


  return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: safeError(err) }, 500);
  }
});
