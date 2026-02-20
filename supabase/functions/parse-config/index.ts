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

const SECTION_KEYWORDS: Record<string, string[]> = {
  "Firewall Rules": ["firewall rules", "firewall rule", "rule name", "source", "destination", "services"],
  "SSL/TLS Inspection Rules": ["ssl/tls inspection rules", "ssl tls inspection rules", "tls inspection", "ssl inspection"],
  "NAT Rules": ["nat rules", "dnat", "snat", "masquerading", "translated destination", "translated source"],
  "AdminSettings": ["admin settings", "administration settings", "device access"],
  "AdministrationProfile": ["administration profile", "admin profile", "roles", "permissions"],
  "Notification": ["notification", "alerts", "email", "smtp", "snmp"],
  "BackupRestore": ["backup", "restore", "export", "import"],
  "AzureADSSO": ["azure ad sso", "azuread", "sso", "entra"],
  "RED": ["sd-red", "remote ethernet device", "red"],
  "DNS": ["dns", "name resolution", "dns server"],
  "SSLVPNPolicy": ["ssl vpn", "sslvpn policy", "ssl vpn settings"],
  "TunnelPolicy": ["tunnel policy", "ipsec policy", "ike", "phase 1", "phase 2"],
  "User": ["user", "users", "authentication", "directory service", "ldap", "active directory"],
  "DecryptionProfile": ["decryption profile", "decryption", "tls decryption"],
  "GatewayConfiguration": ["gateway configuration", "ipsec settings", "vpn settings"],
  "Gateway": ["gateway", "vpn gateway", "ipsec gateway"],
  "ATP": ["atp", "advanced threat", "threat protection"],
  "ThirdPartyFeed": ["third party feed", "threat feed", "external feed", "feeds"],
  "MalwareProtection": ["malware protection", "anti-malware", "av", "antivirus"],
  "HAConfigure": ["high availability", "ha", "failover"],
  "Time": ["time", "ntp", "timezone", "date and time"],
  "Interfaces & Network": ["network interfaces", "interfaces", "ip address", "subnet mask", "gateway", "zone"],
  "Web Filter Policies": ["web filter policies", "web filter", "web filtering", "category", "policy"],
  "Schedules": ["schedule", "time schedule"],
  "IPS Policies": ["ips policies", "intrusion prevention", "ips"],
  "Zones": ["zones", "zone"],
  "RED Devices": ["red devices", "sd-red devices"],
  "Wireless Access Points": ["wireless access points", "wireless", "access point", "ssid", "wlan"],
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

function ensureAllKeys(sections: Record<string, string>) {
  for (const k of OUTPUT_KEYS) {
    if (!(k in sections)) sections[k] = "";
  }
  return sections;
}

function routeByKeywords(text: string, buckets: Record<string, string[]>) {
  const t = norm(text);
  for (const [section, kws] of Object.entries(SECTION_KEYWORDS)) {
    if (kws.some((kw) => t.includes(kw))) {
      buckets[section].push(text);
    }
  }
}

function extractRelevant(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    const blank: Record<string, string> = ensureAllKeys({});
    return { diagnostics: { chars: html.length, tables: 0, textLen: 0 }, sections: blank };
  }

  const buckets: Record<string, string[]> = {};
  for (const k of OUTPUT_KEYS) buckets[k] = [];

  // 1) TABLES (if any exist)
  const tables = Array.from(doc.querySelectorAll("table"));
  for (const table of tables) {
    const tsv = tableToTsv(table);
    if (!tsv) continue;

    const headerSample = Array.from(table.querySelectorAll("th,td"))
      .slice(0, 30)
      .map((x: any) => (x.textContent ?? "").toLowerCase())
      .join(" ");

    // classify common ones
    if (headerSample.includes("rule name") && headerSample.includes("source") && headerSample.includes("destination")) {
      buckets["Firewall Rules"].push(tsv);
      continue;
    }
    if (headerSample.includes("original") && headerSample.includes("translated")) {
      buckets["NAT Rules"].push(tsv);
      continue;
    }
    if (headerSample.includes("ip address") && headerSample.includes("zone")) {
      buckets["Interfaces & Network"].push(tsv);
      continue;
    }
    if (headerSample.includes("ssl") && headerSample.includes("inspection")) {
      buckets["SSL/TLS Inspection Rules"].push(tsv);
      continue;
    }

    // otherwise route by keyword hits
    routeByKeywords(headerSample + "\n" + tsv, buckets);
  }

  // 2) “DIV GRID” RULE ROWS (captures Accept/Drop/etc including blocked)
  // We can’t rely on HTML structure, so we scan element text for row-like patterns.
  const allEls = Array.from(doc.querySelectorAll("div, li, tr, section, article"));
  for (const el of allEls) {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length < 25) continue;

    // rule rows usually start with a number and contain an action
    const hasRuleNumber = /^\d+\s+/.test(text);
    const hasAction = /\b(Accept|Drop|Reject|Block|Deny)\b/i.test(text);

    if (hasRuleNumber && hasAction) {
      buckets["Firewall Rules"].push(text);
      continue;
    }

    // NAT detail cards often contain translated/original labels
    if (/translated destination|translated source|original destination|original source/i.test(text)) {
      buckets["NAT Rules"].push(text);
      continue;
    }

    // interface cards commonly contain IP/Zone labels
    if (/ip address/i.test(text) && /zone/i.test(text) && (text.includes("Port") || text.includes("Interface"))) {
      buckets["Interfaces & Network"].push(text);
      continue;
    }
  }

  // 3) Global text routing (cheap fallback)
  const fullText = (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
  // split into big chunks so we don’t dump 13MB into one bucket
  const chunkSize = 40_000;
  for (let i = 0; i < fullText.length; i += chunkSize) {
    const chunk = fullText.slice(i, i + chunkSize);
    routeByKeywords(chunk, buckets);
  }

  // Cap each section so token usage is controlled
  const sections: Record<string, string> = {};
  for (const k of OUTPUT_KEYS) {
    const joined = buckets[k].join("\n\n---\n\n");
    sections[k] = joined.slice(0, 80_000);
  }

  ensureAllKeys(sections);

  return {
    diagnostics: {
      chars: html.length,
      tables: tables.length,
      textLen: fullText.length,
      firewallRuleSnippets: buckets["Firewall Rules"].length,
      natSnippets: buckets["NAT Rules"].length,
    },
    sections,
  };
}

const SYSTEM_PROMPT =
  "You are a strict Sophos Config Viewer extractor.\n" +
  "Return ONLY valid JSON.\n" +
  "Top-level keys MUST be exactly:\n" +
  OUTPUT_KEYS.join(", ") +
  ".\n\n" +
  "Rules:\n" +
  "- Use ONLY the extracted input provided by the user.\n" +
  "- Do NOT invent values.\n" +
  '- If a key has no data, output: [{"status":"Not present in export"}].\n' +
  '- Every object MUST include "source" (which section and a short evidence snippet).\n' +
  "- For Firewall Rules: include BOTH allowed and blocked rules. A rule is blocked if action is Drop/Reject/Block/Deny.\n" +
  "- Output JSON only. No Markdown. No summaries.";

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