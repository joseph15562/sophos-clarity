import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// --- CORS: restrict to known origins ---
const PROJECT_ID = "dbd2afbe-47ab-4a48-ab73-3b2c2ec34606";

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  // Allow localhost dev servers
  if (/^http:\/\/localhost:(3000|5173|8080)$/.test(origin)) return true;
  // Allow any Lovable preview/published URL for this project
  if (origin.includes(PROJECT_ID)) return true;
  return false;
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : `https://${PROJECT_ID}.lovableproject.com`,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// --- Input validation constants ---
const MAX_SECTIONS = 50;
const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_STRING_LENGTH = 500;
const MAX_FRAMEWORKS = 30;
const MAX_LABELS = 20;

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

const EXECUTIVE_SYSTEM_PROMPT = `You are a senior network security engineer writing a consolidated executive summary report for an MSP covering MULTIPLE firewall configurations.

You receive structured JSON data where each top-level key is a firewall name/label, and its value contains the extracted configuration sections for that firewall.

## Output Format

Write a comprehensive executive Markdown document with:
- A **## Executive Overview** summarising the entire estate: how many firewalls, their roles/purposes, overall security posture
- A **## Per-Firewall Summary** section with a subsection for each firewall, including: key stats (rule count, zones, networks), security posture score, top concerns
- A **## Cross-Estate Findings** section identifying: common misconfigurations, inconsistencies between firewalls, shared vulnerabilities
- A **## Risk Matrix** as a Markdown table: Finding | Severity | Affected Firewalls | Recommendation
- A **## Strategic Recommendations** section with prioritised actions for the entire estate
- An **## Appendix** briefly listing each firewall's configuration highlights

## Rules
- Compare and contrast configurations across firewalls
- Identify patterns and inconsistencies
- Prioritise findings by risk severity
- Use the actual data provided — never invent details
- Reference specific firewalls by their label names
- Do NOT reproduce every individual rule — summarise and highlight exceptions
- Use Markdown tables for structured data`;

const COMPLIANCE_SYSTEM_PROMPT = `You are a senior cybersecurity auditor producing an audit-ready Compliance Evidence Pack from firewall configuration data. This document must be formatted for direct inclusion as an appendix in compliance audits.

## Output Format

Write a structured Markdown document with these sections:

### 1. Document Header
- **Title**: "Compliance Evidence Pack — Firewall Configuration Audit"
- **Date**: Current assessment date
- **Scope**: Firewalls assessed, environment type

### 2. Control → Evidence Mapping Tables
For EACH applicable framework below, produce a Markdown table with columns:
| Control ID | Control Description | Status | Evidence | Config Excerpt | Notes |

Status values: ✅ Met | ⚠️ Partial | ❌ Not Met | N/A

### 3. Frameworks to Assess


## Rules
- Use ONLY the actual configuration data provided — never invent details
- Quote specific rule names, IP ranges, zones, and policy names as evidence
- Be specific about which rules/settings satisfy which controls
- If data is insufficient to assess a control, mark as "⚠️ Partial — Insufficient evidence in config export"
- Format for direct use as an audit appendix — professional, factual, no narrative fluff
- Every claim must be traceable to config data`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const sections = body?.sections;
    const environment: string | undefined = body?.environment;
    const country: string | undefined = body?.country;
    const customerName: string | undefined = body?.customerName;
    const executive: boolean = body?.executive === true;
    const compliance: boolean = body?.compliance === true;
    const firewallLabels: string[] | undefined = body?.firewallLabels;
    const selectedFrameworks: string[] | undefined = body?.selectedFrameworks;

    // --- Input validation ---
    if (!sections || typeof sections !== "object" || Array.isArray(sections)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid sections field." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sectionKeys = Object.keys(sections);
    if (sectionKeys.length === 0 || sectionKeys.length > MAX_SECTIONS) {
      return new Response(
        JSON.stringify({ error: `Sections count must be between 1 and ${MAX_SECTIONS}.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payloadSize = JSON.stringify(sections).length;
    if (payloadSize > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: "Payload exceeds maximum allowed size." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (environment && (typeof environment !== "string" || environment.length > MAX_STRING_LENGTH)) {
      return new Response(
        JSON.stringify({ error: "Invalid environment parameter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (country && (typeof country !== "string" || country.length > MAX_STRING_LENGTH)) {
      return new Response(
        JSON.stringify({ error: "Invalid country parameter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (customerName && (typeof customerName !== "string" || customerName.length > MAX_STRING_LENGTH)) {
      return new Response(
        JSON.stringify({ error: "Invalid customerName parameter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (selectedFrameworks && (!Array.isArray(selectedFrameworks) || selectedFrameworks.length > MAX_FRAMEWORKS || !selectedFrameworks.every((f: unknown) => typeof f === "string" && f.length < MAX_STRING_LENGTH))) {
      return new Response(
        JSON.stringify({ error: "Invalid selectedFrameworks parameter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (firewallLabels && (!Array.isArray(firewallLabels) || firewallLabels.length > MAX_LABELS || !firewallLabels.every((l: unknown) => typeof l === "string" && l.length < MAX_STRING_LENGTH))) {
      return new Response(
        JSON.stringify({ error: "Invalid firewallLabels parameter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Debug mode removed for security

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const payload = JSON.stringify(sections, null, 2);

  // Build compliance context
    let complianceContext = "";
    if (customerName) {
      complianceContext += `\n\n## Client Context\nThis report is for **${customerName}**. Address the customer by name throughout the document (e.g. "This report documents the firewall configuration for ${customerName}"). Use the customer name in the Executive Summary, Overall Security Recommendations and Frameworks to Assess.\n`;
    }
    
    if (environment || country) {
      complianceContext += "\n\n## Compliance Context\n";
      if (environment) complianceContext += `- **Environment type**: ${environment}\n`;
      if (country) complianceContext += `- **Country**: ${country}\n`;
    }

    // Add selected frameworks
    if (selectedFrameworks && selectedFrameworks.length > 0) {
      complianceContext += `\n\n## Selected Compliance Frameworks\nThe following frameworks have been selected for this assessment. You MUST assess against ALL of these and ONLY these frameworks:\n`;
      selectedFrameworks.forEach((fw) => {
        complianceContext += `- **${fw}**\n`;
      });
      complianceContext += `\nFor each framework, provide specific control references, cite actual requirements, and flag any configuration gaps. Tailor all "Best Practice Recommendations" and "Overall Security Recommendations" to these frameworks.\n`;
    } else if (environment || country) {
      complianceContext += `\nIMPORTANT: Tailor ALL "Best Practice Recommendations" and the "Overall Security Recommendations" section to focus on compliance frameworks and regulatory requirements relevant to this environment and country.\n`;
    }

    let basePrompt: string;
    if (compliance) {
      basePrompt = COMPLIANCE_SYSTEM_PROMPT;
    } else if (executive) {
      basePrompt = EXECUTIVE_SYSTEM_PROMPT;
    } else {
      basePrompt = SYSTEM_PROMPT;
    }
    const systemPrompt = basePrompt + complianceContext;

    let userMessage: string;
    if (compliance && firewallLabels && firewallLabels.length > 1) {
      userMessage = `Here are the extracted configurations for ${firewallLabels.length} firewalls (${firewallLabels.join(", ")}). Produce a comprehensive Compliance Evidence Pack covering all firewalls:\n\n${payload}`;
    } else if (compliance) {
      userMessage = `Here is the extracted Sophos firewall configuration data. Produce a comprehensive Compliance Evidence Pack:\n\n${payload}`;
    } else if (executive && firewallLabels) {
      userMessage = `Here are the extracted configurations for ${firewallLabels.length} firewalls (${firewallLabels.join(", ")}). Produce a consolidated executive summary report:\n\n${payload}`;
    } else {
      userMessage = "Here is the extracted Sophos firewall configuration data. Document every section completely:\n\n" + payload;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
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
      JSON.stringify({ error: "An internal error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
