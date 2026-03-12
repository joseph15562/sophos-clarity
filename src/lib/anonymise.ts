/**
 * Anonymises sensitive data (IPs, customer name, firewall labels) before
 * sending to cloud APIs, and de-anonymises the streamed response so the
 * final report contains the real values.
 *
 * The mapping table lives only in browser memory — never transmitted.
 */

export type AnonymisationMap = {
  forward: Map<string, string>; // real → placeholder
  reverse: Map<string, string>; // placeholder → real
};

const IP_RE = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;
const SKIP_IPS = new Set(["0.0.0.0", "255.255.255.255", "255.255.255.0", "127.0.0.1"]);

// RFC 5737 TEST-NET ranges — reserved for documentation, never used in production
function placeholderIp(n: number): string {
  if (n <= 254) return `192.0.2.${n}`;
  if (n <= 508) return `198.51.100.${n - 254}`;
  return `203.0.113.${Math.min(n - 508, 254)}`;
}

export function buildAnonymisationMap(
  sections: unknown,
  customerName?: string,
  firewallLabels?: string[],
): AnonymisationMap {
  const forward = new Map<string, string>();
  const reverse = new Map<string, string>();

  function add(real: string, placeholder: string) {
    if (!real || forward.has(real)) return;
    forward.set(real, placeholder);
    reverse.set(placeholder, real);
  }

  if (customerName?.trim()) add(customerName.trim(), "Client-A");

  firewallLabels?.forEach((label, i) => {
    if (label.trim()) add(label.trim(), `Firewall-${i + 1}`);
  });

  const json = JSON.stringify(sections);
  const ips = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = IP_RE.exec(json)) !== null) {
    const ip = m[1];
    if (
      !SKIP_IPS.has(ip) &&
      !ip.startsWith("192.0.2.") &&
      !ip.startsWith("198.51.100.") &&
      !ip.startsWith("203.0.113.")
    ) {
      ips.add(ip);
    }
  }

  let counter = 1;
  for (const ip of Array.from(ips).sort()) {
    add(ip, placeholderIp(counter++));
  }

  return { forward, reverse };
}

/**
 * Deep-replace all mapped values in a JSON-serialisable object.
 * Uses word-boundary regex to prevent partial IP matches
 * (e.g. replacing `10.0.0.1` inside `10.0.0.10`).
 */
export function anonymiseData<T>(data: T, map: AnonymisationMap): T {
  if (map.forward.size === 0) return data;

  let json = JSON.stringify(data);
  const sorted = Array.from(map.forward.entries()).sort(
    (a, b) => b[0].length - a[0].length,
  );

  for (const [real, placeholder] of sorted) {
    const escaped = real.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    json = json.replace(new RegExp(`(?<![\\w.])${escaped}(?![\\w.])`, "g"), placeholder);
  }

  return JSON.parse(json) as T;
}

/**
 * Replace mapped values in a plain string.
 */
export function anonymiseString(
  text: string,
  map: AnonymisationMap,
): string {
  if (map.forward.size === 0 || !text) return text;
  const sorted = Array.from(map.forward.entries()).sort(
    (a, b) => b[0].length - a[0].length,
  );
  let result = text;
  for (const [real, placeholder] of sorted) {
    const escaped = real.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(?<![\\w.])${escaped}(?![\\w.])`, "g"), placeholder);
  }
  return result;
}

/**
 * Streaming de-anonymiser.  Buffers the tail of each chunk so that
 * placeholders spanning two chunks are still caught.
 * Uses word-boundary-aware regex to prevent partial IP matches
 * (e.g. `192.0.2.1` matching inside `192.0.2.10`).
 */
export function createStreamDeanonymiser(map: AnonymisationMap) {
  const entries = Array.from(map.reverse.entries()).sort(
    (a, b) => b[0].length - a[0].length,
  );

  if (entries.length === 0) {
    return { push: (chunk: string) => chunk, flush: () => "" };
  }

  const patterns = entries.map(([placeholder, real]) => {
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { re: new RegExp(`(?<![\\w.])${escaped}(?![\\w.])`, "g"), real };
  });

  const holdback = Math.max(...entries.map(([p]) => p.length)) + 2;
  let buffer = "";

  function replaceAll(text: string): string {
    for (const { re, real } of patterns) {
      re.lastIndex = 0;
      text = text.replace(re, real);
    }
    return text;
  }

  return {
    push(chunk: string): string {
      buffer += chunk;
      if (buffer.length <= holdback) return "";
      const safe = buffer.slice(0, -holdback);
      buffer = buffer.slice(-holdback);
      return replaceAll(safe);
    },
    flush(): string {
      const result = replaceAll(buffer);
      buffer = "";
      return result;
    },
  };
}
