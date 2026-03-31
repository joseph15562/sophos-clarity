import { useMemo, useEffect, useState } from "react";
import { extractExternalIps } from "@/lib/attack-surface";
import { lookupGeoIp } from "@/lib/geo-cve";
import type { ExtractedSections } from "@/lib/extract-sections";
import { EmptyState } from "@/components/EmptyState";
import { MapPinOff } from "lucide-react";

interface FileEntry {
  label: string;
  extractedData: Record<string, unknown>;
}

interface Props {
  files: Array<FileEntry>;
}

interface IpGeo {
  ip: string;
  country?: string;
  city?: string;
}

export function GeographicFleetMap({ files }: Props) {
  const [geoByIp, setGeoByIp] = useState<Record<string, IpGeo>>({});

  const rows = useMemo(() => {
    return files.map((f) => {
      const sections = f.extractedData as ExtractedSections;
      const ips = extractExternalIps(sections ?? {});
      return { label: f.label, ips };
    });
  }, [files]);

  useEffect(() => {
    const allIps = [...new Set(rows.flatMap((r) => r.ips))];
    if (allIps.length === 0) return;
    let cancelled = false;
    const run = async () => {
      const out: Record<string, IpGeo> = {};
      for (const ip of allIps) {
        if (cancelled) return;
        const geo = await lookupGeoIp(ip);
        if (cancelled) return;
        if (geo) {
          out[ip] = { ip, country: geo.country, city: geo.city };
        }
      }
      if (!cancelled) setGeoByIp(out);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const hasAnyIps = rows.some((r) => r.ips.length > 0);

  if (!hasAnyIps) {
    return (
      <div
        className="rounded-xl border border-border/50 bg-card p-5 shadow-card"
        data-tour="fleet-map"
      >
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          Fleet Locations
        </h3>
        <EmptyState
          className="!py-8"
          icon={<MapPinOff className="h-6 w-6 text-muted-foreground/50" />}
          title="No external IPs detected"
          description="Public or WAN-facing addresses from your configs will show on the map when available."
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-border/50 bg-card p-5 shadow-card"
      data-tour="fleet-map"
    >
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
        Fleet Locations
      </h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2 text-left font-medium text-muted-foreground">Firewall</th>
              <th className="pb-2 text-left font-medium text-muted-foreground">External IP</th>
              <th className="pb-2 text-left font-medium text-muted-foreground">Location</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              row.ips.length > 0 ? (
                row.ips.map((ip) => (
                  <tr key={`${row.label}-${ip}`} className="border-b border-border/50">
                    <td className="py-2">{row.label}</td>
                    <td className="py-2 font-mono text-xs">{ip}</td>
                    <td className="py-2 text-muted-foreground">
                      {geoByIp[ip]?.country
                        ? [geoByIp[ip].city, geoByIp[ip].country].filter(Boolean).join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr key={row.label} className="border-b border-border/50">
                  <td className="py-2">{row.label}</td>
                  <td colSpan={2} className="py-2 text-muted-foreground">
                    No external IPs
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
