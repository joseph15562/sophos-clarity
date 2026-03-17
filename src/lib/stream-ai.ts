import type { ExtractedSections } from "./extract-sections";
import { buildAnonymisationMap, anonymiseData, anonymiseString, createStreamDeanonymiser } from "./anonymise";
import { supabase } from "@/integrations/supabase/client";

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
  const anonMap = buildAnonymisationMap(sections, customerName, firewallLabels);
  const anonSections = anonymiseData(sections, anonMap);
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

  // Anonymise sensitive data before sending to cloud API
  const anonMap = buildAnonymisationMap(sections, customerName, firewallLabels);
  const anonSections = anonymiseData(sections, anonMap);
  const anonCustomerName = customerName ? anonymiseString(customerName, anonMap) : undefined;
  const anonLabels = firewallLabels?.map((l) => anonymiseString(l, anonMap));
  const deanon = createStreamDeanonymiser(anonMap);

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
      body: JSON.stringify({ sections: anonSections, environment, country, customerName: anonCustomerName, selectedFrameworks, executive, firewallLabels: anonLabels, compliance, centralEnrichment }),
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
