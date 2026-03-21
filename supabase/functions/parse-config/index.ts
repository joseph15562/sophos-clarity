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

/**
 * Shared rules appended to every system prompt to avoid duplication.
 * Covers VPN profiles, wireless, external logging, API accounts, SSL/TLS, and web filter scope.
 */
const SHARED_RULES = `
Shared Assessment Rules

- **Web filter scope**: Only flag missing web filtering for rules whose **Destination Zone is WAN** and **Service is HTTP, HTTPS, or ANY**. Rules with other destinations or non-web services do not require web filtering for compliance. Do not flag LAN-to-LAN, VPN-to-LAN, or non-web service rules.
- **VPN Profiles**: Only flag weaknesses (weak encryption, weak DH groups, missing PFS) when the profile is **actively referenced** by a VPN IPSec Connection. Unused profiles are compliant.
- **Wireless Security**: Only flag issues when **active wireless access points** are configured. No APs = compliant. Sophos AP6 models are Central-managed only; older APX models are approaching end-of-life.
- **External Log Forwarding**: Sophos Central counts as external log forwarding. If the firewall shows Central management (e.g. "Central Management: Read-Write" in admin profiles, "Central Created" firewall rules), treat external logging as compliant — do not flag missing syslog.
- **API / Monitoring Service Accounts**: Admin accounts with "Read-Only Administrator" profile or named for API/monitoring use (e.g. "firecomply-api") are service-to-service integration accounts. These cannot use interactive MFA. Document recommended compensating controls (IP restriction, read-only profile, strong password, audit logging). With compensating controls in place, a non-MFA service account is an accepted exception under ISO 27001 A.9.4.2, Cyber Essentials, NIST 800-53 IA-2, and PCI DSS 8.3. Only flag as a concern if the account has full admin privileges instead of read-only.
- **SSL/TLS (DPI engine)**: These settings are for the DPI/inspection engine (what the firewall decrypts), not a TLS-terminating service. Do not recommend "Enforce TLS 1.2+ to comply with NCSC Guidelines" — NCSC guidance applies to services presenting TLS to end users, not the firewall's minimum decryption version. Focus on inspection coverage and operational best practice.
- **Omitted sections**: Only document sections present in the payload. If a section is not in the payload, do not mention it or write a heading for it.
`;

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
- **details** (or **detail blocks**): per-rule or per-item expansion data with "title" and "fields". Merge Web Filter and Logging from detail blocks into your rule table. Do **not** add a Security Features column to the firewall rules table; omit Security Features / Scan FTP / Scan IMAP etc. from the table.

**Individual firewall report layout (keep this structure exactly when the prompt specifies an individual firewall):**
- **Opening block**: Follow the "Individual report: required opening layout" instructions in the context (title line, Assessment Date, Scope, Compliance Context, Selected Compliance Frameworks, Executive Summary heading and paragraph).
- **Per section**: For each configuration section (Firewall Rules, Interfaces Ports & VLANs, Zones, NAT Rules, Authentication Servers, etc.), use this pattern: (1) Section heading (e.g. ## Firewall Rules), (2) short intro paragraph, (3) full Markdown table when applicable, (4) **Summary of [Section Name]** paragraph, (5) **Findings** with severity bullets (🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low), (6) **Best Practice Recommendations** with actionable items and "How to remediate" where relevant.
- **Final section**: End the report with **## Overall Security Recommendations for [firewall name]** (use the firewall name from the context), covering cross-cutting critical gaps, then enhanced inspection/control, then network segmentation and access control, then operational security and maintenance. Use the exact heading format "Overall Security Recommendations for [name]".

Output Format

Write well-structured Markdown with:
- An Executive Summary at the top with a brief overview of the firewall configuration (number of rules, key security posture observations, overall assessment). When the context specifies the opening layout, output the exact title, Assessment Date, Scope, Compliance Context, and frameworks list before the Executive Summary.
- **Immediately after the Executive Summary**, if the payload contains a "Firewall Rules" section (or "FirewallRule" data), you MUST output a **## Firewall Rules** section with a Markdown table listing every rule (or first 150 rules plus a truncation note if there are more than 150). This section is mandatory and must not be skipped or moved to the end. Include the required columns (Rule Name, Status, Action, Source Zone, Source Networks, Dest Zone, Dest Networks, Service, Web Filter, Logging, etc.). Do **not** include a Security Features column. Merge detail-block fields for Web Filter and Logging only. Then add **Summary of Firewall Rules**, **Findings**, and **Best Practice Recommendations** for the firewall rules.
- Clear Section headings for each remaining configuration area. For each section include: **Summary of [Section Name]** paragraph, **Findings** subsection, **Best Practice Recommendations** subsection.
- Markdown tables that include **every column** from the extracted data. If a column exists in the export or in rule details, it must appear in your table. Merge detail-block fields into the rule table for Web Filter and Logging only; do not add a Security Features column.
- After each section's table(s), include a **Summary of [Section Name]** paragraph that is specific and compliance-focused: e.g. how many rules with **Destination Zone = WAN** and **Service HTTP, HTTPS, or ANY** have Web Filter "None", how many have logging disabled, reliance on "Any" services, and one-line recommendations.
- After each section, include a **Findings** subsection listing specific issues. Findings must be about **firewall configuration only** (rules, zones, logging, web filter, etc.) — do not create findings from Sophos Central alert count or list framework control numbers (e.g. 1.1, 1.2, … 1.890). Keep each finding to one short line; no long control-ID lists. You MUST include: (1) every rule with **Destination Zone = WAN** (or Dest Zone WAN) and **Service HTTP, HTTPS, or ANY** that has Web Filter "None" or "Not specified" — list rule names and state "No web filtering for outbound WAN; consider DPI for compliance". **Do not flag rules whose destination is not WAN** or whose service is not HTTP/HTTPS/ANY (e.g. LAN to LAN, VPN to LAN, or non-web services) for web filtering — only destination-WAN rules with web-related service require web filtering for KCSIE/compliance; (2) every rule with logging disabled — list rule names; (3) rules with no or minimal Security Features. For each finding, indicate severity: 🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low.
- After each section, include a **Best Practice Recommendations** subsection with actionable, detailed advice specific to the configuration shown. Each recommendation should explain WHY it matters and HOW to remediate it.

**Required sections when data exists** (include with full detail for compliance):
- **Sophos Central Status**: When the payload includes Sophos Central live data, include a short **Sophos Central Status** section (firmware, connected state only). Do not include High Availability (HA mode/status) in this section or elsewhere at the top of the report. Do **not** list individual alerts — only state the alert count in one sentence (e.g. "Sophos Central reports N open alerts; review in Central for details"). **Do NOT create any Finding** (Critical, High, Medium, or Low) based on Sophos Central alert count. Do NOT say that alerts "require immediate investigation" or cite NCSC/Cyber Essentials/KCSIE in relation to the alert count. The alert count is informational only; do not add a "Review Sophos Central Alerts" item under Findings. Findings must be about **firewall configuration** only (rules, logging, web filter, zones, etc.). Do not cite long lists of framework control numbers in Findings; each finding is one short statement about the config (e.g. "Rule X has logging disabled").
- **Firewall Rules**: When the payload has a "Firewall Rules" (or "FirewallRule") section, you MUST output it as **## Firewall Rules** right after the Executive Summary. Output the full Markdown table immediately: header row, separator row, then one data row per rule (or first 150 rows plus a truncation note). Do not write "Still generating...", "Loading...", or any placeholder in place of the table — output the actual rule rows. Then add Summary, Findings, and Best Practice Recommendations. Complete this section fully before moving on so the stream finishes.
- **SSL/TLS Settings**: Document all SSL/TLS-related configuration present in the export (e.g. TLS version, SSL inspection, certificate settings, TLS profiles). Use a table where appropriate. **These settings are for the DPI/inspection engine** (what the firewall decrypts and inspects), not for a TLS-terminating service. Do **not** recommend "Enforce TLS 1.2+ to comply with NCSC Guidelines" or cite NCSC in this section — NCSC TLS 1.2+ guidance applies to services that present TLS to end users, not to the firewall's minimum decryption version. Focus recommendations on inspection coverage (e.g. which zones are decrypted) and operational best practice, not on TLS version compliance. If the config shows no DPI for outbound WAN web traffic, add a **Best Practice** recommendation in the relevant section (e.g. Firewall Rules or Overall Security Recommendations): "Enable DPI for outbound web traffic to WAN for visibility and compliance."

- End with an **Overall Security Recommendations** section covering cross-cutting best practices based on the entire configuration, including SSL/TLS and web inspection where relevant.

Rules

- Document EVERY rule, host, network, and setting provided — do not skip or summarise; level of detail must support compliance and audit
- **Firewall rules table**: Include every rule row from the payload. If the payload has **more than 150** firewall rules, output the first 150 rows in full, then add one summary row (e.g. "| … | (N more rules; see export for full list) | … |") and continue with Summary, Findings, and Best Practice. This keeps the report within token limits and ensures the stream completes. If there are 150 or fewer rules, output every row with no truncation.
- **Use all columns** from the extracted tables and merge in fields from detail blocks for Web Filter and Logging only (do not include Security Features in the firewall rules table)
- For firewall rules: the table MUST have **the rule number (#) as the first column**, then Rule Name, then the rest. Include columns for Web Filter (or Web Filter Policy), Logging, and App Control when that data exists in the payload (main table or details). Do **not** include a Security Features column. Include every column from the export **except** the following — do **not** include these in the firewall rules table: Description, Schedule, Minimum Destination HB Permitted, Source Security Heartbeat, Destination Security Heartbeat, Block Quick Quic, SSL/TLS Decryption, Minimum Source HB Permitted, **Security Features**. Include other columns (e.g. #, Rule Name, Status, Action, Source Zone, Source Networks, Dest Zone, Dest Networks, Service, Web Filter, App Control, IPS, Logging, AV/Zero-Day). If the payload has a "#" column, use it as the first column; otherwise use row order (1, 2, 3, …) as the first column. **Use exactly "Enabled" or "Disabled"** (capitalised) for Status, Logging, and any on/off fields — not "enable", "disable", "enabled", or "disabled". If no web filter data for a rule, show "None" or "Not specified"; **only call it out in Findings when the rule's Destination Zone (Dest Zone) is WAN and Service is HTTP, HTTPS, or ANY** — rules with destination other than WAN or non-web services do not require web filtering for compliance.
- For NAT rules: create a table explaining the translation (what maps to what)
- **Interfaces, Ports & VLANs**: Combine "VLANs" and "Interfaces & Ports" (or "Interfaces & Network") into a single section — **## Interfaces, Ports & VLANs**. Use one Markdown table with one row per line (no line breaks within a row). Include these columns when present in the payload: **Name** (interface/VLAN name, e.g. Port1.99, Port2:0), **Port** (port number or hardware name, e.g. Port1, Port2 — from HardwareName, Interface, Hardware, or Port when available), **VLAN** (VLAN ID or number — from VLAN, VLANID, VlanID, VID, or "Interface / VLAN" when available), **Zone**, **IP/Network** (or IPv4), **Status** (or link state). Omit low-value columns (e.g. FEC, MSS, MTU, AutoNegotiation, BreakoutMembers, DHCPRapidCommit, GatewayName) to keep each row on a single line. Copy interface/VLAN names exactly as given. Do not add a "Summary of Interfaces, Ports & VLANs" heading — write any summary as a paragraph under the main section. Do not output separate "VLANs" and "Interfaces & Ports" sections; merge them into one.
- **Appliance Access in Zones**: When the payload contains zone or appliance-access columns with \`ApplianceAccess.*\` identifiers, use **user-friendly names** in the report. Examples: \`ApplianceAccess.NetworkServices.Ping\` → "Ping", \`ApplianceAccess.OtherServices.WirelessProtection\` → "Wireless protection", \`ApplianceAccess.OtherServices.SMTPRelay\` → "SMTP relay", \`ApplianceAccess.VPNServices.RED\` or \`ApplianceAccess.VPN Services.RED\` → "RED (VPN)", \`ApplianceAccess.VPNServices.SSLVPN\` → "SSL VPN", \`ApplianceAccess.VPNServices.VPNPortal\` → "VPN Portal", \`ApplianceAccess.AdminServices.SSH\` or \`ApplianceAccess.Admin Services.SSH\` → "SSH (Admin)", \`ApplianceAccess.AdminServices.HTTPS\` or \`ApplianceAccess.Admin Services.HTTP\` → "HTTPS (Admin)", \`ApplianceAccess.OtherServices.WebProxy\` → "Web Proxy", \`ApplianceAccess.OtherServices.UserPortal\` → "User Portal", \`ApplianceAccess.OtherServices.SNMP\` → "SNMP", \`ApplianceAccess.OtherServices.DynamicRouting\` → "Dynamic routing", \`ApplianceAccess.NetworkServices.DNS\` → "DNS", \`ApplianceAccess.AuthenticationServices.ADSSO\` → "AD SSO", \`ApplianceAccess.AuthenticationServices.CaptivePortal\` → "Captive Portal", \`ApplianceAccess.AuthenticationServices.Radius SSO\` → "RADIUS SSO", \`ApplianceAccess.AuthenticationServices.Chromebook SSO\` → "Chromebook SSO", \`ApplianceAccess.AuthenticationServices.Client Authentication\` → "Client authentication". For any unlisted \`ApplianceAccess.X.Y\` value, use the last part as a readable label (e.g. Ping, Wireless protection, SMTP relay) — no raw \`ApplianceAccess.*\` strings in the report.
- For hosts/networks: list all entries in a table with relevant columns
- For policies: describe what each policy does in a table
- Use the actual data provided — never invent or assume configuration details
- If a section has no data, write "No configuration found in export."
- Only document sections present in the payload. If a section is absent, skip it — do not write a heading.
- **No repeated headings**: Each section heading (e.g. ## Firewall Rules, ## Zones) must appear only once. Do not add "Summary of [Section]" headings.
- **Consistent numbers**: The firewall rule count must be identical everywhere in the report. Count actual rows and use that number consistently.
- **Complete sentences**: Write only complete sentences. Avoid duplicate consecutive words.
- **RED (Remote Ethernet Device)**: Only include a short **RED Devices** section with a table: **Device** and **IP**. Do not document full RED configuration.
- Do NOT output raw JSON — write documentation in Markdown tables and prose.
- **No placeholder or loading text**: Never write "Still generating...", "Loading...", etc. Output actual content only.
- **Table format**: Every table MUST be valid Markdown with header, separator, and data rows — each row on a single line. Do not use the pipe character (|) or newlines inside any cell; use a comma or "and" instead so the table does not break. Each row must have exactly the same number of cells as the header.
- Start with the Executive Summary, then **Firewall Rules** (full table) if present, then remaining sections. Complete the entire report in one response.

**Authentication & OTP Settings**: If the payload contains "Authentication & OTP Settings", "OTP Settings", or "OTPSettings", create an "## Authentication & OTP Settings" section with a **Setting** / **Value** table. Add summary and MFA recommendations where disabled.

**VPN Connections** (IPSec Connections): Use a single table: **Connection Name**, **Remote Host**, **Security / Encryption**. Add a short summary of issues or "No issues identified."

**API / Monitoring Service Accounts**: If the configuration shows admin accounts with "Read-Only Administrator" profile or named for API/monitoring use, document them in "## API & Service Accounts". Include account name, profile/role, OTP status, note that service accounts cannot use interactive MFA, and recommended compensating controls (IP restriction, read-only profile, strong password, audit logging). If full admin privileges, flag as 🟡 Medium.`;

const EXECUTIVE_SYSTEM_PROMPT = `You are a senior network security engineer writing an executive summary report for an MSP. Include best-practice recommendations and a compliance-suitable level of detail.

You receive structured JSON data where each top-level key is a firewall name/label, and its value contains the extracted configuration sections for that firewall. There may be one or multiple firewalls.

Output Format

Write a comprehensive executive Markdown document with:
- An Executive Overview summarising the estate: how many firewalls, their roles/purposes, overall security posture
- A Per-Firewall Summary section with a subsection for each firewall, including: key stats (rule count, zones, networks), **SSL/TLS settings** (what is configured), whether **DPI (Deep Packet Inspection)** is in use for web traffic, and top concerns
- If multiple firewalls: a Cross-Estate Findings section identifying common misconfigurations, inconsistencies, and shared vulnerabilities
- A **Best Practice Recommendations** section: for any firewall not using DPI for outbound web filtering on **WAN rules with Service HTTP/HTTPS/ANY**, include a clear recommendation to enable DPI for visibility, control, and compliance
- A Risk Matrix as a Markdown table: Finding | Severity | Affected Firewalls | Recommendation
- A Strategic Recommendations section with prioritised actions (including SSL/TLS and web inspection where relevant)
- An Appendix briefly listing each firewall's configuration highlights (including SSL/TLS and DPI status)

Rules
- If multiple firewalls: compare and contrast configurations, identify patterns and inconsistencies
- For each firewall, state whether DPI is used for web traffic; if not, recommend enabling DPI. Do not mention Web proxy — focus on DPI only.
- Prioritise findings by risk severity
- Use the actual data provided — never invent details
- Reference specific firewalls by their label names
- Do NOT reproduce every individual rule — summarise and highlight exceptions
- Use Markdown tables for structured data
- Level of detail must support compliance and audit
- End every report with a "Limitations" section that states: this assessment covers firewall configuration only. It does not assess endpoint security, email security, identity management, cloud infrastructure, or physical security controls. Results are point-in-time and should be validated by a qualified security professional.`;

const COMPLIANCE_SYSTEM_PROMPT = `You are a senior cybersecurity analyst producing a Compliance Readiness Report from firewall configuration data. This document provides an indicative assessment of firewall configuration controls against compliance frameworks. It should be used as supporting material alongside a full compliance audit — not as a substitute for one.

When multiple firewalls are assessed, **security features (e.g. MFA, OTP, 2FA) must be enabled across all firewalls and in all relevant areas**. If any single firewall lacks a required security feature in any area, the report must show **⚠️ Partial** for that control and clearly state **which firewall** is lacking it and **what** is missing (e.g. "Firewall A — MFA not enabled for SSL-VPN"; "Firewall B — OTP disabled for Web Admin").

Required Report Layout (keep this structure and section order exactly)

The report body must follow this layout. The cover block (title, date, prepared by, disclaimer) is prepended by the system; you output the following only.

**Opening (first two lines of your output):**
- Line 1: Compliance Readiness Report — Firewall Configuration Assessment
- Line 2: Date: [assessment date] Scope: [firewall name(s), comma-separated if multiple] ([customer/tenant name]), [Environment] Environment, [Country]. Example: "Date: 19 March 2026 Scope: firewall.salesengineers.uk (Customer Name), Education Environment, United Kingdom"

**Then these sections in order, with these exact headings and numbering (start at 1):**

**1. Security Feature Gaps by Firewall**
- One Markdown table with columns: **Firewall Name** | **Feature Lacking / Partial** | **Where Lacking**
- One data row per gap (firewall name, feature lacking, where). If no gaps: one row "| — | No gaps identified | — |". Complete the table immediately; no placeholders.

**2. Control → Evidence Mapping Tables**
- For each framework (GDPR, Cyber Essentials / CE+, NCSC Guidelines, DfE / KCSIE, etc. as selected), output the subheading "Framework: [Framework Name]" then a Markdown table with columns:
  | Control ID | Control Description | Status | Firewall(s) Lacking / What Is Missing | Evidence | Example of non-compliance | Notes |
- Status values: ✅ Met | ⚠️ Partial | ❌ Not Met | N/A. Fill all columns; use "—" where not applicable.

**3. Not Applicable Justifications**
- Short paragraph or list explaining any controls marked N/A. If none, state "No controls were marked as N/A as all assessed controls were relevant to the provided configuration data and the selected compliance frameworks."

**4. Residual Risk Statements**
- One Markdown table: | Risk ID | Description | Affected Firewalls | Affected Controls | Severity | Recommended Mitigation |

**5. Summary of Findings**
- "Total Controls Assessed per Framework:" then a short list (e.g. "GDPR: 4", "Cyber Essentials / CE+: 5", …).
- "Control Status Counts:" then ✅ Met, ⚠️ Partial, ❌ Not Met, N/A counts.
- "Per-firewall Security Feature Summary ([firewall name]):" for each firewall — bullet list of missing/partial features.
- "Per-firewall SSL/TLS and DPI ([firewall name]):" for each firewall — SSL/TLS settings, DPI usage, DPI gaps and recommendation if any.
- "Overall Compliance Posture:" one paragraph stating Partial or Met and which firewall(s) lack what.

**6. Best Practice Recommendations**
- Numbered subsections 6.1, 6.2, 6.3, … each with a title, "Recommendation:", "Justification:" and where relevant "Specific Rules:", "Specific Servers:", or "Current SSL/TLS Settings:". Cover MFA, Logging, IPS, Wireless Security, Authentication Server Security, SSL/TLS DPI, Web Filtering Scope, and any other gaps identified.

Rules
- Use ONLY the actual configuration data provided — never invent details
- **Level of detail**: Suitable for compliance — document SSL/TLS settings, DPI usage, and all evidence with enough detail for auditors
- Quote specific rule names, IP ranges, zones, and policy names as evidence
- **SSL/TLS and DPI**: In evidence and control mapping, state whether each firewall uses DPI **for rules with Destination Zone = WAN and Service HTTP, HTTPS, or ANY**. Document SSL/TLS settings where present. Only for rules whose destination is WAN and service is web-related (HTTP, HTTPS, ANY): if a firewall has no DPI on those rules, recommend enabling DPI and note it in "Firewall(s) Lacking / What Is Missing" or Notes. Do not mention Web proxy — focus on DPI only.
- **Security features (MFA, OTP, 2FA, etc.)**: If **any** firewall does not have the feature enabled in **all** relevant areas (e.g. VPN, Web Admin, SSL-VPN, IPsec), mark the control **⚠️ Partial**. In Notes/Evidence and in "Firewall(s) Lacking / What Is Missing", state **which firewall** and **what** is lacking (e.g. "Firewall A — MFA not enabled for SSL-VPN and Web Admin").
- When citing firewall rules, include **Web Filter** where the data provides it. Apply the web filter scope rule from Shared Assessment Rules (only WAN-destined web services matter for compliance).
- **Logging / monitoring**: For any control that relates to monitoring, logging, or audit trail (e.g. "enable logging", "log traffic", "audit", "monitoring"), **fail that control (❌ Not Met)** if the config shows one or more firewall rules with logging disabled (e.g. "Log" off, "Logging" disabled, or no log option enabled). Note which rule(s) and which firewall(s) have logging off in Evidence/Notes.
- Be specific about which rules/settings satisfy which controls
- If data is insufficient to assess a control, mark as "⚠️ Partial — Insufficient evidence in config export"
- Format for direct use as an audit appendix — professional, factual, no narrative fluff
- Every claim must be traceable to config data
- **Evidence format**: In configuration excerpts and evidence, never output raw JSON. Use Markdown tables (with columns such as Name, Port, VLAN, Zone, IP/Network, Status for interface/VLAN data) and short prose so auditors see clear, readable evidence. Include **Port** and **VLAN** (or VLAN ID) in interface/VLAN tables when the payload contains that data.
- **No placeholders**: Never write "Still generating...", "Loading...", "Generating...", or any placeholder in the report. Every section (including **Security Feature Gaps by Firewall**) must contain actual content: complete table header and data rows, or state "No gaps identified" or "—" if there are none. Do not leave tables empty or with loading text. Output the full report in one pass.`;

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
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const adminClient = SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

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

    if (chat) {
      systemPrompt = CHAT_SYSTEM_PROMPT;
      userMessage = chatContext!;
    } else {
      // Compact payload: no pretty-print (saves tokens), strip empty fields
      const compactSections = pruneEmpty(sections) as Record<string, unknown>;
      const payload = JSON.stringify(compactSections);

      // Build compliance context
      let complianceContext = "";
      const isIndividualReport = !chat && !executive && !compliance;
      const singleFirewallName = isIndividualReport && firewallLabels && firewallLabels.length === 1 ? firewallLabels[0] : null;
      const reportDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      if (singleFirewallName) {
        complianceContext += `\n\n## Individual report: required opening layout (output exactly in this order)\nThe cover block (title, date, prepared by, disclaimer) is prepended by the system. You output the report body only. Start your response with the following lines exactly:\n\nSophos XGS Firewall Configuration Report for ${singleFirewallName}\nAssessment Date: ${reportDate}\n\nScope: This report documents the Sophos XGS firewall configuration for ${singleFirewallName}.\n\nCompliance Context:\n`;
        if (environment && environment.trim()) complianceContext += `Environment type: ${environment.trim()}\n`;
        if (country && country.trim()) complianceContext += `Country: ${country.trim()}\n`;
        if (selectedFrameworks && selectedFrameworks.length > 0) {
          complianceContext += `Selected Compliance Frameworks:\n`;
          selectedFrameworks.forEach((fw) => { complianceContext += `${fw}\n`; });
        }
        complianceContext += `\nExecutive Summary\n`;
        complianceContext += `(Then write your Executive Summary paragraph. Then output these sections in this order, each with section heading, intro, table if applicable, "Summary of [Section Name]", Findings, Best Practice Recommendations: Firewall Rules; Interfaces, Ports & VLANs; Zones; Interface Aliases; NAT Rules; Authentication Servers; Azure AD SSO; Authentication & OTP Settings; Advanced Threat Protection; Intrusion Prevention; IPS Engine Settings; Hotfix Settings; RED Devices; XFRM Interfaces; Wireless Networks; Wireless Access Points; Wireless Settings; Content Condition List; SSL/TLS Inspection Rules; SSL/TLS Settings; Admin Settings; Backup & Restore. End with ## Overall Security Recommendations for ${singleFirewallName}.)\n`;
      } else if (customerName && customerName.trim() && !/^\(this tenant\)$/i.test(customerName.trim())) {
        complianceContext += `\n\n## Client Context\nThis report is for **${customerName}**. Use this exact customer name throughout the document (Scope, Executive Summary, Overall Security Recommendations, Frameworks to Assess). Do not use "(This tenant)" or any placeholder — use **${customerName}** only.\n`;
      } else {
        complianceContext += `\n\n## Client Context\nDo not use "(This tenant)" or a placeholder in the report. Use "the assessed organisation" or the firewall name(s) from the data in Scope and body text.\n`;
      }

      if (!singleFirewallName) {
        complianceContext += `\n\n## Report date\nUse **${reportDate}** as the assessment date in the document header and in the Scope line.\n`;
        const scopeFirewalls = firewallLabels && firewallLabels.length > 0 ? firewallLabels.join(", ") : "firewall(s)";
        const scopeTenant = (customerName && customerName.trim() && !/^\(this tenant\)$/i.test(customerName.trim())) ? customerName.trim() : "(This tenant)";
        const scopeEnv = environment && environment.trim() ? `${environment.trim()} Environment` : "";
        const scopeCountry = country && country.trim() ? country.trim() : "";
        const scopeRest = [scopeEnv, scopeCountry].filter(Boolean).join(", ");
        complianceContext += `\n\n## Scope line (output exactly)\nAfter the title "Compliance Readiness Report — Firewall Configuration Assessment", output this exact line (one line):\nDate: ${reportDate} Scope: ${scopeFirewalls} (${scopeTenant})${scopeRest ? ", " + scopeRest : ""}\n`;

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
      } else if (selectedFrameworks && selectedFrameworks.length > 0) {
        complianceContext += `\n\n## Frameworks for individual report\nTailor "Best Practice Recommendations" and "Overall Security Recommendations for ${singleFirewallName}" to the selected frameworks: ${selectedFrameworks.join(", ")}.\n`;
      }

      if (centralEnrichment && Object.keys(centralEnrichment).length > 0) {
        complianceContext += "\n\n## Sophos Central Live Data\nThe following live data was retrieved from Sophos Central API. Include a brief **Sophos Central Status** (firmware, connected state; omit HA). Mention the alert count in one sentence only (e.g. \"Central reports N open alerts; see Sophos Central for details\"). Do **not** list individual alerts. Do **not** create any Finding (Critical/High/Medium/Low) based on alert count; do not cite NCSC/Cyber Essentials/KCSIE for alert count. Alert count is informational only.\n";
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
      systemPrompt = basePrompt + SHARED_RULES + complianceContext;

      if (compliance && firewallLabels && firewallLabels.length > 1) {
        userMessage = `Here are the extracted configurations for ${firewallLabels.length} firewalls (${firewallLabels.join(", ")}). Produce a comprehensive Compliance Readiness Report covering all firewalls:\n\n${payload}`;
      } else if (compliance) {
        userMessage = `Here is the extracted Sophos firewall configuration data. Produce a comprehensive Compliance Readiness Report:\n\n${payload}`;
      } else if (executive && firewallLabels) {
        userMessage = firewallLabels.length === 1
          ? `Here is the extracted configuration for firewall "${firewallLabels[0]}". Produce an executive summary report:\n\n${payload}`
          : `Here are the extracted configurations for ${firewallLabels.length} firewalls (${firewallLabels.join(", ")}). Produce a consolidated executive summary report:\n\n${payload}`;
      } else {
        userMessage = "Here is the extracted Sophos firewall configuration data. Document every section completely. Use every column from each table except do not include Security Features in the firewall rules table; if a section has a 'details' or 'detail blocks' array, merge Web Filter and Logging into your rule table only.\n\n" + payload;
      }
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

    const reportModel = Deno.env.get("GEMINI_REPORT_MODEL") || "gemini-2.5-flash";
    const chatModel = Deno.env.get("GEMINI_CHAT_MODEL") || "gemini-2.5-flash-lite";
    const model = chat ? chatModel : reportModel;

    const reasoningOverride = Deno.env.get("GEMINI_REASONING_EFFORT");
    const reasoningEffort = reasoningOverride
      || (chat ? "none" : (compliance || executive) ? "medium" : "low");

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
          reasoning_effort: reasoningEffort,
          stream_options: { include_usage: true },
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
      if (response.status === 403 || /quota|resource exhausted|billing/i.test(message)) {
        return new Response(
          JSON.stringify({
            error: "AI quota unavailable. The Google project used for reports has hit its limit or billing isn’t set up. In Google AI Studio or Cloud Console, check the project that owns GEMINI_API_KEY: enable billing, increase quotas, or switch to a project with available Gemini API access.",
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    const decoder = new TextDecoder();
    let buffer = "";
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(immediateChunk);
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newlineIdx: number;
            while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newlineIdx).trim();
              buffer = buffer.slice(newlineIdx + 1);
              if (line.startsWith("data: ") && line !== "data: [DONE]") {
                try {
                  const json = JSON.parse(line.slice(6)) as Record<string, unknown>;
                  // OpenAI-style usage (openai/completions stream)
                  const usage = json.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
                  // Gemini native style (usage_metadata in last chunk)
                  const meta = json.usage_metadata as { prompt_token_count?: number; candidates_token_count?: number; total_token_count?: number } | undefined;
                  const promptTokens = usage?.prompt_tokens ?? meta?.prompt_token_count;
                  const completionTokens = usage?.completion_tokens ?? meta?.candidates_token_count;
                  const totalFromUsage = usage?.total_tokens;
                  const totalFromMeta = meta?.total_token_count;
                  const total = totalFromUsage ?? totalFromMeta ?? (promptTokens != null || completionTokens != null ? (promptTokens ?? 0) + (completionTokens ?? 0) : 0);
                  if (total > 0) {
                    console.log(`parse-config token usage: prompt=${promptTokens ?? "-"} completion=${completionTokens ?? "-"} total=${total} (model=${model} chat=${chat})`);
                    if (adminClient) {
                      adminClient.from("gemini_usage").insert({
                        total_tokens: total,
                        prompt_tokens: promptTokens ?? null,
                        completion_tokens: completionTokens ?? null,
                        model,
                        is_chat: chat,
                      }).then(() => {}).catch((err) => console.warn("[parse-config] gemini_usage insert failed:", err.message));
                    }
                    const FREE_TIER_TPM = 250_000;
                    if (total >= FREE_TIER_TPM) {
                      console.warn(`parse-config: single request used ${total} tokens (>= ${FREE_TIER_TPM} TPM free tier). Check gemini_usage table for per-minute totals.`);
                    }
                  }
                } catch (_) {
                  /* ignore parse errors for non-usage lines */
                }
              }
            }
            controller.enqueue(value);
          }
        } finally {
          reader.releaseLock();
          // Send explicit [DONE] so the client clears "Still generating..." and calls onDone()
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n"));
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
