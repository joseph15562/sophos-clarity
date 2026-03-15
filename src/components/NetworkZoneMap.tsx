import { useMemo, useState } from "react";

interface ExtractedSection {
  tables: Array<{ headers: string[]; rows: Record<string, string>[] }>;
  text: string;
  details: Array<{ title: string; fields: Record<string, string> }>;
}

interface Props {
  files: Array<{
    label: string;
    extractedData: Record<string, ExtractedSection>;
  }>;
}

interface ZoneFlow {
  source: string;
  dest: string;
  count: number;
  hasIps: number;
  webFilterable: number;
  hasWebFilter: number;
}

type SecurityLevel = "full" | "partial" | "none";

function findSection(
  sections: Record<string, ExtractedSection>,
  pattern: RegExp
): ExtractedSection | null {
  for (const key of Object.keys(sections)) {
    if (pattern.test(key)) return sections[key];
  }
  return null;
}

function isWebTraffic(service: string): boolean {
  const s = service.toLowerCase().trim();
  if (!s || s === "any") return true;
  if (/^(dns|ntp|smtp|snmp|icmp|ipsec|gre|l2tp|pptp)$/i.test(s)) return false;
  if (s.includes("http") || /\b(80|443|8080|8443)\b/.test(s)) return true;
  return false;
}

function getFlowSecurityLevel(f: ZoneFlow): SecurityLevel {
  if (f.count === 0) return "none";
  const ipsPct = f.hasIps / f.count;
  const wfApplicable = isWebTraffic("HTTP") ? 1 : 0;
  const wfPct = wfApplicable > 0 ? f.hasWebFilter / f.count : 1;
  const hasAny = ipsPct > 0 || wfPct > 0;
  const hasAll = ipsPct >= 1 && (wfApplicable === 0 || wfPct >= 1);
  if (hasAll) return "full";
  if (hasAny) return "partial";
  return "none";
}

function getZoneSecurityLevel(
  flows: ZoneFlow[],
  zone: string
): SecurityLevel {
  const zoneFlows = flows.filter((f) => f.source === zone || f.dest === zone);
  const levels = zoneFlows.map((f) => getFlowSecurityLevel(f));
  if (levels.every((l) => l === "full")) return "full";
  if (levels.some((l) => l === "full") || levels.some((l) => l === "partial"))
    return "partial";
  return "none";
}

const ZONE_BORDER: Record<string, string> = {
  wan: "#EA0022",
  lan: "#00995a",
  dmz: "#F29400",
};

function getZoneBorder(zone: string): string {
  const z = zone.toLowerCase();
  if (z.includes("wan")) return ZONE_BORDER.wan;
  if (z.includes("lan") || z.includes("server")) return ZONE_BORDER.lan;
  if (z.includes("dmz")) return ZONE_BORDER.dmz;
  return "transparent";
}

const FLOW_COLORS: Record<SecurityLevel, string> = {
  full: "#00995a",
  partial: "#F29400",
  none: "#EA0022",
};

function circularLayout(
  zones: string[],
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;
  const n = zones.length;
  zones.forEach((z, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    map.set(z, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });
  return map;
}

export function NetworkZoneMap({ files }: Props) {
  const [hoverZone, setHoverZone] = useState<string | null>(null);
  const [hoverFlow, setHoverFlow] = useState<string | null>(null);

  const { zones, flows, zonePositions } = useMemo(() => {
    const zoneSet = new Set<string>();
    const flowMap = new Map<string, ZoneFlow>();

    for (const file of files) {
      const sections = file.extractedData;
      const fwSection =
        findSection(sections, /firewall\s*rules|firewallrules/i) ??
        sections["Firewall Rules"] ??
        sections["firewallRules"];
      const zoneSection =
        findSection(sections, /^zones?$/i) ?? sections["Zone"] ?? sections["zones"];

      if (zoneSection) {
        for (const t of zoneSection.tables) {
          for (const row of t.rows) {
            const name = row["Name"] ?? row["Zone"] ?? row["Zone Name"] ?? "";
            if (name.trim()) zoneSet.add(name.trim());
          }
        }
      }

      if (fwSection) {
        for (const table of fwSection.tables) {
          for (const row of table.rows) {
            const srcZone = (
              row["Source Zone"] ??
              row["Source Zones"] ??
              row["Src Zone"] ??
              ""
            ).trim();
            const dstZone = (
              row["Destination Zone"] ??
              row["Destination Zones"] ??
              row["Dest Zone"] ??
              row["DestZone"] ??
              ""
            ).trim();
            if (!srcZone || !dstZone) continue;

            const status = (row["Status"] ?? row["status"] ?? "").toLowerCase();
            if (status === "disabled" || status === "disable") continue;

            const wf =
              row["Web Filter"] ??
              row["Web Filter Policy"] ??
              row["WebFilter"] ??
              "";
            const hasWf = !!(
              wf &&
              !/none|not specified|-|n\/a/i.test(wf)
            );
            const ips =
              row["IPS"] ??
              row["Intrusion Prevention"] ??
              row["IntrusionPrevention"] ??
              "";
            const hasIps = !!(
              ips &&
              !/none|off|-|n\/a|disabled/i.test(ips)
            );
            const service = row["Service"] ?? row["Services"] ?? "Any";
            const needsWf = isWebTraffic(service);

            const srcList = srcZone.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
            const dstList = dstZone.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

            for (const src of srcList) {
              zoneSet.add(src);
              for (const dst of dstList) {
                zoneSet.add(dst);
                const key = `${src}→${dst}`;
                const existing = flowMap.get(key);
                if (existing) {
                  existing.count++;
                  if (hasIps) existing.hasIps++;
                  if (needsWf) existing.webFilterable++;
                  if (needsWf && hasWf) existing.hasWebFilter++;
                } else {
                  flowMap.set(key, {
                    source: src,
                    dest: dst,
                    count: 1,
                    hasIps: hasIps ? 1 : 0,
                    webFilterable: needsWf ? 1 : 0,
                    hasWebFilter: needsWf && hasWf ? 1 : 0,
                  });
                }
              }
            }
          }
        }
      }
    }

    const zoneList = [...zoneSet];
    const positions = circularLayout(zoneList, 400, 300);

    return {
      zones: zoneList,
      flows: [...flowMap.values()],
      zonePositions: positions,
    };
  }, [files]);

  const svgWidth = 400;
  const svgHeight = 300;

  if (zones.length === 0 && flows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Network Zone Map</h3>
        <p className="mt-2 text-xs text-muted-foreground">No zone data available</p>
      </div>
    );
  }

  const displayZones = zones.length > 0 ? zones : [...new Set(flows.flatMap((f) => [f.source, f.dest]))];
  const positions = zones.length > 0 ? zonePositions : circularLayout(displayZones, svgWidth, svgHeight);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Network Zone Map</h3>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full"
          style={{ height: 300, minWidth: 280 }}
        >
          {/* Flow lines */}
          {flows.map((f) => {
            const srcPos = positions.get(f.source);
            const dstPos = positions.get(f.dest);
            if (!srcPos || !dstPos) return null;

            const level = getFlowSecurityLevel(f);
            const thickness = Math.min(4, Math.max(1, Math.ceil(f.count / 5)));
            const key = `${f.source}→${f.dest}`;
            const isHovered =
              hoverFlow === key ||
              (hoverZone && (hoverZone === f.source || hoverZone === f.dest));

            return (
              <line
                key={key}
                x1={srcPos.x}
                y1={srcPos.y}
                x2={dstPos.x}
                y2={dstPos.y}
                stroke={FLOW_COLORS[level]}
                strokeWidth={isHovered ? thickness + 1 : thickness}
                strokeOpacity={isHovered ? 1 : 0.7}
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHoverFlow(key)}
                onMouseLeave={() => setHoverFlow(null)}
              >
                <title>
                  {f.count} rule{f.count !== 1 ? "s" : ""} from {f.source} to {f.dest}
                </title>
              </line>
            );
          })}

          {/* Zone nodes */}
          {displayZones.map((zone) => {
            const pos = positions.get(zone);
            if (!pos) return null;

            const level = getZoneSecurityLevel(flows, zone);
            const fill =
              level === "full"
                ? "#00995a"
                : level === "partial"
                  ? "#F29400"
                  : "#6A889B";
            const border = getZoneBorder(zone);
            const isHovered = hoverZone === zone;

            return (
              <g
                key={zone}
                onMouseEnter={() => setHoverZone(zone)}
                onMouseLeave={() => setHoverZone(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isHovered ? 28 : 24}
                  fill={fill}
                  fillOpacity={0.9}
                  stroke={border !== "transparent" ? border : "currentColor"}
                  strokeWidth={border !== "transparent" ? 3 : 1}
                  strokeOpacity={border !== "transparent" ? 1 : 0.3}
                  className="transition-all"
                />
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[9px] font-medium fill-foreground pointer-events-none"
                >
                  {zone.length > 8 ? zone.slice(0, 7) + "…" : zone}
                </text>
                <title>
                  {zone} —{" "}
                  {flows
                    .filter((f) => f.source === zone || f.dest === zone)
                    .reduce((s, f) => s + f.count, 0)}{" "}
                  rules
                </title>
              </g>
            );
          })}
        </svg>
      </div>

      {hoverFlow && (
        <p className="text-[10px] text-muted-foreground">
          {(() => {
            const [src, dst] = hoverFlow.split("→");
            const f = flows.find((x) => x.source === src && x.dest === dst);
            return f
              ? `${f.count} rule${f.count !== 1 ? "s" : ""} from ${src} to ${dst}`
              : "";
          })()}
        </p>
      )}
    </div>
  );
}
