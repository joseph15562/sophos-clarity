import { useEffect, useState } from "react";
import { lookupGeoIp, lookupCves, type GeoLocation, type CveEntry } from "@/lib/geo-cve";

/** Simplified world outline path (equirectangular, Natural Earth–style). Minimal ~2KB path. */
const OCEAN_PATH = "M-180,90L-180,-90L180,-90L180,90L-180,90Z";
const LAND_PATH =
  "M-170,-50L-50,-55L30,-55L100,-45L170,-60L180,-75L180,-90L100,-90L-30,-90L-120,-75L-170,-50ZM-170,20L-120,30L-60,25L0,35L50,30L120,45L170,35L180,20L180,-20L150,-35L80,-45L20,-40L-50,-45L-120,-35L-170,-25L-180,-10L-180,20L-170,20ZM-30,90L50,90L120,75L180,60L180,30L150,15L80,5L0,10L-80,0L-150,10L-180,25L-180,60L-120,75L-50,90L-30,90ZM-170,60L-100,75L-30,70L50,80L120,70L170,80L180,90L120,90L50,90L-50,90L-120,85L-170,60ZM30,-90L120,-90L180,-75L180,-55L150,-45L100,-50L50,-55L0,-60L-50,-55L-100,-50L-150,-45L-180,-55L-180,-90L-120,-90L-30,-90L30,-90Z";

interface IpWithGeo {
  ip: string;
  geo: GeoLocation | null;
  cves: CveEntry[];
  status: "loading" | "ready" | "error";
}

interface Props {
  externalIps: string[];
  /** Service names and ports from exposed DNAT rules, for CVE lookup */
  exposedServices?: Array<{ service: string; port: string }>;
}

/** Convert lat/lon to SVG coords for viewBox="-180 -90 360 180" (equirectangular) */
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
        results.push({
          ip,
          geo: null,
          cves: [],
          status: "loading",
        });
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
        results[i] = {
          ...results[i],
          cves: hasCves ? allCves.slice(0, 5) : [],
        };
      }
      setData([...results]);
      setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [externalIps.join(","), exposedServices.length]);

  const pointsWithCoords = data.filter((d) => d.geo) as Array<IpWithGeo & { geo: GeoLocation }>;

  const getDotColor = (d: IpWithGeo) => {
    if (d.cves.length > 0) return "#EA0022";
    return "#F29400";
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex-1 min-w-0">
        <div className="rounded-lg overflow-hidden border border-border bg-background dark:bg-muted/30" style={{ aspectRatio: "2/1" }}>
          <svg
            viewBox="-180 -90 360 180"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <path d={OCEAN_PATH} fill="hsl(var(--background))" />
            <path
              d={LAND_PATH}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
            />
            {pointsWithCoords.map((d) => {
              const { x, y } = latLonToXY(d.geo.lat, d.geo.lon);
              return (
                <circle
                  key={d.ip}
                  cx={x}
                  cy={y}
                  r={6}
                  fill={getDotColor(d)}
                  stroke="hsl(var(--background))"
                  strokeWidth="2"
                  className="drop-shadow-sm"
                />
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
