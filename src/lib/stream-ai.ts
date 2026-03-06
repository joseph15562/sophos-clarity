import type { ExtractedSections } from "./extract-sections";

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
  /** Optional: progress text for diagnosis (e.g. "Sending request…", "Generating…") */
  onStatus?: (status: string) => void;
};

export async function streamConfigParse({ sections, environment, country, customerName, selectedFrameworks, executive, firewallLabels, compliance, onDelta, onDone, onError, onStatus }: StreamOptions) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-config`;

  const timeoutMs = 150_000; // 2.5 min — backend may retry 429 with ~60s waits
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
      body: JSON.stringify({ sections, environment, country, customerName, selectedFrameworks, executive, firewallLabels, compliance }),
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
  const reader = resp.body.getReader();
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
        onStatus?.("");
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

  // Flush remaining
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

  onStatus?.("");
  onDone();
}
