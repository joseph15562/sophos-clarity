import { useEffect, useRef, useState } from "react";

/**
 * Animates a numeric display from 0 (or `start`) to `end` over `durationMs`.
 * Respects prefers-reduced-motion.
 */
export function useCountUp(
  end: number,
  options?: { durationMs?: number; start?: number; decimals?: number },
) {
  const { durationMs = 800, start = 0, decimals = 0 } = options ?? {};
  const [value, setValue] = useState(start);
  const raf = useRef<number>(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(end);
      return;
    }

    const from = start;
    const delta = end - from;
    if (delta === 0) {
      setValue(end);
      return;
    }

    const tick = (now: number) => {
      if (startTime.current == null) startTime.current = now;
      const t = Math.min(1, (now - startTime.current) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      const next = from + delta * eased;
      setValue(decimals > 0 ? Number(next.toFixed(decimals)) : Math.round(next));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };

    startTime.current = null;
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [end, durationMs, start, decimals]);

  return value;
}
