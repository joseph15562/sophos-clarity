import { useEffect, useState } from "react";

/**
 * Triggers a re-render on an interval so relative time strings (e.g. date-fns
 * `formatDistanceToNow`) stay accurate. Without this, labels freeze until some
 * other state update — so one browser tab can show “22 minutes ago” while
 * another opened later shows “2 minutes ago” for the same instant.
 */
export function useRelativeTimeTick(intervalMs = 30_000): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const id = window.setInterval(bump, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
