import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.49/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECTION_KEYWORDS: Record<string, string[]> = {
  "Firewall Rules": ["firewall rule", "rule #", "user/network rules", "rules"],
  "SSL/TLS Inspection Rules": ["ssl/tls inspection", "tls inspection", "ssl inspection"],
  "NAT Rules": ["nat", "snat", "dnat", "masquerading"],
  "AdminSettings": ["admin settings", "administration settings", "device access"],
  "AdministrationProfile": ["administration profile", "admin profile", "roles", "permissions"],
  "Notification": ["notification", "alerts", "email", "smtp", "snmp"],
  "BackupRestore": ["backup", "restore", "export", "import"],
  "AzureADSSO": ["azure ad sso", "azuread", "sso", "entra"],
  "RED": ["sd-red", "remote ethernet device", "red"],
  "DNS": ["dns", "name resolution"],
  "SSLVPNPolicy": ["ssl vpn", "sslvpn policy", "ssl vpn settings"],
  "TunnelPolicy": ["tunnel policy", "ipsec policy", "ike", "phase 1", "phase 2"],
  "User": ["user", "users", "authentication", "directory service", "ldap", "active directory"],
  "DecryptionProfile": ["decryption profile", "decryption", "tls decryption"],
  "GatewayConfiguration": ["gateway configuration", "ipsec settings", "vpn settings"],
  "Gateway": ["gateway", "vpn gateway", "ipsec gateway"],
  "ATP": ["atp", "advanced threat", "threat protection"],
  "ThirdPartyFeed": ["third party feed", "threat feed", "external feed", "feeds"],
  "MalwareProtection": ["malware protection", "anti-malware", "av"],
  "HAConfigure": ["high availability", "ha", "failover"],
  "Time": ["time", "ntp", "timezone", "date and time"],
  "Interfaces & Network": ["interface", "interfaces", "network", "ip address", "routing", "static route"],
  "Web Filter Policies": ["web filter", "web filtering", "category", "policy"],
  "Schedules": ["schedule", "time schedule"],
  "IPS Policies": ["ips", "intrusion prevention", "policy"],
  "Zones": ["zone", "zones"],
  "RED Devices": ["red devices", "sd-red devices"],
  "Wireless Access Points": ["wireless", "access point", "ssid", "wlan"],
};

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

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

function extractRelevant(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    return { diagnostics: { chars: html.length, headings: 0, tables: 0 }, sections: {} as Record<string, string> };
  }

  const allTables = Array.from(doc.querySelectorAll("table"));
  const allHeadings = Array.from(doc.querySelectorAll("h1,h2,h3"));

  const sections: Record<string, string[]> = {};
  for (const key of Object.keys(SECTION_KEYWORDS)) sections[key] = [];

  for (const h of allHeadings) {
    const title = norm(h.textContent ?? "");
    if (!title) continue;

    let matchedKey: string | null = null;
    for (const [key, kws] of Object.entries(SECTION_KEYWORDS)) {
      if (kws.some((k) => title.includes(k))) {
        matchedKey = key;
        break;
      }
    }
    if (!matchedKey) continue;

    // Grab any tables until the next heading
    let el: any = h.nextElementSibling;
    while (el && !/H1|H2|H3/.test(el.tagName)) {
      if (el.tagName === "TABLE") {
        const tsv = tableToTsv(el);
        if (tsv) sections[matchedKey].push("Heading: " + (h.textContent ?? "") + "\n" + tsv);
      }
      el = el.nextElementSibling;
    }
  }

  const capped: Record<string, string> = {};
  for (const [k, arr] of Object.entries(sections)) {
    capped[k] = arr.join("\n\n---\n\n").slice(0, 80_000);
  }

  return {
    diagnostics: {
      chars: html.length,
      headings: allHeadings.length,
      tables: allTables.length,
    },
    sections: capped,
  };
}

const SYSTEM_PROMPT =
  "Return ONLY valid JSON.\n" +
  "Top-level keys MUST be exactly:\n" +
  "Firewall Rules, SSL/TLS Inspection Rules, NAT Rules, AdminSettings, AdministrationProfile, Notification, BackupRestore, AzureADSSO, RED, DNS, SSLVPNPolicy, TunnelPolicy, User, DecryptionProfile, GatewayConfiguration, Gateway, ATP, ThirdPartyFeed, MalwareProtection, HAConfigure, Time, Interfaces & Network, Web Filter Policies, Schedules, IPS Policies, Zones, RED Devices, Wireless Access Points.\n\n" +
  "Rules:\n" +
  "- Use ONLY the extracted input provided by the user.\n" +
  "- Do NOT invent values.\n" +
  '- If no data exists for a key, output: [{"status":"Not present in export"}].\n' +
  '- Every object MUST include "source".\n' +
  "- Output JSON only. No Markdown.";

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
    const payload = JSON.stringify(extracted, null, 2);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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