import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a senior network engineer writing professional firewall configuration documentation.

You receive structured JSON data extracted from a Sophos XGS firewall configuration export. Each key is a section name, and the value contains tables, detail blocks, and/or text.

Your job is to produce a comprehensive, human-readable Markdown document that another IT admin could use to understand or replicate this firewall setup on a fresh Sophos device.

## Output Format

Write well-structured Markdown with:
- Clear **## Section** headings for each configuration area
- Bullet points and tables where appropriate
- Plain English explanations of what each rule/setting does and why it matters
- Group related items logically

## Rules

- Document EVERY rule, host, network, and setting provided — do not skip or summarize
- For firewall rules: include rule name, status (enabled/disabled), action (accept/drop/reject), source zones/networks, destination zones/networks, services, and any security features applied
- For NAT rules: explain the translation clearly (what maps to what)
- For hosts/networks: list all entries with their IPs/FQDNs/ranges
- For policies: describe what each policy does
- Use the actual data provided — never invent or assume configuration details
- If a section has no data, write "No configuration found in export."
- Do NOT output raw JSON — write documentation in Markdown
- Start directly with the first section heading (no title page or intro paragraph)`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const sections = body?.sections;

    if (!sections || typeof sections !== "object") {
      return new Response(
        JSON.stringify({ error: "Missing sections field. Expected pre-extracted JSON." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Debug mode: return extracted data without calling AI
    const url = new URL(req.url);
    if (url.searchParams.get("debug") === "1") {
      return new Response(JSON.stringify({ sections, sectionCount: Object.keys(sections).length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const payload = JSON.stringify(sections, null, 2);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "Here is the extracted Sophos firewall configuration data. Document every section completely:\n\n" +
              payload,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("parse-config error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
