import { MOCK_FLEET_MAP_POINTS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/** Map lat [-90,90] lng [-180,180] to SVG viewBox 0..1000 0..500 (equirectangular-ish). */
function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return { x, y };
}

/**
 * Simple SVG “world” backdrop with glowing dots sized by fleet count.
 * Coordinates from `MOCK_FLEET_MAP_POINTS` — swap for real geo from customers when available.
 */
export function FleetWorldMap({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-white/[0.08] bg-[#0d1117] p-4", className)}>
      <p className="mb-3 text-xs text-muted-foreground">
        Customer sites (demo positions). Dot size reflects fleet count.
      </p>
      <svg
        viewBox="0 0 1000 500"
        className="h-[min(420px,55vh)] w-full"
        role="img"
        aria-label="Fleet world map"
      >
        <defs>
          <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="1000" height="500" fill="url(#ocean)" rx="12" />
        {/* Simplified continent silhouettes (decorative) */}
        <g opacity={0.22} fill="#1e293b">
          <ellipse cx="280" cy="200" rx="120" ry="90" />
          <ellipse cx="520" cy="180" rx="100" ry="85" />
          <ellipse cx="780" cy="220" rx="140" ry="100" />
          <ellipse cx="850" cy="360" rx="90" ry="55" />
        </g>
        <g opacity={0.35} stroke="#334155" strokeWidth="0.8" fill="none">
          {Array.from({ length: 7 }, (_, i) => {
            const y = 40 + i * 70;
            return <path key={y} d={`M 0 ${y} H 1000`} />;
          })}
          {Array.from({ length: 13 }, (_, i) => {
            const x = 40 + i * 80;
            return <path key={x} d={`M ${x} 0 V 500`} />;
          })}
        </g>
        {MOCK_FLEET_MAP_POINTS.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          const r = 6 + Math.min(22, Math.sqrt(p.count) * 2);
          return (
            <g key={p.id} filter="url(#glow)">
              <circle cx={x} cy={y} r={r + 6} fill="#3b82f6" opacity={0.25} />
              <circle cx={x} cy={y} r={r} fill="#38bdf8" opacity={0.9} />
              <title>{`${p.label}: ${p.count} devices`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
