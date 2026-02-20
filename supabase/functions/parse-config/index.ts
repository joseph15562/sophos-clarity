import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.49/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OUTPUT_KEYS = [
  "Firewall Rules",
  "SSL/TLS Inspection Rules",
  "NAT Rules",
  "AdminSettings",
  "AdministrationProfile",
  "Notification",
  "BackupRestore",
  "AzureADSSO",
  "RED",
  "DNS",
  "SSLVPNPolicy",
  "TunnelPolicy",
  "User",
  "DecryptionProfile",
  "GatewayConfiguration",
  "Gateway",
  "ATP",
  "ThirdPartyFeed",
  "MalwareProtection",
  "HAConfigure",
  "Time",
  "Interfaces & Network",
  "Web Filter Policies",
  "Schedules",
  "IPS Policies",
  "Zones",
  "RED Devices",
  "Wireless Access Points",
] as const;

type OutputKey = typeof OUTPUT_KEYS[number];

function tableToTsv(tableEl: any): string {
  const rows = Array.from(tableEl.querySelectorAll("tr"));
  const out: string[] = [];

  for (const tr of rows) {
    const cells = Array.from(tr.querySelectorAll("th,td")).map((c: any) =>
      (c.textContent ?? "").replace(/\s+/g, " ").trim()
    );
    if (cells.some((x) => x)) out.push(cells.join("\t"));
  }
  return out.join("\n");
}

function ensureAllKeys(sections: Record<string, string>) {
  for (const k of OUTPUT_KEYS) {
    if (!(k in sections)) sections[k] = "";
  }
  return sections;
}

/**
 * Sophos Config Viewer exports have stable section containers like:
 *  - <div id="firewall-rules">
 *  - <div id="section-content-firewall-rules"> ... <table> ... </table>
 *
 * We use those IDs directly to extract tables and text.
 */
function extractSection(doc: any, sectionIdBase: string): { tsv?: string; text?: string } {
  const content = doc.querySelector(`#section-content-${sectionIdBase}`);
  if (!content) return {};

  const table = content.querySelector("table");
  const tsv = table ? tableToTsv(table) : "";

  // Also capture plain text inside the section (for non-table settings)
  const text = (content.textContent ?? "").replace(/\s+/g, " ").trim();

  return {
    tsv: tsv || undefined,
    text: text || undefined,
  };
}

function extractRelevant(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sections: Record<string, string> = ensureAllKeys({});

  if (!doc) {
    return {
      diagnostics: { chars: html.length, parsed: false },
      sections,
    };
  }

  // Map your required output keys to Sophos section IDs
  // These IDs are based on what Sophos uses in exports (e.g., firewall-rules)
  const map: Array<{ key: OutputKey; id: string }> = [
    { key: "Firewall Rules", id: "firewall-rules" },
    { key: "SSL/TLS Inspection Rules", id: "ssl-tls-inspection-rules" },
    { key: "NAT Rules", id: "nat-rules" },

    { key: "DNS", id: "dns" },
    { key: "Time", id: "time" },

    { key: "Interfaces & Network", id: "interfaces" },
    { key: "Zones", id: "zones" },
    { key: "Schedules", id: "schedules" },

    { key: "Web Filter Policies", id: "web-filter-policies" },
    { key: "IPS Policies", id: "ips-policies" },

    { key: "RED Devices", id: "red-devices" },
    { key: "Wireless Access Points", id: "wireless-access-points" },

    // The rest may or may not exist as explicit sections in the export.
    // We still try to extract by likely IDs; if not present they'll remain empty.
    { key: "AdminSettings", id: "admin-settings" },
    { key: "AdministrationProfile", id: "administration-profile" },
    { key: "Notification", id: "notification" },
    { key: "BackupRestore", id: "backup-restore" },
    { key: "AzureADSSO", id: "azuread-sso" },
    { key: "RED", id: "red" },
    { key: "SSLVPNPolicy", id: "ssl-vpn-policy" },
    { key: "TunnelPolicy", id: "tunnel-policy" },
    { key: "User", id: "users" },
    { key: "DecryptionProfile", id: "decryption-profile" },
    { key: "GatewayConfiguration", id: "gateway-configuration" },
    { key: "Gateway", id: "gateway" },
    { key: "ATP", id: "atp" },
    { key: "ThirdPartyFeed", id: "third-party-feed" },
    { key: "MalwareProtection", id: "malware-protection" },
    { key: "HAConfigure", id: "ha-configure" },
  ];

  let foundSections = 0;
  let foundTables = 0;

  for (const m of map) {
    const extracted = extractSection(doc, m.id);

    // Prefer TSV if table exists, else fallback to text
    if (extracted.tsv) {
      sections[m.key] = extracted.tsv.slice(0, 120_000);
      foundSections++;
      foundTables++;
    } else if (extracted.text) {
      sections[m.key] = extracted.text.slice(0, 120_000);
      foundSections++;
    }
  }

  // Extra hard-target for firewall rules (your screenshot proves this exists)
  const fwTable = doc.querySelector("#section-content-firewall-rules table");
  if (fwTable) {
    sections["Firewall Rules"] = tableToTsv(fwTable).slice(0, 200_000);
    foundTables++;
  }

  const natTable = doc.querySelector("#section-content-nat-rules table");
  if (natTable) {
    sections["NAT Rules"] = tableToTsv(natTable).slice(0, 200_000);
    foundTables++;
  }

  const sslTable = doc.querySelector("#section-content-ssl-tls-inspection-rules table");
  if (sslTable) {
    sections["SSL/TLS Inspection Rules"] = tableToTsv(sslTable).slice(0, 200_000);
    foundTables++;
  }

  return {
    diagnostics: {
      chars: html.length,
      parsed: true,
      foundSections,
      foundTables,
      firewallRulesChars: sections["Firewall Rules"]?.length ?? 0,
      natRulesChars: sections["NAT Rules"]?.length ?? 0,
    },
    sections,
  };
}

const SYSTEM_PROMPT =
  "You are a strict data transformer.\n" +
  "Return ONLY valid JSON.\n" +
  "Do NOT write summaries.\n" +
  "Do NOT describe the firewall.\n" +
  "Do NOT infer or guess anything.\n\n" +
  "Top-level keys MUST be exactly:\n" +
  OUTPUT_KEYS.join(", ") +
  ".\n\n" +
  "Rules:\n" +
  "- Use ONLY the extracted input.\n" +
  "- If a key has no data, output: [{\"status\":\"Not present in export\"}].\n" +
  "- Convert TSV tables into structured arrays of objects.\n" +
  "- For Firewall Rules include ALL rules including Drop/Reject.\n" +
  "- Output JSON only. No Markdown. No explanation.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const htmlContent = body?.htmlContent;

    if (!htmlContent || typeof htmlContent !== "string") {
      return new Response(JSON.stringify({ error: "Missing htmlContent field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = extractRelevant(htmlContent);

    // Debug mode without AI credits: add ?debug=1 to function URL
    const url = new URL(req.url);
    if (url.searchParams.get("debug") === "1") {
      return new Response(JSON.stringify(extracted), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const payload = JSON.stringify(extracted, null, 2);

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
          { role: "user", content: "Extracted Sophos data:\n\n" + payload },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("parse-config error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});