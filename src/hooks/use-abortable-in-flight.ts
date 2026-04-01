import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a function that aborts any prior in-flight request and yields a fresh `AbortSignal`.
 * All signals are aborted on unmount. Use for user-initiated `fetch` in components (not inside TanStack `queryFn`, which already receives `signal`).
 */
export function useAbortableInFlight(): () => AbortSignal {
  const ref = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      ref.current?.abort();
      ref.current = null;
    };
  }, []);
  return useCallback(() => {
    ref.current?.abort();
    ref.current = new AbortController();
    return ref.current.signal;
  }, []);
}
