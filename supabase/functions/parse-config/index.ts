import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a senior network security engineer writing professional firewall configuration documentation for an MSP client handover.

You receive structured JSON data extracted from a Sophos XGS firewall configuration export. Each key is a section name, and the value contains tables, detail blocks, and/or text.

## Output Format

Write well-structured Markdown with:
- An **## Executive Summary** at the top with a brief overview of the firewall configuration (number of rules, key security posture observations, overall assessment)
- Clear **## Section** headings for each configuration area
- **Markdown tables** for listing rules, hosts, networks, and settings — use tables instead of bullet lists wherever data has consistent columns
- After each section's table(s), include a **### Summary** paragraph explaining the purpose and overall pattern of that section
- After each section, include a **### Best Practice Recommendations** subsection with actionable advice specific to the configuration shown (e.g. unused rules, overly permissive access, missing logging, disabled security features)

## Rules

- Document EVERY rule, host, network, and setting provided — do not skip or summarize
- For firewall rules: create a table with columns: Rule Name, Status, Action, Source Zone, Source Networks, Destination Zone, Destination Networks, Services, Security Features
- For NAT rules: create a table explaining the translation (what maps to what)
- For hosts/networks: list all entries in a table with relevant columns
- For policies: describe what each policy does in a table
- Use the actual data provided — never invent or assume configuration details
- If a section has no data, write "No configuration found in export."
- Do NOT output raw JSON — write documentation in Markdown tables and prose
- Start with the Executive Summary, then proceed section by section
- End with a **## Overall Security Recommendations** section covering cross-cutting best practices based on the entire configuration`;

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
