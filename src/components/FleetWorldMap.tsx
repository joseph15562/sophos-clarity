import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MapPinOff, Minus, Plus, RotateCcw } from "lucide-react";
import { WORLD_LAND_PATH } from "@/data/world-land";
import type { FleetMapSite } from "@/lib/fleet-map-geo";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

/** Map lat/lng to SVG coordinates (same as GeoAttackMap). */
function latLonToXY(lat: number, lon: number): { x: number; y: number } {
  return { x: lon, y: -lat };
}

function pinPositionPct(lat: number, lng: number): { left: string; top: string } {
  const left = ((lng + 180) / 360) * 100;
  const top = ((90 - lat) / 180) * 100;
  return { left: `${left}%`, top: `${top}%` };
}

/** SVG pin radius and HTML hit size — keep SVG, buttons, and hover anchor in sync. */
function fleetPinLayout(firewallCount: number): { r: number; hit: number } {
  const r = 2 + Math.min(2.2, Math.sqrt(firewallCount) * 0.32);
  const hit = Math.max(14, r * 4.5);
  return { r, hit };
}

function statusLabel(s: FleetMapSite["firewalls"][0]["status"]): string {
  switch (s) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "stale":
      return "Stale";
    case "suspended":
      return "Suspended";
    default:
      return s;
  }
}

/** Floor at 1x so the map never shrinks below filling the frame (wheel/− no longer go to ~0.65x). */
const ZOOM_MIN = 1;
/** Higher cap so dense clusters (e.g. UK) can be inspected closely */
const ZOOM_MAX = 12;
const FW_CAP = 14;

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * Keep pan within range so the scaled layer (origin center, translate then scale per CSS) cannot
 * be dragged completely off-screen — avoids a thin strip / empty frame at high zoom.
 */
function clampFleetMapPan(
  px: number,
  py: number,
  viewW: number,
  viewH: number,
  z: number,
): { x: number; y: number } {
  if (viewW <= 0 || viewH <= 0 || !Number.isFinite(z) || z <= 0) return { x: px, y: py };
  const rx = (viewW * Math.abs(z - 1)) / 2;
  const ry = (viewH * Math.abs(z - 1)) / 2;
  return {
    x: Math.min(rx, Math.max(-rx, px)),
    y: Math.min(ry, Math.max(-ry, py)),
  };
}

/** On-screen size factor for the portaled pin hover card (still shrinks when zoomed in). */
function fleetMapTooltipScale(z: number): number {
  const zz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  const tLin = (zz - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
  const t = Math.min(1, Math.max(0, tLin));
  const hi = 1.06;
  const lo = 0.58;
  return hi + (lo - hi) * t;
}

export function FleetWorldMap({
  sites,
  className,
  loading = false,
  isGuestView = false,
}: {
  sites: FleetMapSite[];
  className?: string;
  loading?: boolean;
  /** Hint when browsing as guest (sample fleet). */
  isGuestView?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoverSiteId, setHoverSiteId] = useState<string | null>(null);
  const [pinAnchorPx, setPinAnchorPx] = useState<{ cx: number; cy: number } | null>(null);
  const hoverHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const mapSizeRef = useRef({ w: 0, h: 0 });
  const zoomRef = useRef(1);
  const pinButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(
    () => () => {
      if (hoverHideTimerRef.current) clearTimeout(hoverHideTimerRef.current);
    },
    [],
  );

  const showPinHover = useCallback((id: string) => {
    if (hoverHideTimerRef.current) {
      clearTimeout(hoverHideTimerRef.current);
      hoverHideTimerRef.current = null;
    }
    setHoverSiteId(id);
  }, []);

  const scheduleHidePinHover = useCallback(() => {
    if (hoverHideTimerRef.current) clearTimeout(hoverHideTimerRef.current);
    hoverHideTimerRef.current = setTimeout(() => setHoverSiteId(null), 120);
  }, []);

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((prev) => clampZoom((Number.isFinite(prev) && prev > 0 ? prev : 1) * factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.currentTarget as HTMLElement;
      t.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan.x, pan.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const nx = d.panX + e.clientX - d.startX;
    const ny = d.panY + e.clientY - d.startY;
    const { w, h } = mapSizeRef.current;
    setPan(clampFleetMapPan(nx, ny, w, h, zoomRef.current));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d && e.pointerId === d.pointerId) {
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? clampZoom(zoom) : 1;
  zoomRef.current = safeZoom;
  const tipScreen = Math.min(1.18, fleetMapTooltipScale(safeZoom) * 1.12);

  const syncMapSizeAndClampPan = useCallback(() => {
    const el = wheelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mapSizeRef.current = { w: r.width, h: r.height };
    setPan((p) => clampFleetMapPan(p.x, p.y, r.width, r.height, zoomRef.current));
  }, []);

  useLayoutEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    syncMapSizeAndClampPan();
    const ro = new ResizeObserver(() => syncMapSizeAndClampPan());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncMapSizeAndClampPan, loading, sites.length, safeZoom]);

  const hoverSite = hoverSiteId ? sites.find((s) => s.id === hoverSiteId) : null;

  useLayoutEffect(() => {
    if (!hoverSiteId) {
      setPinAnchorPx(null);
      return;
    }
    const el = pinButtonRefs.current.get(hoverSiteId);
    if (!el) {
      setPinAnchorPx(null);
      return;
    }
    const update = () => {
      const r = el.getBoundingClientRect();
      setPinAnchorPx({ cx: r.left + r.width / 2, cy: r.top + r.height / 2 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (wheelRef.current) ro.observe(wheelRef.current);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
    };
  }, [hoverSiteId, safeZoom, pan.x, pan.y]);

  const pinHoverPortal =
    hoverSite && pinAnchorPx
      ? createPortal(
          <div
            id="fleet-map-pin-hover"
            role="tooltip"
            className="pointer-events-none fixed z-[90] w-max min-w-0 max-w-[min(18rem,calc(100vw-1.5rem))] break-words rounded-md border border-border/80 bg-popover px-2.5 py-2 text-left text-xs leading-snug text-popover-foreground shadow-elevated"
            style={{
              left: pinAnchorPx.cx,
              top: pinAnchorPx.cy,
              transform: `translate(-50%, calc(-100% - 10px)) scale(${tipScreen})`,
              transformOrigin: "bottom center",
            }}
          >
            <p className="text-sm font-semibold leading-tight text-foreground">
              {hoverSite.customer}
            </p>
            {hoverSite.tenantName ? (
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                <span className="font-medium text-foreground/85">Tenant</span> ·{" "}
                {hoverSite.tenantName}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
              {hoverSite.firewallCount} firewall{hoverSite.firewallCount === 1 ? "" : "s"} ·{" "}
              {hoverSite.countryLabel}
            </p>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-border/50 pt-2 text-[11px] leading-snug text-muted-foreground">
              {hoverSite.firewalls.slice(0, FW_CAP).map((fwp) => (
                <li key={fwp.hostname}>
                  <span className="font-medium text-foreground">{fwp.hostname}</span>
                  <span>
                    {" "}
                    · {fwp.model} · {fwp.grade} · {statusLabel(fwp.status)}
                  </span>
                </li>
              ))}
            </ul>
            {hoverSite.firewalls.length > FW_CAP ? (
              <p className="mt-2 border-t border-border/40 pt-1.5 text-[10px] text-muted-foreground">
                +{hoverSite.firewalls.length - FW_CAP} more in this customer…
              </p>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.08] bg-[#0a1628] p-4",
          className,
        )}
      >
        <p className="mb-3 text-xs text-muted-foreground">
          World map (Natural Earth land). Each firewall is a pin:{" "}
          <strong className="text-foreground/90">MSP latitude/longitude</strong> (below) overrides{" "}
          <strong className="text-foreground/90">Sophos Central geo</strong>, then compliance{" "}
          <strong className="text-foreground/90">country</strong> (approximate).{" "}
          <strong className="text-foreground/90">Drag</strong> to pan (stays within the map frame),{" "}
          <strong className="text-foreground/90">scroll</strong> to zoom, or use +/−.{" "}
          <strong className="text-foreground/90">Hover</strong> a pin for details.
          {isGuestView ? " Guest view uses sample fleet data." : ""}
        </p>

        {loading ? (
          <div
            className="flex aspect-[2/1] w-full items-center justify-center rounded-xl border border-white/10 bg-[#060d18]"
            role="status"
            aria-label="Loading map"
          >
            <Loader2 className="h-8 w-8 animate-spin text-[#009CFB]" />
          </div>
        ) : sites.length === 0 ? (
          <EmptyState
            className="min-h-[240px] rounded-xl border border-white/10 bg-[#060d18]/80 py-16"
            icon={<MapPinOff className="h-8 w-8 text-muted-foreground/60" />}
            title="No fleet to map"
            description="Sync Central or connect agents, then open the Map tab again. Pins appear once there are firewalls in the filtered list."
          />
        ) : (
          <div
            ref={wheelRef}
            className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#030712]"
            style={{ aspectRatio: "2 / 1" }}
          >
            <div
              role="application"
              aria-label="Fleet world map. Drag to pan, scroll wheel to zoom."
              tabIndex={0}
              className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing outline-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div
                className="absolute inset-0 h-full w-full"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${safeZoom})`,
                  transformOrigin: "center center",
                }}
              >
                {/*
                  No SVG feGaussianBlur: with CSS scale() on the parent, WebKit/Chrome often
                  rasterise the filtered subtree at the wrong resolution → whole map looks soft.
                  Halo is two circles only (no filter).
                */}
                <svg
                  viewBox="-180 -90 360 180"
                  className="absolute inset-0 h-full w-full pointer-events-none"
                  preserveAspectRatio="xMidYMid meet"
                  role="img"
                  aria-hidden
                  style={{ shapeRendering: "geometricPrecision" }}
                >
                  <rect x="-180" y="-90" width="360" height="180" fill="#060d18" />
                  <path
                    d={WORLD_LAND_PATH}
                    fill="#1a2f4d"
                    stroke="#2d4a6f"
                    strokeWidth="0.35"
                    strokeLinejoin="round"
                  />
                  {sites.map((site) => {
                    const { x, y } = latLonToXY(site.lat, site.lng);
                    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                    const { r } = fleetPinLayout(site.firewallCount);
                    // Counteract parent CSS scale(zoom) so pins stay ~fixed screen size (shrink when zoomed in).
                    const inv = 1 / safeZoom;
                    return (
                      <g
                        key={site.id}
                        transform={`translate(${x} ${y}) scale(${inv}) translate(${-x} ${-y})`}
                        pointerEvents="none"
                      >
                        <circle cx={x} cy={y} r={r + 3} fill="#009CFB" opacity={0.14} />
                        <circle cx={x} cy={y} r={r} fill="#38bdf8" opacity={0.98} />
                      </g>
                    );
                  })}
                </svg>

                <div className="pointer-events-none absolute inset-0">
                  {sites.map((site) => {
                    const { left, top } = pinPositionPct(site.lat, site.lng);
                    const { hit } = fleetPinLayout(site.firewallCount);
                    const inv = 1 / safeZoom;
                    return (
                      <button
                        key={`hit-${site.id}`}
                        ref={(el) => {
                          if (el) pinButtonRefs.current.set(site.id, el);
                          else pinButtonRefs.current.delete(site.id);
                        }}
                        type="button"
                        className="pointer-events-auto absolute z-10 rounded-full border-0 bg-transparent p-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009CFB]"
                        style={{
                          left,
                          top,
                          width: hit,
                          height: hit,
                          transform: `translate(-50%, -50%) scale(${inv})`,
                        }}
                        aria-label={`${site.customer}${
                          site.tenantName ? `, tenant ${site.tenantName}` : ""
                        }: ${site.firewallCount} firewalls. Hover for details.`}
                        aria-describedby={
                          hoverSiteId === site.id ? "fleet-map-pin-hover" : undefined
                        }
                        onPointerEnter={() => showPinHover(site.id)}
                        onPointerLeave={scheduleHidePinHover}
                        onFocus={() => showPinHover(site.id)}
                        onBlur={scheduleHidePinHover}
                        onPointerDown={(e) => e.stopPropagation()}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-2 right-2 z-20 flex flex-col gap-1">
              <div className="pointer-events-auto flex flex-col overflow-hidden rounded-lg border border-white/15 bg-[#0a1628]/95 shadow-lg backdrop-blur-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none border-b border-white/10 text-foreground hover:bg-white/10"
                  aria-label="Zoom in"
                  onClick={() => setZoom((z) => clampZoom((Number.isFinite(z) ? z : 1) * 1.2))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none text-foreground hover:bg-white/10"
                  aria-label="Zoom out"
                  onClick={() => setZoom((z) => clampZoom((Number.isFinite(z) ? z : 1) / 1.2))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="pointer-events-auto h-8 gap-1 border border-white/10 bg-[#0a1628]/95 px-2 text-[10px] text-foreground shadow-lg backdrop-blur-sm hover:bg-white/10"
                aria-label="Reset map view"
                onClick={resetView}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            </div>
          </div>
        )}
      </div>
      {pinHoverPortal}
    </>
  );
}
