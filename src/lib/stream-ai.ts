import type { ExtractedSections } from "./extract-sections";
import { buildAnonymisationMap, anonymiseData, anonymiseString, createStreamDeanonymiser } from "./anonymise";

type StreamOptions = {
  sections: ExtractedSections;
  environment?: string;
  country?: string;
  customerName?: string;
  selectedFrameworks?: string[];
  executive?: boolean;
  firewallLabels?: string[];
  compliance?: boolean;
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

export async function streamChat({ chatContext, onDelta, onDone, onError, onStatus }: ChatStreamOptions) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-config`;

  const timeoutMs = 60_000;
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs);

  onStatus?.("Sending request…");
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
    const body = await resp.json().catch(() => ({ error: "Request failed" }));
    const msg = body.error || `Error ${resp.status}`;
    onError(msg);
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

export async function streamConfigParse({ sections, environment, country, customerName, selectedFrameworks, executive, firewallLabels, compliance, onDelta, onDone, onError, onStatus }: StreamOptions) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-config`;

  // Anonymise sensitive data before sending to cloud API
  const anonMap = buildAnonymisationMap(sections, customerName, firewallLabels);
  const anonSections = anonymiseData(sections, anonMap);
  const anonCustomerName = customerName ? anonymiseString(customerName, anonMap) : undefined;
  const anonLabels = firewallLabels?.map((l) => anonymiseString(l, anonMap));
  const deanon = createStreamDeanonymiser(anonMap);

  const timeoutMs = 150_000;
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs);

  onStatus?.("Sending request…");
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ sections: anonSections, environment, country, customerName: anonCustomerName, selectedFrameworks, executive, firewallLabels: anonLabels, compliance }),
    });
  } catch (e) {
    clearTimeout(timeoutId);
    onStatus?.("");
    const msg = e instanceof Error && e.name === "AbortError"
      ? "Request timed out. The executive summary may have hit API limits — try again in a minute or use fewer configs."
      : (e instanceof Error ? e.message : "Request failed");
    onError(msg);
    return;
  }
  clearTimeout(timeoutId);

  if (!resp.ok) {
    onStatus?.("");
    const body = await resp.json().catch(() => ({ error: "Request failed" }));
    const msg = body.error || `Error ${resp.status}`;
    onError(msg);
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
  }, onStatus);
}

async function consumeSSEStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
  onDone: () => void,
  onStatus?: (status: string) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasReceivedContent = false;

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
        onDone();
        return;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
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
      } catch { /* ignore */ }
    }
  }

  onDone();
}
