import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const VALID_API_KEY = Deno.env.get("API_KEY") ?? "placeholder-api-key";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function unauthorized() {
  return jsonResponse({ error: "Unauthorized", message: "Missing or invalid X-API-Key" }, 401);
}

function notFound() {
  return jsonResponse({ error: "Not Found", message: "Resource not found" }, 404);
}

function auth(req: Request): boolean {
  const key = req.headers.get("X-API-Key") ?? req.headers.get("x-api-key");
  return key === VALID_API_KEY;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!auth(req)) {
    return unauthorized();
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const match = path.match(/\/api\/?(.*)$/);
  const rest = (match ? match[1] : path).replace(/\/$/, "") || "";
  const segments = rest.split("/").filter(Boolean);

  if (req.method === "GET" && segments[0] === "assessments" && segments.length === 1) {
    return jsonResponse({
      data: [
        {
          id: "placeholder-assessment-id-1",
          org_id: "placeholder-org-id",
          customer_name: "Example Customer",
          environment: "Production",
          overall_score: 85,
          overall_grade: "B",
          created_at: "2025-01-15T10:00:00Z",
        },
      ],
      total: 1,
    });
  }

  if (req.method === "GET" && segments[0] === "assessments" && segments.length === 2) {
    const id = segments[1];
    return jsonResponse({
      id,
      org_id: "placeholder-org-id",
      customer_name: "Example Customer",
      environment: "Production",
      firewalls: [],
      overall_score: 85,
      overall_grade: "B",
      created_at: "2025-01-15T10:00:00Z",
    });
  }

  if (req.method === "GET" && segments[0] === "firewalls" && segments.length === 1) {
    return jsonResponse({
      data: [
        {
          id: "placeholder-firewall-id-1",
          hostname: "firewall.example.com",
          serial_number: "XXXXXXXX",
          model: "XGS",
          firmware_version: "v21",
          status: "online",
        },
      ],
      total: 1,
    });
  }

  return notFound();
});
