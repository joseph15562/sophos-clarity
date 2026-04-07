import { Loader2, MapPinOff } from "lucide-react";
import { WORLD_LAND_PATH } from "@/data/world-land";
import type { FleetMapSite } from "@/lib/fleet-map-geo";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Map lat/lng to SVG coordinates (same as GeoAttackMap). */
function latLonToXY(lat: number, lon: number): { x: number; y: number } {
  return { x: lon, y: -lat };
}

function pinPositionPct(lat: number, lng: number): { left: string; top: string } {
  const left = ((lng + 180) / 360) * 100;
  const top = ((90 - lat) / 180) * 100;
  return { left: `${left}%`, top: `${top}%` };
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

const FW_CAP = 14;

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
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.08] bg-[#0a1628] p-4",
        className,
      )}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        World map (Natural Earth land). Pins are grouped by{" "}
        <strong className="text-foreground/90">customer</strong> and placed from compliance{" "}
        <strong className="text-foreground/90">country</strong> on each firewall row (approximate).{" "}
        <strong className="text-foreground/90">Hover</strong> a pin for hostnames, models, and
        status.
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
        <TooltipProvider delayDuration={200}>
          <div
            className="relative w-full overflow-hidden rounded-xl border border-white/10"
            style={{ aspectRatio: "2 / 1" }}
          >
            <svg
              viewBox="-180 -90 360 180"
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Fleet locations on world map"
            >
              <defs>
                <filter id="fleet-pin-glow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect x="-180" y="-90" width="360" height="180" fill="#060d18" />
              <path
                d={WORLD_LAND_PATH}
                fill="#1a2f4d"
                stroke="#2d4a6f"
                strokeWidth="0.35"
                strokeLinejoin="round"
              />
              {/* Non-interactive glow + dot (HTML layer handles hover hit targets) */}
              {sites.map((site) => {
                const { x, y } = latLonToXY(site.lat, site.lng);
                const r = 5 + Math.min(16, Math.sqrt(site.firewallCount) * 1.6);
                return (
                  <g key={site.id} filter="url(#fleet-pin-glow)" pointerEvents="none">
                    <circle cx={x} cy={y} r={r + 5} fill="#009CFB" opacity={0.2} />
                    <circle cx={x} cy={y} r={r} fill="#38bdf8" opacity={0.95} />
                  </g>
                );
              })}
            </svg>

            {/* Interactive overlay — Radix tooltips need DOM nodes */}
            <div className="pointer-events-none absolute inset-0">
              {sites.map((site) => {
                const { left, top } = pinPositionPct(site.lat, site.lng);
                const r = 5 + Math.min(16, Math.sqrt(site.firewallCount) * 1.6);
                const hit = Math.max(22, r + 10);
                const shown = site.firewalls.slice(0, FW_CAP);
                const more = site.firewalls.length - shown.length;
                return (
                  <Tooltip key={`hit-${site.id}`}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-0 bg-transparent p-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009CFB]"
                        style={{ left, top, width: hit, height: hit }}
                        aria-label={`${site.customer}: ${site.firewallCount} firewalls. Hover for details.`}
                      />
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={8}
                      className="max-w-sm border-border/80 bg-popover/95 px-3 py-2.5 text-xs shadow-elevated"
                    >
                      <p className="font-semibold text-foreground">{site.customer}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {site.firewallCount} firewall{site.firewallCount === 1 ? "" : "s"} ·{" "}
                        {site.countryLabel}
                      </p>
                      <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto border-t border-border/60 pt-2 text-[11px]">
                        {shown.map((fw) => (
                          <li key={fw.hostname} className="leading-snug">
                            <span className="font-medium text-foreground">{fw.hostname}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {fw.model} · {fw.grade} · {statusLabel(fw.status)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {more > 0 ? (
                        <p className="mt-2 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                          +{more} more in this customer…
                        </p>
                      ) : null}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
