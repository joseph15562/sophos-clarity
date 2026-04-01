/** Combine multiple abort sources; aborts when any source aborts. */
export function mergeAbortSignals(...inputs: AbortSignal[]): AbortSignal {
  const filtered = inputs.filter(Boolean);
  if (filtered.length === 0) return new AbortController().signal;
  if (filtered.length === 1) return filtered[0];
  const c = new AbortController();
  const forward = () => {
    c.abort();
  };
  for (const s of filtered) {
    if (s.aborted) {
      c.abort();
      return c.signal;
    }
    s.addEventListener("abort", forward, { once: true });
  }
  return c.signal;
}
