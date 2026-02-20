import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { htmlContent } = await req.json();

    if (!htmlContent || typeof htmlContent !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing htmlContent field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Truncate if extremely large (AI context limits)
    const truncated = htmlContent.length > 200000 ? htmlContent.slice(0, 200000) : htmlContent;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a senior network engineer and technical writer. You will receive the HTML content of a Sophos Firewall Config Viewer export. Your job is to transform this into a clean, professional, human-readable document in Markdown format.

Structure your output with these sections (skip any section that has no relevant data in the config):

## Executive Summary
A brief overview of the firewall — model, firmware version, hostname, and overall architecture.

## Network Interfaces & Zones
Describe each interface, its IP address, subnet, zone assignment, and VLAN configuration if any.

## Firewall Rules
For each rule, explain in plain English: the name, source zone/network, destination zone/network, services allowed/blocked, the action (allow/drop/reject), and any logging or scheduling. Present as a table where possible.

## NAT Rules
Explain SNAT/DNAT/masquerade rules — what traffic is being translated, from where to where.

## VPN Configuration
Describe IPsec tunnels, SSL VPN settings, remote access VPN — including peer IPs, encryption settings, and connected networks.

## DHCP & DNS Settings
List DHCP scopes (range, gateway, DNS servers) and any DNS configuration.

## Web Filtering & Application Control
Describe any web filter policies, URL groups, application filter policies.

## Routing
Static routes, policy routes, SD-WAN configuration.

## Authentication & Users
Local users, groups, authentication servers (LDAP/RADIUS), SSO settings.

## System Settings
Admin access settings, backup configuration, logging, SNMP, NTP, alerts.

## Summary & Recommendations
A brief summary of the configuration and any notable observations or potential improvements.

IMPORTANT GUIDELINES:
- Write in clear, professional English that an IT admin can understand
- Explain settings in a way that someone could replicate the config on a fresh Sophos firewall
- Use tables for structured data like firewall rules
- If a section has many items, include all of them — don't truncate
- Use Markdown formatting with proper headings, lists, tables, and bold text`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Here is the Sophos Config Viewer HTML export. Parse it thoroughly and generate the documentation:\n\n${truncated}`,
            },
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
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
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
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
