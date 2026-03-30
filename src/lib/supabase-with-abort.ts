/** Attach AbortSignal to a Supabase query builder when the client supports it. */
export function supabaseWithAbort<T>(q: T, signal: AbortSignal | undefined): T {
  const chain = q as { abortSignal?: (s: AbortSignal) => T };
  if (signal && typeof chain.abortSignal === "function") return chain.abortSignal(signal);
  return q;
}
