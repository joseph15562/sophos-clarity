import { useEffect, useState } from "react";
import { lookupGeoIp, lookupCves, type GeoLocation, type CveEntry } from "@/lib/geo-cve";
import { WORLD_LAND_PATH } from "@/data/world-land";

interface IpWithGeo {
  ip: string;
  geo: GeoLocation | null;
  cves: CveEntry[];
  status: "loading" | "ready" | "error";
}

interface Props {
  externalIps: string[];
  exposedServices?: Array<{ service: string; port: string }>;
}

function latLonToXY(lat: number, lon: number): { x: number; y: number } {
  return { x: lon, y: -lat };
}


export function GeoAttackMap({ externalIps, exposedServices = [] }: Props) {
  const [data, setData] = useState<IpWithGeo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (externalIps.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const services = exposedServices.filter((s) => s.port || s.service);

    const run = async () => {
      const results: IpWithGeo[] = [];
      const cveByKey = new Map<string, CveEntry[]>();

      for (const ip of externalIps) {
        results.push({ ip, geo: null, cves: [], status: "loading" });
      }
      setData([...results]);

      for (let i = 0; i < externalIps.length; i++) {
        if (cancelled) return;
        const ip = externalIps[i];
        const geo = await lookupGeoIp(ip);
        if (cancelled) return;
        results[i] = { ...results[i], geo, status: geo ? "ready" : "error" };
        setData([...results]);
      }

      for (const svc of services) {
        if (cancelled) return;
        const port = parseInt(svc.port, 10) || 0;
        const key = `${svc.service}:${port}`;
        if (!cveByKey.has(key)) {
          const cves = await lookupCves(svc.service, port);
          cveByKey.set(key, cves);
        }
      }

      if (cancelled) return;
      const allCves = Array.from(cveByKey.values()).flat();
      const hasCves = allCves.length > 0;

      for (let i = 0; i < results.length; i++) {
        results[i] = { ...results[i], cves: hasCves ? allCves.slice(0, 5) : [] };
      }
      setData([...results]);
      setLoading(false);
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalIps.join(","), exposedServices.length]);

  const pointsWithCoords = data.filter((d) => d.geo) as Array<IpWithGeo & { geo: GeoLocation }>;

  const getDotColor = (d: IpWithGeo) => d.cves.length > 0 ? "#EA0022" : "#F29400";

  return (
    <div className="flex flex-col sm:flex-row gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex-1 min-w-0">
        <div className="rounded-lg overflow-hidden border border-border" style={{ aspectRatio: "2/1" }}>
          <svg
            viewBox="-180 -90 360 180"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
            style={{ background: "#0a1628" }}
          >
            <defs>
              <radialGradient id="dot-glow-orange" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F29400" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#F29400" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="dot-glow-red" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#EA0022" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#EA0022" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Land masses — Natural Earth 110m coastlines */}
            <path
              d={WORLD_LAND_PATH}
              fill="#162340"
              stroke="#2a4060"
              strokeWidth="0.3"
              strokeLinejoin="round"
            />

            {/* Data points with glow */}
            {pointsWithCoords.map((d) => {
              const { x, y } = latLonToXY(d.geo.lat, d.geo.lon);
              const glowId = d.cves.length > 0 ? "dot-glow-red" : "dot-glow-orange";
              return (
                <g key={d.ip}>
                  <circle cx={x} cy={y} r={14} fill={`url(#${glowId})`} />
                  <circle
                    cx={x} cy={y} r={4}
                    fill={getDotColor(d)}
                    stroke="#0a1628"
                    strokeWidth="1.5"
                  />
                </g>
              );
            })}
          </svg>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          <span className="inline-block w-2 h-2 rounded-full bg-[#F29400] mr-1 align-middle" /> Exposed
          <span className="inline-block w-2 h-2 rounded-full bg-[#EA0022] ml-3 mr-1 align-middle" /> Has CVEs
        </p>
      </div>
      <div className="w-full sm:w-64 shrink-0 sm:border-l border-border sm:pl-4 pt-4 sm:pt-0 space-y-3 max-h-64 overflow-y-auto">
        <p className="text-xs font-semibold text-foreground">External IPs</p>
        {loading && data.length === 0 && (
          <p className="text-[10px] text-muted-foreground">Loading geo data…</p>
        )}
        {data.map((d) => (
          <div
            key={d.ip}
            className="rounded-lg border border-border bg-background/50 px-2.5 py-2 text-[10px]"
          >
            <p className="font-mono font-medium text-foreground">{d.ip}</p>
            {d.status === "loading" && (
              <p className="text-muted-foreground mt-0.5">Resolving…</p>
            )}
            {d.geo && (
              <p className="text-muted-foreground mt-0.5">
                {d.geo.city && `${d.geo.city}, `}{d.geo.country}
                {d.geo.isp && ` · ${d.geo.isp}`}
              </p>
            )}
            {d.status === "error" && !d.geo && (
              <p className="text-muted-foreground mt-0.5">Private or unavailable</p>
            )}
            {d.cves.length > 0 && (
              <div className="mt-1.5 space-y-1">
                <p className="font-medium text-[#EA0022]">CVEs</p>
                {d.cves.slice(0, 3).map((c) => (
                  <div key={c.id} className="text-muted-foreground">
                    <a
                      href={`https://nvd.nist.gov/vuln/detail/${c.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2006F7] dark:text-[#00EDFF] hover:underline"
                    >
                      {c.id}
                    </a>
                    <span className="ml-1">({c.severity})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
