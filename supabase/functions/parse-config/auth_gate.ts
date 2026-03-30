import { getCorsHeaders } from "../_shared/cors.ts";

/** CORS preflight and missing JWT — shared with tests without loading the full parse-config handler. */
export function parseConfigEarlyResponse(req: Request): Response | null {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (!req.headers.get("Authorization")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}
