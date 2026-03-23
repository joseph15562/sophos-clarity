/**
 * Geo-IP and CVE lookup utilities for attack surface visualization.
 * Uses free APIs: ip-api.com (geo) and NVD (CVE). No API keys required.
 */

export interface GeoLocation {
  ip: string;
  lat: number;
  lon: number;
  country: string;
  city: string;
  isp: string;
}

export interface CveEntry {
  id: string;
  description: string;
  severity: string;
  published: string;
  score: number;
}

// IPv4 regex for validation
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

function isValidPublicIp(ip: string): boolean {
  if (!IPV4_REGEX.test(ip)) return false;
  // Exclude private/reserved ranges
  const parts = ip.split(".").map(Number);
  if (parts[0] === 10) return false;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
  if (parts[0] === 192 && parts[1] === 168) return false;
  if (parts[0] === 127) return false;
  return true;
}

const geoCache = new Map<string, GeoLocation | null>();
const cveCache = new Map<string, CveEntry[]>();

/** Map common ports to service names for CVE search */
const PORT_TO_SERVICE: Record<number, string> = {
  21: "FTP",
  22: "SSH",
  23: "Telnet",
  25: "SMTP",
  53: "DNS",
  80: "HTTP",
  110: "POP3",
  143: "IMAP",
  443: "HTTPS",
  445: "SMB",
  993: "IMAPS",
  995: "POP3S",
  1433: "SQL Server",
  1521: "Oracle",
  3306: "MySQL",
  3389: "RDP",
  5432: "PostgreSQL",
  5900: "VNC",
  8080: "HTTP",
  8443: "HTTPS",
  27017: "MongoDB",
};

/**
 * Lookup geo location for an IP using ip-api.com (free, 45 req/min).
 * Caches results to avoid re-fetching.
 */
export async function lookupGeoIp(ip: string): Promise<GeoLocation | null> {
  if (!isValidPublicIp(ip)) return null;

  const cached = geoCache.get(ip);
  if (cached !== undefined) return cached;

  try {
    // ip-api.com free tier uses HTTP (no SSL)
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,query,lat,lon,country,city,isp`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();

    if (data.status !== "success" || data.message === "private range" || data.message === "reserved range") {
      geoCache.set(ip, null);
      return null;
    }

    const geo: GeoLocation = {
      ip: data.query ?? ip,
      lat: Number(data.lat) || 0,
      lon: Number(data.lon) || 0,
      country: data.country ?? "",
      city: data.city ?? "",
      isp: data.isp ?? "",
    };
    geoCache.set(ip, geo);
    return geo;
  } catch {
    geoCache.set(ip, null);
    return null;
  }
}

function getServiceForPort(port: number): string {
  return PORT_TO_SERVICE[port] ?? `port ${port}`;
}

/**
 * Lookup CVEs for a service/port using NVD API (free).
 * Maps common ports to service names. Caches results.
 * Returns top 5 CVEs.
 */
export async function lookupCves(service: string, port: number): Promise<CveEntry[]> {
  const searchTerm = service && service !== "Unknown" && service !== "Any"
    ? service
    : getServiceForPort(port);
  const cacheKey = `${searchTerm}:${port}`;

  const cached = cveCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const keyword = encodeURIComponent(searchTerm);
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${keyword}&resultsPerPage=5`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "Accept": "application/json" },
    });
    const data = await res.json();

    const vulns = (data.vulnerabilities ?? []) as Array<{
      cve?: {
        id?: string;
        descriptions?: Array<{ value?: string; lang?: string }>;
        published?: string;
        metrics?: Record<string, Array<{ cvssData?: { baseScore?: number; baseSeverity?: string }; baseSeverity?: string }>>;
      };
    }>;
    const entries: CveEntry[] = vulns.slice(0, 5).map((v) => {
      const cve = v.cve ?? {};
      const desc = cve.descriptions?.find((d) => d.lang === "en")?.value ?? "";
      const metrics = cve.metrics ?? {};
      const v31 = metrics.cvssMetricV31?.[0];
      const v30 = metrics.cvssMetricV30?.[0];
      const v2 = metrics.cvssMetricV2?.[0];
      const score = v31?.cvssData?.baseScore ?? v30?.cvssData?.baseScore ?? v2?.cvssData?.baseScore ?? 0;
      const severity = v31?.cvssData?.baseSeverity ?? v30?.cvssData?.baseSeverity ?? v2?.baseSeverity ?? "UNKNOWN";
      return {
        id: cve.id ?? "unknown",
        description: desc.slice(0, 200) + (desc.length > 200 ? "…" : ""),
        severity,
        published: cve.published ?? "",
        score,
      };
    });

    cveCache.set(cacheKey, entries);
    return entries;
  } catch {
    cveCache.set(cacheKey, []);
    return [];
  }
}
