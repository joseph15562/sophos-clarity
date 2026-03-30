import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackProductEvent } from "@/lib/product-telemetry";

/** Emits `spa_page_view` when the SPA path changes (no-op ingest when `VITE_ANALYTICS_INGEST_URL` unset). */
export function ProductRouteTelemetry() {
  const location = useLocation();
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    if (prevRef.current === path) return;
    prevRef.current = path;
    trackProductEvent("spa_page_view", {
      pathname: location.pathname,
      hasSearch: Boolean(location.search),
    });
  }, [location.pathname, location.search]);

  return null;
}
