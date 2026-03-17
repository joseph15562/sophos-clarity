import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://sophos-clarity.vercel.app",
  Deno.env.get("ALLOWED_ORIGIN") ?? "",
].filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

let corsHeaders: Record<string, string> = {};

/** Remove empty strings, empty arrays, and empty objects to cut payload size and token use. */
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




const SYSTEM_PROMPT = `You are a senior network security engineer writing professional firewall configuration documentation for an MSP client handover. The level of detail must be suitable for compliance and audit: document all relevant settings, and pull every column and detail from the data — do not omit or summarise away important fields.

You receive structured JSON data extracted from a Sophos XGS firewall configuration export. Each section may contain:
- **tables**: array of { headers, rows } — use every column in the headers and every row; do not drop columns.
- **details** (or **detail blocks**): per-rule or per-item expansion data with "title" and "fields". You MUST merge this into your report: for each rule/item, if there is a matching detail block, include all fields (e.g. Security Features, Web Filter, Logging, Application Control) in your table or in a clear subsection so the report is complete.

Output Format

Write well-structured Markdown with:
- An Executive Summary at the top with a brief overview of the firewall configuration (number of rules, key security posture observations, overall assessment)
- Clear Section headings for each configuration area
- Markdown tables that include **every column** from the extracted data — Rule Name, Status, Action, Source Zone, Source Networks, Destination Zone, Destination Networks, Services, **Security Features**, **Web Filter** (or "Web Filter Policy"), **Logging** (if present). If a column exists in the export or in rule details, it must appear in your table. Merge detail-block fields into the rule table so each rule shows Security Features, Web Filter, and Logging.
- After each section's table(s), include a Summary paragraph that is specific and compliance-focused: e.g. how many rules with **Destination Zone = WAN** and **Service HTTP, HTTPS, or ANY** have Web Filter "None", how many have logging disabled, reliance on "Any" services, and one-line recommendations.
- After each section, include a **Findings** subsection listing specific issues. You MUST include: (1) every rule with **Destination Zone = WAN** (or Dest Zone WAN) and **Service HTTP, HTTPS, or ANY** that has Web Filter "None" or "Not specified" — list rule names and state "No web filtering for outbound WAN; consider DPI for compliance". **Do not flag rules whose destination is not WAN** or whose service is not HTTP/HTTPS/ANY (e.g. LAN to LAN, VPN to LAN, or non-web services) for web filtering — only destination-WAN rules with web-related service require web filtering for KCSIE/compliance; (2) every rule with logging disabled — list rule names; (3) rules with no or minimal Security Features. For each finding, indicate severity: 🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low.
- After each section, include a **Best Practice Recommendations** subsection with actionable, detailed advice specific to the configuration shown. Each recommendation should explain WHY it matters and HOW to remediate it.

**Required sections when data exists** (include with full detail for compliance):
- **SSL/TLS Settings**: Document all SSL/TLS-related configuration present in the export (e.g. TLS version, SSL inspection, certificate settings, TLS profiles). Use a table where appropriate. **These settings are for the DPI/inspection engine** (what the firewall decrypts and inspects), not for a TLS-terminating service. Do **not** recommend "Enforce TLS 1.2+ to comply with NCSC Guidelines" or cite NCSC in this section — NCSC TLS 1.2+ guidance applies to services that present TLS to end users, not to the firewall's minimum decryption version. Focus recommendations on inspection coverage (e.g. which zones are decrypted) and operational best practice, not on TLS version compliance.
- **Web Filtering / Inspection Method**: State clearly whether **DPI (Deep Packet Inspection)** or **Web proxy** (or both) is in use for web traffic. If the config shows no web filtering or proxy for **outbound traffic to WAN** (rules whose Destination Zone is WAN, Service is HTTP/HTTPS/ANY, and Web Filter "None"), add a prominent **Best Practice** recommendation: "Consider moving to DPI (Deep Packet Inspection) for outbound web traffic to WAN to gain visibility, control, and compliance; currently no web filtering or proxy is in use for WAN-destined rules."

- End with an **Overall Security Recommendations** section covering cross-cutting best practices based on the entire configuration, including SSL/TLS and web inspection where relevant.

Rules

- Document EVERY rule, host, network, and setting provided — do not skip or summarise; level of detail must support compliance and audit
- **Firewall rules table MUST include every rule row** from the payload. Count the total number of rows in the firewall rules table(s) in the payload; your output table must have the same number of rows. Do not omit, summarise, or combine rules — list each rule on its own row.
- **Use all columns** from the extracted tables and merge in any fields from detail blocks (e.g. Security Features, Web Filter, Logging) so the report pulls everything
- For firewall rules: the table MUST include columns for Security Features, Web Filter (or Web Filter Policy), Logging, and App Control when that data exists in the payload (main table or details). Include every column from the export (e.g. #, Rule Name, Status, Action, Source Zone, Source Networks, Dest Zone, Dest Networks, Service, Web Filter, App Control, IPS, Logging, AV/Zero-Day). **Use exactly "Enabled" or "Disabled"** (capitalised) for Status, Logging, and any on/off fields — not "enable", "disable", "enabled", or "disabled". If no web filter data for a rule, show "None" or "Not specified"; **only call it out in Findings when the rule's Destination Zone (Dest Zone) is WAN and Service is HTTP, HTTPS, or ANY** — rules with destination other than WAN or non-web services do not require web filtering for compliance.
- For NAT rules: create a table explaining the translation (what maps to what)
- For **Interfaces & Network** (or Zones, Networks, Ports): create a table with all columns present; include every interface, port, and VLAN. Copy **Interface / VLAN** names exactly as given (e.g. Port1.99, Port2:0, Port3.250)
- For hosts/networks: list all entries in a table with relevant columns
- For policies: describe what each policy does in a table
- Use the actual data provided — never invent or assume configuration details
- If a section has no data, write "No configuration found in export."
- Do NOT output raw JSON — write documentation in Markdown tables and prose
- **Web filtering (Web Filter None)**: Only flag missing web filtering for rules whose **Destination Zone (or Dest Zone) is WAN** and **Service is HTTP, HTTPS, or ANY**. Rules with destination LAN/VPN, or with non-web services, do not require web filtering for KCSIE/compliance — do not list them as Critical or as "Missing Web Filtering".
- **SSL/TLS Global Settings (DPI engine)**: Do not recommend "Enforce TLS 1.2+" or "comply with NCSC Guidelines" for minimum TLS version in this context. This is the inspection engine's decryption policy, not a service-facing TLS stack; NCSC guidance on TLS 1.2+ does not apply here. Do not mark "Insecure TLS Versions" or similar as a finding solely because the minimum decrypt version is below 1.2.
- Start with the Executive Summary, then proceed section by section

**Authentication & OTP Settings**: If the payload contains a section named "Authentication & OTP Settings", "OTP Settings", or "OTPSettings" with tables or data, you MUST document it. Create an "## Authentication & OTP Settings" section with a Markdown table (columns **Setting** and **Value**) for every row present (e.g. otp, allUsers, tokenAutoCreation, otpUserPortal, otpVPNPortal, otpSSLVPN, otpWebAdmin, otpIPsec — values are typically "Enabled" or "Disabled"). Add a brief summary and recommendations for MFA where disabled. Do NOT say "No configuration found in export" for this section when that data exists in the payload.

**VPN Profiles**: Only flag VPN profile weaknesses (weak encryption, weak DH groups, missing PFS) when the profile is **actively referenced** by a VPN IPSec Connection. Unused VPN profiles should be considered compliant — do not raise findings for profiles that are defined but not in use by any connection.

**Wireless Security**: Only flag wireless security issues (weak encryption, open SSIDs, etc.) when the configuration shows **active wireless access points** (registered/online APs in the Wireless Access Point section). If no wireless APs are configured or all are offline/decommissioned, wireless security is compliant — do not raise findings. Note: Sophos AP6 models are now Central-managed only; older APX models are approaching end-of-life; desktop firewall models with built-in WiFi should still be assessed.

**External Log Forwarding**: Sophos Central counts as external log forwarding. If the firewall is registered with Sophos Central (indicators: "Central Management: Read-Write" in admin profiles, firewall rules named "Central Created", or Central management service running), treat external logging as compliant — do not flag missing syslog servers. Only flag "No external log forwarding" when the firewall has neither syslog servers configured NOR Sophos Central management detected.

**API / Monitoring Service Accounts**: If the configuration shows admin accounts with "Read-Only Administrator" profile or accounts named for API/monitoring purposes (e.g. "firecomply-api", "monitoring", "api-user", or similar), these are service-to-service integration accounts used by automated compliance monitoring tools. Document them in an "## API & Service Accounts" section. Include:
- The account name, profile/role, and whether OTP/MFA is enabled
- A note that service accounts for machine-to-machine API integrations cannot use interactive MFA (no human to enter a code) — this is standard practice for SNMP, syslog, SIEM, and compliance monitoring integrations
- Recommended compensating controls: (1) restrict API access to specific IP addresses via Backup & Firmware → API → Allowed IP addresses, (2) use Read-Only Administrator profile to enforce least privilege, (3) use a strong machine-generated password, (4) monitor API access via firewall audit logs
- State that with these compensating controls in place, a non-MFA service account is an accepted exception under ISO 27001 A.9.4.2, Cyber Essentials "technical controls", NIST 800-53 IA-2, and PCI DSS 8.3 — all of which distinguish interactive human access (requires MFA) from non-interactive service-to-service access (compensating controls acceptable)
- If the API account has full Administrator access instead of Read-Only, flag this as 🟡 Medium: "API service account has full admin privileges — recommend restricting to Read-Only Administrator profile for least privilege"`;

const EXECUTIVE_SYSTEM_PROMPT = `You are a senior network security engineer writing a consolidated executive summary report for an MSP covering MULTIPLE firewall configurations. Include best-practice recommendations and a compliance-suitable level of detail.

You receive structured JSON data where each top-level key is a firewall name/label, and its value contains the extracted configuration sections for that firewall.

Output Format

Write a comprehensive executive Markdown document with:
- A Executive Overview summarising the entire estate: how many firewalls, their roles/purposes, overall security posture
- A Per-Firewall Summary section with a subsection for each firewall, including: key stats (rule count, zones, networks), **SSL/TLS settings** (what is configured), whether **DPI (Deep Packet Inspection)** or **Web proxy** is in use for web traffic (or neither), and top concerns
- A Cross-Estate Findings section identifying: common misconfigurations, inconsistencies between firewalls, shared vulnerabilities
- A **Best Practice Recommendations** section: for any firewall not using DPI or web proxy for outbound web filtering on **WAN rules with Service HTTP/HTTPS/ANY**, include a clear recommendation to move to DPI for visibility, control, and compliance
- A Risk Matrix as a Markdown table: Finding | Severity | Affected Firewalls | Recommendation
- A Strategic Recommendations section with prioritised actions for the entire estate (including SSL/TLS and web inspection where relevant)
- An Appendix briefly listing each firewall's configuration highlights (including SSL/TLS and DPI/proxy status)

Rules
- Compare and contrast configurations across firewalls
- Identify patterns and inconsistencies
- For each firewall, state whether DPI or Web proxy (or both, or neither) is used; if neither, recommend moving to DPI
- Prioritise findings by risk severity
- Use the actual data provided — never invent details
- Reference specific firewalls by their label names
- Do NOT reproduce every individual rule — summarise and highlight exceptions
- Use Markdown tables for structured data
- Level of detail must support compliance and audit
- **VPN Profiles**: Only flag VPN profile weaknesses (weak encryption, weak DH groups, missing PFS) when the profile is **actively referenced** by a VPN IPSec Connection. Unused VPN profiles are compliant.
- **Wireless Security**: Only flag wireless security issues when **active wireless access points** are configured. If no APs are present, wireless security is compliant.
- **External Log Forwarding**: Sophos Central counts as external log forwarding. If the firewall shows Central management (e.g. "Central Management: Read-Write" in admin profiles, "Central Created" firewall rules), treat external logging as compliant — do not flag missing syslog.
- **API / Monitoring Service Accounts**: If any firewall has admin accounts with Read-Only Administrator profile or named for API/monitoring use (e.g. "firecomply-api"), note them as service-to-service integration accounts. These cannot use interactive MFA. Document recommended compensating controls (IP restriction, read-only profile, strong password, audit logging) and note this is standard practice for monitoring integrations. Only flag as a concern if the account has full admin privileges instead of read-only.
- End every report with a "Limitations" section that states: this assessment covers firewall configuration only. It does not assess endpoint security, email security, identity management, cloud infrastructure, or physical security controls. Results are point-in-time and should be validated by a qualified security professional.`;

const COMPLIANCE_SYSTEM_PROMPT = `You are a senior cybersecurity analyst producing a Compliance Readiness Report from firewall configuration data. This document provides an indicative assessment of firewall configuration controls against compliance frameworks. It should be used as supporting material alongside a full compliance audit — not as a substitute for one.

When multiple firewalls are assessed, **security features (e.g. MFA, OTP, 2FA) must be enabled across all firewalls and in all relevant areas**. If any single firewall lacks a required security feature in any area, the report must show **⚠️ Partial** for that control and clearly state **which firewall** is lacking it and **what** is missing (e.g. "Firewall A — MFA not enabled for SSL-VPN"; "Firewall B — OTP disabled for Web Admin").

Output Format

Write a structured Markdown document with these sections:

1. Document Header
- **Title**: "Compliance Readiness Report — Firewall Configuration Assessment"
- **Date**: Current assessment date
- **Scope**: Firewalls assessed, environment type

2. **Security Feature Gaps by Firewall** (required when any firewall lacks a feature)
- A table or list: for each firewall that is **missing** a required security feature (MFA, OTP, logging, etc.), state the **firewall name**, the **feature that is lacking**, and **where** (e.g. "Firewall A | MFA/OTP | Not enabled for SSL-VPN, Web Admin"). Use this so auditors can see at a glance which firewall lacks what.

3. Control → Evidence Mapping Tables
For EACH applicable framework below, produce a Markdown table with columns:
| Control ID | Control Description | Status | Firewall(s) Lacking / What Is Missing | Evidence | Example of non-compliance | Notes |

- **Status**: ✅ Met | ⚠️ Partial | ❌ Not Met | N/A
- **Firewall(s) Lacking / What Is Missing**: When Status is ⚠️ Partial or ❌ Not Met because one or more firewalls lack the control, list the **firewall name(s)** and **what is missing** (e.g. "Firewall A — MFA not enabled for VPN"; "Firewall B — logging off on rule X"). Leave blank or "—" when Met or N/A.
- **Example of non-compliance**: When Status is ⚠️ Partial or ❌ Not Met, give a short example: **which firewall** and **one concrete example** of what is not compliant (e.g. "Firewall A: Rule 'VPN allow' has Logging Disabled"; "Firewall B: Rule 'dales red to WAN' has Web Filter None for destination WAN"). Omit or "—" when Met or N/A.

4. Frameworks to Assess

5. Textual Evidence Sections
For each control area, provide:
- Configuration excerpts — quote actual rule names, zone configurations, policy settings from the data
- What was observed — factual statement of what the config shows, **per firewall where relevant**
- Assessment — whether this meets the control requirement; if partial or not met, **which firewall(s)** lack it and **what** is missing

6. Not Applicable Justifications
For any control marked N/A, provide a clear justification statement suitable for an auditor.

7. Residual Risk Statements
List identified residual risks in a table:
| Risk ID | Description | Affected Firewalls | Affected Controls | Severity | Recommended Mitigation |

8. Summary of Findings
- Total controls assessed per framework
- Met / Partial / Not Met / N/A counts
- **Per-firewall security feature summary**: for each firewall, list any missing or partial security features (e.g. MFA not in all areas, logging off on rules)
- **Per-firewall SSL/TLS and web inspection**: for each firewall, state SSL/TLS settings and whether DPI or Web proxy is in use; if neither web filtering nor proxy is used, note "Recommend move to DPI"
- Overall compliance posture: if any firewall lacks a required security feature (e.g. MFA in all areas), the posture must be **Partial** and state which firewall(s) and what is lacking

9. **Best Practice Recommendations** (required)
- A section with actionable, compliance-focused recommendations across all firewalls
- **SSL/TLS**: Document SSL/TLS settings found (these are DPI/inspection engine settings; do not recommend "Enforce TLS 1.2+ for NCSC compliance" for the firewall's minimum decryption version — that guidance applies to TLS-terminating services, not the inspection engine). Recommend inspection coverage and operational best practice where relevant.
- **Web filtering / inspection**: For each firewall (or the estate) **not** using DPI or web proxy for **outbound traffic to WAN** (rules whose Destination Zone is WAN and Service is HTTP, HTTPS, or ANY), include a clear recommendation: "Move to DPI (Deep Packet Inspection) for outbound web traffic to WAN to achieve visibility, control, and compliance; currently no web filtering or proxy is in use for WAN-destined rules." Only consider destination-WAN rules with service HTTP/HTTPS/ANY when assessing web filtering. Name the firewall(s) concerned.

Rules
- Use ONLY the actual configuration data provided — never invent details
- **Level of detail**: Suitable for compliance — document SSL/TLS settings, DPI vs Web proxy usage, and all evidence with enough detail for auditors
- Quote specific rule names, IP ranges, zones, and policy names as evidence
- **SSL/TLS and DPI/Web proxy**: In evidence and control mapping, state whether each firewall uses DPI or Web proxy (or neither) **for rules with Destination Zone = WAN and Service HTTP, HTTPS, or ANY**. Document SSL/TLS settings where present. Only for rules whose destination is WAN and service is web-related (HTTP, HTTPS, ANY): if a firewall has no web filtering or proxy on those rules, recommend moving to DPI and note it in "Firewall(s) Lacking / What Is Missing" or Notes where the control relates to filtering/inspection.
- **Security features (MFA, OTP, 2FA, etc.)**: If **any** firewall does not have the feature enabled in **all** relevant areas (e.g. VPN, Web Admin, SSL-VPN, IPsec), mark the control **⚠️ Partial**. In Notes/Evidence and in "Firewall(s) Lacking / What Is Missing", state **which firewall** and **what** is lacking (e.g. "Firewall A — MFA not enabled for SSL-VPN and Web Admin").
- When citing firewall rules, include **Web Filter** (or web filtering policy) where the data provides it. **Web filtering affects compliance only when the rule's Destination Zone (or Dest Zone) is WAN and Service is HTTP, HTTPS, or ANY.** For KCSIE or any web-filtering-related control: only assess rules that have **Destination Zone = WAN** and **Service HTTP, HTTPS, or ANY** (or destination to WAN/internet with web-related service). If a rule's destination is not WAN, or its service is not HTTP/HTTPS/ANY (e.g. LAN to LAN, VPN to LAN, or non-web services), ignore web filter "None" for that rule — do not fail or partial the control for those. Only rules with destination WAN and web-related service must have web filtering for compliance.
- **Logging / monitoring**: For any control that relates to monitoring, logging, or audit trail (e.g. "enable logging", "log traffic", "audit", "monitoring"), **fail that control (❌ Not Met)** if the config shows one or more firewall rules with logging disabled (e.g. "Log" off, "Logging" disabled, or no log option enabled). Note which rule(s) and which firewall(s) have logging off in Evidence/Notes.
- Be specific about which rules/settings satisfy which controls
- If data is insufficient to assess a control, mark as "⚠️ Partial — Insufficient evidence in config export"
- Format for direct use as an audit appendix — professional, factual, no narrative fluff
- Every claim must be traceable to config data
- **VPN Profiles**: Only flag VPN profile weaknesses (weak encryption, weak DH groups, missing PFS) when the profile is **actively referenced** by a VPN IPSec Connection. Unused/orphaned VPN profiles should not fail compliance controls.
- **Wireless Security**: Only flag wireless security issues when **active wireless access points** are configured on the firewall. If no APs are registered or active, mark wireless controls as N/A or compliant, not as a gap.
- **External Log Forwarding**: Sophos Central counts as external log forwarding. If the firewall is registered with Sophos Central (indicators: "Central Management: Read-Write" in admin profiles, "Central Created" firewall rules, Central management service running), the external logging control is **✅ Met** — do not flag missing syslog servers as a compliance gap.
- **API / Monitoring Service Accounts**: Admin accounts with "Read-Only Administrator" profile or named for API/monitoring use (e.g. "firecomply-api", "monitoring", "api-user") are service-to-service integration accounts for automated compliance monitoring tools. For MFA-related compliance controls (ISO 27001 A.9.4.2, Cyber Essentials, NIST 800-53 IA-2, PCI DSS 8.3): these frameworks distinguish interactive human access (requires MFA) from non-interactive service-to-service access (compensating controls acceptable). If the API account is Read-Only, IP-restricted, and uses a strong password, mark MFA controls as **✅ Met** with a note documenting the compensating controls. If the API account has full Administrator privileges, mark as **⚠️ Partial** and recommend restricting to Read-Only Administrator. Document all API/monitoring service accounts in the "Security Feature Gaps by Firewall" section with their compensating controls.`;

const CHAT_SYSTEM_PROMPT = `You are a senior Sophos firewall security expert embedded in the FireComply assessment tool. The user has uploaded firewall configuration(s) and you have access to analysis results, findings, and stats.

Your role:
- Answer questions about the assessment concisely and accurately
- Cite specific rule names, findings, and data when relevant
- Provide actionable remediation advice referencing Sophos XGS administration
- Use markdown formatting (bold, lists, code) for clarity
- Keep responses focused — aim for 200-400 words unless the user asks for detail
- If asked about compliance, reference the relevant framework controls
- Never invent configuration data — only reference what's provided in the context

Important assessment rules:
- VPN profiles are only non-compliant if actively used by an IPSec connection. Unused profiles are compliant.
- Wireless security issues only apply if active wireless APs are configured. No APs = compliant.
- Sophos Central counts as external log forwarding. Central-managed firewalls satisfy the syslog/external logging requirement.`;

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const chat: boolean = body?.chat === true;
    const chatContext: string | undefined = body?.chatContext;
    const sections = body?.sections;
    const environment: string | undefined = body?.environment;
    const country: string | undefined = body?.country;
    const customerName: string | undefined = body?.customerName;
    const executive: boolean = body?.executive === true;
    const compliance: boolean = body?.compliance === true;
    const firewallLabels: string[] | undefined = body?.firewallLabels;
    const selectedFrameworks: string[] | undefined = body?.selectedFrameworks;
    const centralEnrichment: Record<string, unknown> | undefined = body?.centralEnrichment;

    if (chat) {
      if (!chatContext || typeof chatContext !== "string") {
        return new Response(
          JSON.stringify({ error: "Missing chatContext for chat mode." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (!sections || typeof sections !== "object") {
      return new Response(
        JSON.stringify({ error: "Missing sections field. Expected pre-extracted JSON." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gemini API key (required)
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    let systemPrompt: string;
    let userMessage: string;
    let maxTokens: number;

    if (chat) {
      systemPrompt = CHAT_SYSTEM_PROMPT;
      userMessage = chatContext!;
      maxTokens = 2048;
    } else {
      // Compact payload: no pretty-print (saves tokens), strip empty fields
      const compactSections = pruneEmpty(sections) as Record<string, unknown>;
      const payload = JSON.stringify(compactSections);

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

      if (selectedFrameworks && selectedFrameworks.length > 0) {
        complianceContext += `\n\n## Selected Compliance Frameworks\nThe following frameworks have been selected for this assessment. You MUST assess against ALL of these and ONLY these frameworks:\n`;
        selectedFrameworks.forEach((fw) => {
          complianceContext += `- **${fw}**\n`;
        });
        complianceContext += `\nFor each framework, provide specific control references, cite actual requirements, and flag any configuration gaps. Tailor all "Best Practice Recommendations" and "Overall Security Recommendations" to these frameworks.\n`;
      } else if (environment || country) {
        complianceContext += `\nIMPORTANT: Tailor ALL "Best Practice Recommendations" and the "Overall Security Recommendations" section to focus on compliance frameworks and regulatory requirements relevant to this environment and country.\n`;
      }

      if (centralEnrichment && Object.keys(centralEnrichment).length > 0) {
        complianceContext += "\n\n## Sophos Central Live Data\nThe following live data was retrieved from Sophos Central API for this firewall. Include this in the report under a dedicated **Sophos Central Status** section near the top (after the Executive Summary). Use it to enrich findings — for example, confirm the firewall is centrally managed, note the firmware version, HA status, and flag any active alerts.\n";
        complianceContext += "```json\n" + JSON.stringify(centralEnrichment) + "\n```\n";
      }

      let basePrompt: string;
      if (compliance) {
        basePrompt = COMPLIANCE_SYSTEM_PROMPT;
      } else if (executive) {
        basePrompt = EXECUTIVE_SYSTEM_PROMPT;
      } else {
        basePrompt = SYSTEM_PROMPT;
      }
      systemPrompt = basePrompt + complianceContext;

      if (compliance && firewallLabels && firewallLabels.length > 1) {
        userMessage = `Here are the extracted configurations for ${firewallLabels.length} firewalls (${firewallLabels.join(", ")}). Produce a comprehensive Compliance Readiness Report covering all firewalls:\n\n${payload}`;
      } else if (compliance) {
        userMessage = `Here is the extracted Sophos firewall configuration data. Produce a comprehensive Compliance Readiness Report:\n\n${payload}`;
      } else if (executive && firewallLabels) {
        userMessage = `Here are the extracted configurations for ${firewallLabels.length} firewalls (${firewallLabels.join(", ")}). Produce a consolidated executive summary report:\n\n${payload}`;
      } else {
        userMessage = "Here is the extracted Sophos firewall configuration data. Document every section completely. Use every column from each table; if a section has a 'details' or 'detail blocks' array, merge those fields (e.g. Security Features, Web Filter, Logging) into your rule table so the report is complete and suitable for compliance.\n\n" + payload;
      }

      maxTokens = 8192;
    }

    // Debug mode (body.debug === true): return what the backend received and will send to the AI, without calling Gemini
    if (body?.debug === true) {
      const sectionKeys = sections && typeof sections === "object" ? Object.keys(sections) : [];
      const payloadForSize = typeof sections === "object" ? JSON.stringify(pruneEmpty(sections)) : "";
      const debugPayload = {
        reportType: chat ? "chat" : compliance ? "compliance" : executive ? "executive" : "technical",
        sectionCount: sectionKeys.length,
        sectionKeys,
        payloadSizeBytes: payloadForSize.length,
        payloadSizeKB: Math.round((payloadForSize.length / 1024) * 10) / 10,
        systemPromptLength: systemPrompt.length,
        userMessageLength: userMessage.length,
        maxTokens,
        firewallLabels: firewallLabels ?? null,
        hasCentralEnrichment: centralEnrichment != null && Object.keys(centralEnrichment).length > 0,
        environment: environment ?? null,
        country: country ?? null,
        selectedFrameworksCount: selectedFrameworks?.length ?? 0,
      };
      return new Response(JSON.stringify(debugPayload, null, 2), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prefer faster model for lower latency; gemini-2.0-flash is production and typically quicker to first token
    const model = Deno.env.get("GEMINI_REPORT_MODEL") || "gemini-2.0-flash";

    const doRequest = () =>
      fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          stream: true,
          temperature: 0.1,
          max_tokens: maxTokens,
        }),
      });

    let response = await doRequest();
    const max429Retries = 2;
    for (let retries = 0; response.status === 429 && retries < max429Retries; retries++) {
      const retrySec = 15 + retries * 15; // 15s, 30s backoff
      console.log(`parse-config: 429 rate limit. Waiting ${retrySec}s before retry (attempt ${retries + 1}/${max429Retries}).`);
      await new Promise((r) => setTimeout(r, retrySec * 1000));
      response = await doRequest();
    }

    if (!response.ok) {
      const text = await response.text();
      console.error("Gemini API error:", response.status, text.slice(0, 500));

      let message = `AI processing failed (HTTP ${response.status})`;
      try {
        const errJson = JSON.parse(text);
        const detail = errJson.error?.message ?? errJson.message ?? errJson.error;
        if (typeof detail === "string") message = detail;
      } catch (parseErr) {
        console.warn("[parse-config] Gemini error JSON parse", parseErr);
        if (text.length > 0 && text.length < 200) message = text;
      }

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send an immediate empty SSE chunk so the client gets 200 + first byte right away and can show "Generating…" instead of staying on "Sending request" for 30–90s
    const immediateChunk = new TextEncoder().encode("data: {\"choices\":[{\"delta\":{\"content\":\"\"}}]}\n");
    const reader = response.body!.getReader();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(immediateChunk);
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });
    return new Response(stream, {
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
