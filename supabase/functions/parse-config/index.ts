import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function pruneEmpty(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const arr = value.map(pruneEmpty).filter((v) => {
      if (v === null || v === undefined) return false;
      if (typeof v === "string" && v.trim() === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as Record<string, unknown>).length === 0) return false;
      return true;
    });
    return arr;
  }
  if (typeof value === "object") {
    const obj = Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => [k, pruneEmpty(v)])
        .filter(([, v]) => {
          if (v === null || v === undefined) return false;
          if (typeof v === "string" && v.trim() === "") return false;
          if (Array.isArray(v) && v.length === 0) return false;
          if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as Record<string, unknown>).length === 0) return false;
          return true;
        })
    );
    return obj;
  }
  return value;
}

// Shorter prompts = fewer input tokens for gemini-3-flash-preview
const SYSTEM_PROMPT = `Senior network security engineer. Document Sophos XGS firewall config from the JSON below for MSP handover.

Structure: Executive Summary (one paragraph) → Section headings with Markdown tables → per-section Summary, **Findings** (severity: 🔴🟠🟡🟢), **Best Practice Recommendations** → Overall Security Recommendations at end.

Rules: Use only provided data. Document every rule/host/interface/setting in tables. Firewall rules: include EVERY rule — full table, no row limit. Firewall table columns: Rule Name, Status, Action, Source Zone, Source Networks, Dest Zone, Dest Networks, Services, Security Features, **Web Filter**. Interfaces table: **Interface/VLAN**, **VLAN**, Zone, IP Address, Description — use names exactly (e.g. Port1.99, Port2:0, Port3.250). NAT: table of translations. If "Authentication & OTP Settings" or OTPSettings in payload: add ## Authentication & OTP Settings with Setting/Value table for every row (otp, allUsers, tokenAutoCreation, otpUserPortal, otpVPNPortal, otpSSLVPN, otpWebAdmin, otpIPsec); do not say "No configuration found" when data exists. No raw JSON.`;

const EXECUTIVE_PROMPT = `Senior network security engineer. Consolidated executive report for MULTIPLE firewalls from the JSON (each key = firewall name).

Structure: Executive Overview → Per-Firewall Summary (stats, posture, top concerns) → Cross-Estate Findings → Risk Matrix table (Finding|Severity|Affected Firewalls|Recommendation) → Strategic Recommendations → Appendix. Use data only; reference firewalls by name; summarise, do not list every rule. Markdown tables.`;

const COMPLIANCE_PROMPT = `Cybersecurity auditor. Audit-ready Compliance Evidence Pack from firewall config JSON. Use only provided data.

Structure: (1) Title, Date, Scope (2) Control→Evidence tables per framework: Control ID|Description|Status|Evidence|Config Excerpt|Notes — Status: ✅ Met | ⚠️ Partial | ❌ Not Met | N/A (3) Frameworks to Assess (4) Textual evidence per control (5) N/A justifications (6) Residual risks table (7) Summary counts. Cite rules/zones/policies; include **Web Filter** on rules where data has it. Partial = "⚠️ Partial — Insufficient evidence" when needed. Professional, traceable.`;

serve(async (req) => {
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

    if (!sections || typeof sections !== "object") {
      return new Response(
        JSON.stringify({ error: "Missing sections field. Expected pre-extracted JSON." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Debug mode
    const url = new URL(req.url);
    if (url.searchParams.get("debug") === "1") {
      return new Response(JSON.stringify({ sections, sectionCount: Object.keys(sections).length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gemini API key (required)
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const compactSections = pruneEmpty(sections) as Record<string, unknown>;
    const payload = JSON.stringify(compactSections);

    const MAX_PAYLOAD_CHARS = 1_048_576; // 1MB
    const useBriefForLargeConfig = !compliance && !executive && payload.length > MAX_PAYLOAD_CHARS;

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
      basePrompt = COMPLIANCE_PROMPT;
    } else if (executive) {
      basePrompt = EXECUTIVE_PROMPT;
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

    const buildMessages = (brief: boolean) => {
      const useBrief = (brief || useBriefForLargeConfig) && !compliance && !executive;
      let user = userMessage;
      if (useBrief) {
        user = "Produce a CONDENSED report: (1) Executive Summary, one paragraph (2) Firewall rules: include EVERY rule in the table (do not limit rows). Other sections: one table per section, max 15 rows, short Findings + Recommendations. (3) Authentication & OTP Settings: include every Setting/Value row from the data (e.g. otp, allUsers, tokenAutoCreation, otpUserPortal, otpVPNPortal, otpSSLVPN, otpWebAdmin, otpIPsec). No lengthy prose.\n\n" + payload;
      }
      return [
        { role: "system", content: systemPrompt },
        { role: "user", content: user },
      ];
    };

    const model = "gemini-3-flash-preview";
    const maxTokens = 8192;

    const doRequest = (brief = false) =>
      fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: buildMessages(brief),
          stream: true,
          temperature: 0.1,
          max_tokens: maxTokens,
        }),
      });

    let response = await doRequest(useBriefForLargeConfig);
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      response = await doRequest(useBriefForLargeConfig);
    }
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 3000));
      response = await doRequest(true);
    }

    if (!response.ok) {
      const text = await response.text();
      console.error("Gemini API error:", response.status, text);

      // Parse Gemini error body when possible for a clearer message
      let message = "AI processing failed";
      try {
        const errJson = JSON.parse(text);
        const detail = errJson.error?.message ?? errJson.message ?? errJson.error;
        if (typeof detail === "string") message = detail;
      } catch { /* use default */ }

      // Rate limit or quota (free tier: 20 RPD, 5 RPM, 250K TPM)
      if (response.status === 429 || response.status === 403) {
        return new Response(
          JSON.stringify({
            error: message.includes("rate") || message.includes("quota") || message.includes("resource")
              ? message
              : "Gemini rate limit or daily quota exceeded (free tier: 20 requests/day, 5/min). Set up billing in Google Cloud to increase limits.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: message }),
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
