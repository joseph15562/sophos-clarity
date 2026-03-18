import type { ExtractedSections } from "./extract-sections";
import { buildAnonymisationMap, anonymiseData, anonymiseString, createStreamDeanonymiser } from "./anonymise";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sections the AI prompt tells Gemini to ignore. Stripping them client-side
 * before sending saves 30-50% of input tokens on a typical config.
 */
const OMITTED_SECTIONS: Set<string> = new Set([
  "dhcp", "dhcp servers", "dhcpbinding", "clidhcp",
  "waf tls settings", "arpflux", "authcta", "fqdn hosts",
  "qos policies", "cellular wan", "gateway hosts", "high availability",
  "network groups", "letsencrypt", "parent proxy", "parentproxy", "qos settings", "qossettings",
  "waf slow http", "antivirus ftp", "country groups", "anti-spam rules",
  "fqdn host groups", "fqdnhostgroups", "filetype", "schedules",
  "services", "webproxy", "admin profiles", "adminprofiles",
  "web filters", "web filter categories", "web filter url groups",
  "web filter exceptions", "webfiltersettings", "webfilterexceptions",
  "web filter settings", "zero day protection", "malware protection",
  "antivirushttpsconfiguration", "antivirusmailsmtpscanningrules",
  "antivirushttpsscanningexceptions", "pop/imap scanning",
  "pop/imap scanning policy", "dns request routes",
  "application control policies", "web filtering policies",
  "admin accounts and profiles", "user groups", "application objects",
  "sd-wan routes", "api & service accounts", "snmp community",
  "syslog servers", "syslogservers", "system services",
  "overridepolicy", "datamanagement", "httpproxy",
  "networks", "networks (hosts)", "hosts",
  "web filtering / inspection method", "default captive portal",
  "sophos connect client", "decryption profiles",
  "application filter policies", "application classification",
  "application filter categories", "email protection", "email scanning",
  "smtp scanning", "anti-spam", "firewall rule groups", "user activity",
  "service groups", "ssl vpn policies", "spx templates", "notifications", "notification list", "notificationlist",
  "user portal authentication", "vpnconnremoveonfailover",
  "vpnconnremovetunnelup", "ssl vpn authentication",
  "mta spx configuration", "advanced smtp setting", "spoof prevention",
  "route precedence", "mta spx templates", "mta address group",
  "local service acl", "ips full signature pack", "gateway configuration",
  "virtual host failover notification",
  "default web filter notification settings", "web authentication",
  "voucher definition", "smarthost settings", "pptp configuration",
  "snmp agent config", "multicast configuration",
  "firewall authentication", "ssl vpn tunnel access",
  "red configuration",
  "virus scanning", "virusscanning",
  "smsgateway", "vpn profiles", "vpnprofiles",
  "antivirusftp", "spxtemplates", "relaysettings", "groups",
  "support access", "supportaccess", "system modules", "systemmodules",
  "third-party feeds", "thirdpartyfeeds", "fqdnhostsetting",
  "mtaaddressgroup", "mtaspxtemplates", "patterndownload", "routeprecedence",
  "arpconfiguration", "avasaddressgroup",
  "access time policies", "accesstimepolicies", "dkimverification",
  "protocol security", "protocolsecurity", "spxconfiguration",
  "pimdynamicrouting", "pptpconfiguration", "smarthostsettings",
  "vpn authentication", "vpnauthentication", "voucherdefinition",
  "bookmarkmanagement", "chromebookssologin",
  "data transfer policies", "datatransferpolicies", "dhcpleaseoveripsec",
  "emailconfiguration", "mtadatacontrollist",
  "surfing quota policies", "surfingquotapolicies", "ipsec vpn connections", "ipsecvpnconnections",
  "advancedsmtpsetting", "mtaspxconfiguration", "ipsfullsignaturepack",
  "reverseauthentication", "multicastconfiguration",
  "vpnportalauthentication", "userportalauthentication",
  "antivirushttpscanningrule", "web filter advanced settings", "webfilteradvancedsettings",
  "varpartitionusagewatermark", "webfilterprotectionsettings",
  "directwebproxyauthentication", "webfilternotificationsettings",
  "virtualhostfailovernotification", "antispamquarantinedigestsettings",
  "defaultwebfilternotificationsettings", "applicationclassificationbatchassignment",
]);

function isOmittedSection(key: string): boolean {
  return OMITTED_SECTIONS.has(key.toLowerCase());
}

/**
 * Remove sections the AI prompt ignores, cutting payload size and token cost.
 * For executive/compliance reports the sections object is nested one level
 * deep (firewallLabel → ExtractedSections), so we recurse once.
 */
function stripOmittedSections(sections: ExtractedSections): ExtractedSections {
  const result: ExtractedSections = {};
  for (const [key, value] of Object.entries(sections)) {
    if (isOmittedSection(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value) && !("tables" in value)) {
      const nested = stripOmittedSections(value as unknown as ExtractedSections);
      if (Object.keys(nested).length > 0) {
        (result as Record<string, unknown>)[key] = nested;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

export type CentralEnrichment = {
  firmware?: string;
  model?: string;
  serialNumber?: string;
  connected?: boolean;
  haCluster?: { mode?: string; status?: string; peers?: number };
  licences?: Array<{ product: string; endDate: string; type: string }>;
  alerts?: Array<{ severity: string; description: string; category: string; raisedAt: string }>;
  mdrFeed?: Array<{ indicator: string; type: string }>;
};

type StreamOptions = {
  sections: ExtractedSections;
  environment?: string;
  country?: string;
  customerName?: string;
  selectedFrameworks?: string[];
  executive?: boolean;
  firewallLabels?: string[];
  compliance?: boolean;
  centralEnrichment?: CentralEnrichment;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onStatus?: (status: string) => void;
};

type ChatStreamOptions = {
  chatContext: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onStatus?: (status: string) => void;
};

/** Get Bearer token for Supabase edge functions: user JWT when signed in, else anon key. */
async function getAuthBearer(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  return import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
}

/** Parse error body safely when response may be JSON or HTML. */
async function parseErrorBody(resp: Response): Promise<{ error: string }> {
  const ct = resp.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = await resp.json();
      return typeof body?.error === "string" ? body : { error: `Error ${resp.status}` };
    } catch {
      return { error: `Error ${resp.status}` };
    }
  }
  if (resp.status === 401) return { error: "Please sign in to generate AI reports." };
  return { error: `Request failed (${resp.status}). If you're signed in, try refreshing the page.` };
}

/** Request backend debug info: what input the function received and what it will send to the AI (no Gemini call). */
export type ParseConfigDebugPayload = Pick<
  StreamOptions,
  "sections" | "environment" | "country" | "customerName" | "selectedFrameworks" | "executive" | "firewallLabels" | "compliance" | "centralEnrichment"
>;

export async function fetchParseConfigDebug(payload: ParseConfigDebugPayload): Promise<Record<string, unknown>> {
  const { sections, environment, country, customerName, selectedFrameworks, executive, firewallLabels, compliance, centralEnrichment } = payload;
  const stripped = stripOmittedSections(sections);
  const anonMap = buildAnonymisationMap(stripped, customerName, firewallLabels);
  const anonSections = anonymiseData(stripped, anonMap);
  const anonCustomerName = customerName ? anonymiseString(customerName, anonMap) : undefined;
  const anonLabels = firewallLabels?.map((l) => anonymiseString(l, anonMap));

  const token = await getAuthBearer();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-config`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      sections: anonSections,
      environment,
      country,
      customerName: anonCustomerName,
      selectedFrameworks,
      executive,
      firewallLabels: anonLabels,
      compliance,
      centralEnrichment,
      debug: true,
    }),
  });

  if (!resp.ok) {
    const err = await parseErrorBody(resp);
    throw new Error(err.error);
  }
  return resp.json() as Promise<Record<string, unknown>>;
}

export async function streamChat({ chatContext, onDelta, onDone, onError, onStatus }: ChatStreamOptions) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-config`;

  const timeoutMs = 60_000;
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs);

  onStatus?.("Sending request…");
  let resp: Response;
  try {
    const token = await getAuthBearer();
    resp = await fetch(url, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ chat: true, chatContext }),
    });
  } catch (e) {
    clearTimeout(timeoutId);
    onStatus?.("");
    const msg = e instanceof Error && e.name === "AbortError"
      ? "Request timed out — try again in a moment."
      : (e instanceof Error ? e.message : "Request failed");
    onError(msg);
    return;
  }
  clearTimeout(timeoutId);

  if (!resp.ok) {
    onStatus?.("");
    const body = await parseErrorBody(resp);
    onError(body.error);
    return;
  }

  if (!resp.body) {
    onStatus?.("");
    onError("No response body");
    return;
  }

  onStatus?.("Thinking…");
  await consumeSSEStream(resp.body, onDelta, onDone, onStatus);
}

export async function streamConfigParse({ sections, environment, country, customerName, selectedFrameworks, executive, firewallLabels, compliance, centralEnrichment, onDelta, onDone, onError, onStatus }: StreamOptions) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-config`;

  const stripped = stripOmittedSections(sections);

  const anonMap = buildAnonymisationMap(stripped, customerName, firewallLabels);
  const anonSections = anonymiseData(stripped, anonMap);
  const anonCustomerName = customerName ? anonymiseString(customerName, anonMap) : undefined;
  const anonLabels = firewallLabels?.map((l) => anonymiseString(l, anonMap));
  const deanon = createStreamDeanonymiser(anonMap);
  const reportType = compliance ? "compliance" : executive ? "executive" : "individual";

  // 8 minutes for large executive/compliance reports; Supabase may enforce a lower function limit
  const timeoutMs = 8 * 60 * 1000;
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs);

  onStatus?.("Sending request…");
  let resp: Response;
  try {
    const token = await getAuthBearer();
    resp = await fetch(url, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sections: anonSections, environment, country, customerName: anonCustomerName, selectedFrameworks, executive, firewallLabels: anonLabels, compliance, centralEnrichment, reportType }),
    });
  } catch (e) {
    clearTimeout(timeoutId);
    onStatus?.("");
    const msg = e instanceof Error && e.name === "AbortError"
      ? `Request timed out after ${timeoutMs / 60_000} minutes. Large or multi-firewall reports can take a long time. Try generating individual reports first, or use fewer configs and retry.`
      : (e instanceof Error ? e.message : "Request failed");
    onError(msg);
    return;
  }
  clearTimeout(timeoutId);

  if (!resp.ok) {
    onStatus?.("");
    const body = await parseErrorBody(resp);
    onError(body.error);
    return;
  }

  if (!resp.body) {
    onStatus?.("");
    onError("No response body");
    return;
  }

  onStatus?.("Waiting for response…");
  await consumeSSEStream(resp.body, (raw) => {
    const decoded = deanon.push(raw);
    if (decoded) onDelta(decoded);
  }, () => {
    const remaining = deanon.flush();
    if (remaining) onDelta(remaining);
    onStatus?.("");
    onDone();
  }, onStatus, onError);
}

const SSE_INACTIVITY_MS = 90_000; // If no new content for 90s after we've started receiving, treat stream as done so UI doesn't stay on "Still generating..."

const INACTIVITY_MESSAGE =
  "Generation stopped after 90 seconds with no new content. The report below may be partial — you can export it or retry.";

async function consumeSSEStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
  onDone: () => void,
  onStatus?: (status: string) => void,
  onError?: (error: string) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasReceivedContent = false;
  let inactivityDone = false;
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleInactivityTimeout() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      inactivityTimer = null;
      inactivityDone = true;
      reader.cancel();
      onStatus?.("");
      onError?.(INACTIVITY_MESSAGE);
      onDone();
    }, SSE_INACTIVITY_MS);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!hasReceivedContent) {
        hasReceivedContent = true;
        onStatus?.("Generating…");
      }
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          if (inactivityTimer) clearTimeout(inactivityTimer);
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            onDelta(content);
            scheduleInactivityTimeout();
          }
        } catch (err) {
          console.warn("[parseStreamChunk]", err);
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    if (buffer.trim()) {
      for (let raw of buffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch (err) {
          console.warn("[parseStreamChunk] fallback", err);
        }
      }
    }
  } catch (e) {
    if (!inactivityDone) {
      console.warn("[consumeSSEStream] stream read error", e);
      const msg = e instanceof Error ? e.message : "Stream read failed";
      onError?.(`Connection error: ${msg}. You can retry or export any partial report below.`);
    }
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (!inactivityDone) onDone();
  }
}
