import { useMemo, useState, useCallback } from "react";

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
type ZoneCategory = "external" | "perimeter" | "internal";

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
  const wfPct = f.webFilterable > 0 ? f.hasWebFilter / f.webFilterable : 1;
  if (ipsPct >= 1 && wfPct >= 1) return "full";
  if (ipsPct > 0 || (f.webFilterable > 0 && wfPct > 0)) return "partial";
  return "none";
}

function getZoneSecurityLevel(flows: ZoneFlow[], zone: string): SecurityLevel {
  const zoneFlows = flows.filter((f) => f.source === zone || f.dest === zone);
  if (zoneFlows.length === 0) return "none";
  const levels = zoneFlows.map((f) => getFlowSecurityLevel(f));
  if (levels.every((l) => l === "full")) return "full";
  if (levels.some((l) => l === "full") || levels.some((l) => l === "partial"))
    return "partial";
  return "none";
}

const FLOW_COLORS: Record<SecurityLevel, string> = {
  full: "#00995a",
  partial: "#F29400",
  none: "#EA0022",
};

const LEVEL_LABELS: Record<SecurityLevel, string> = {
  full: "Secured",
  partial: "Partial",
  none: "Unprotected",
};

function categorizeZone(name: string): ZoneCategory {
  const z = name.toLowerCase();
  if (/^wan$|wan_|_wan$/.test(z) || z === "wan") return "external";
  if (z.includes("dmz")) return "external";
  if (z.includes("guest")) return "perimeter";
  if (z.includes("vpn")) return "perimeter";
  if (z.includes("wifi") || z.includes("wlan") || z.includes("wireless")) return "perimeter";
  if (z.includes("red")) return "perimeter";
  if (z.includes("discover")) return "perimeter";
  return "internal";
}

function zoneSortKey(name: string): number {
  const z = name.toLowerCase();
  if (z === "wan") return 0;
  if (z.includes("wan")) return 1;
  if (z.includes("dmz")) return 2;
  if (z.includes("guest")) return 10;
  if (z.includes("vpn")) return 11;
  if (z.includes("wifi") || z.includes("wlan")) return 12;
  if (z.includes("red")) return 13;
  if (z.includes("discover")) return 14;
  if (z === "lan") return 20;
  if (z.includes("lan")) return 21;
  if (z.includes("server")) return 22;
  if (z.includes("local")) return 23;
  if (z.includes("manage")) return 24;
  return 25;
}

function twoColumnLayout(
  zones: string[],
  width: number,
  height: number
): Map<string, { x: number; y: number; cat: ZoneCategory }> {
  const map = new Map<string, { x: number; y: number; cat: ZoneCategory }>();

  const external = zones
    .filter((z) => categorizeZone(z) === "external")
    .sort((a, b) => zoneSortKey(a) - zoneSortKey(b));
  const perimeter = zones
    .filter((z) => categorizeZone(z) === "perimeter")
    .sort((a, b) => zoneSortKey(a) - zoneSortKey(b));
  const internal = zones
    .filter((z) => categorizeZone(z) === "internal")
    .sort((a, b) => zoneSortKey(a) - zoneSortKey(b));

  const colX = { internal: width * 0.15, perimeter: width * 0.5, external: width * 0.85 };
  const pad = 52;

  const placeColumn = (list: string[], x: number, cat: ZoneCategory) => {
    const totalH = height - pad * 2;
    const spacing = list.length > 1 ? totalH / (list.length - 1) : 0;
    const startY = list.length > 1 ? pad : height / 2;
    list.forEach((z, i) => {
      map.set(z, { x, y: startY + spacing * i, cat });
    });
  };

  placeColumn(internal, colX.internal, "internal");
  placeColumn(perimeter, colX.perimeter, "perimeter");
  placeColumn(external, colX.external, "external");

  return map;
}

function bezierPath(
  x1: number, y1: number,
  x2: number, y2: number,
  offset: number
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return `M${x1},${y1} Q${mx + nx * offset},${my + ny * offset} ${x2},${y2}`;
}

export function NetworkZoneMap({ files }: Props) {
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);

  const handleZoneHover = useCallback(
    (zone: string | null) => {
      if (!pinned) setActiveZone(zone);
    },
    [pinned]
  );

  const handleZoneClick = useCallback(
    (zone: string) => {
      if (pinned && activeZone === zone) {
        setPinned(false);
        setActiveZone(null);
      } else {
        setActiveZone(zone);
        setPinned(true);
      }
    },
    [pinned, activeZone]
  );

  const { allZones, flows, positions } = useMemo(() => {
    const zoneSet = new Set<string>();
    const flowMap = new Map<string, ZoneFlow>();

    for (const file of files) {
      const sections = file.extractedData;
      const fwSection =
        findSection(sections, /firewall\s*rules|firewallrules/i) ??
        sections["Firewall Rules"] ??
        sections["firewallRules"];
      const zoneSection =
        findSection(sections, /^zones?$/i) ??
        sections["Zone"] ??
        sections["zones"];

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
            const hasWf = !!(wf && !/none|not specified|-|n\/a/i.test(wf));
            const ips =
              row["IPS"] ??
              row["Intrusion Prevention"] ??
              row["IntrusionPrevention"] ??
              "";
            const hasIps = !!(ips && !/none|off|-|n\/a|disabled/i.test(ips));
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
    const svgW = 520;
    const svgH = Math.max(420, zoneList.length * 36 + 80);
    const pos = twoColumnLayout(zoneList, svgW, svgH);

    return { allZones: zoneList, flows: [...flowMap.values()], positions: pos };
  }, [files]);

  if (allZones.length === 0 && flows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Network Zone Map</h3>
        <p className="mt-2 text-xs text-muted-foreground">No zone data available</p>
      </div>
    );
  }

  const displayZones =
    allZones.length > 0
      ? allZones
      : [...new Set(flows.flatMap((f) => [f.source, f.dest]))];

  const svgW = 520;
  const svgH = Math.max(420, displayZones.length * 36 + 80);

  const activeFlows = activeZone
    ? flows.filter(
        (f) =>
          (f.source === activeZone || f.dest === activeZone) &&
          f.source !== f.dest
      )
    : [];
  const intraZoneRules = activeZone
    ? flows
        .filter((f) => f.source === activeZone && f.dest === activeZone)
        .reduce((s, f) => s + f.count, 0)
    : 0;
  const connectedZones = new Set(
    activeFlows.flatMap((f) => [f.source, f.dest])
  );

  const outbound = activeFlows.filter((f) => f.source === activeZone);
  const inbound = activeFlows.filter((f) => f.dest === activeZone);

  const columnLabels = { internal: false, perimeter: false, external: false };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Network Zone Map</h3>
        <p className="text-[9px] text-muted-foreground">
          {activeZone
            ? pinned
              ? "Click zone again to deselect"
              : "Click to pin selection"
            : "Hover or click a zone"}
        </p>
      </div>

      <div className="flex gap-4">
        {/* SVG Map */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full"
            style={{ height: Math.min(svgH, 480), minWidth: 280 }}
            onMouseLeave={() => handleZoneHover(null)}
          >
            {/* Column headers */}
            <text x={svgW * 0.15} y={16} textAnchor="middle" className="text-[8px] font-semibold fill-muted-foreground/60 uppercase tracking-wider">Internal</text>
            <text x={svgW * 0.5} y={16} textAnchor="middle" className="text-[8px] font-semibold fill-muted-foreground/60 uppercase tracking-wider">Perimeter</text>
            <text x={svgW * 0.85} y={16} textAnchor="middle" className="text-[8px] font-semibold fill-muted-foreground/60 uppercase tracking-wider">External</text>

            {/* Column divider lines */}
            <line x1={svgW * 0.33} y1={24} x2={svgW * 0.33} y2={svgH - 8} stroke="currentColor" strokeOpacity={0.06} strokeDasharray="4 4" />
            <line x1={svgW * 0.67} y1={24} x2={svgW * 0.67} y2={svgH - 8} stroke="currentColor" strokeOpacity={0.06} strokeDasharray="4 4" />

            {/* Flow lines — only for active zone */}
            {activeFlows.map((f) => {
              const srcPos = positions.get(f.source);
              const dstPos = positions.get(f.dest);
              if (!srcPos || !dstPos) return null;

              const level = getFlowSecurityLevel(f);
              const key = `${f.source}→${f.dest}`;
              const hasReverse = flows.some(
                (x) => x.source === f.dest && x.dest === f.source
              );
              const curveOffset = hasReverse ? 20 : 6;

              return (
                <path
                  key={key}
                  d={bezierPath(srcPos.x, srcPos.y, dstPos.x, dstPos.y, curveOffset)}
                  fill="none"
                  stroke={FLOW_COLORS[level]}
                  strokeWidth={2}
                  strokeOpacity={0.7}
                  className="transition-all duration-200 pointer-events-none"
                />
              );
            })}

            {/* Zone circles */}
            {displayZones.map((zone) => {
              const pos = positions.get(zone);
              if (!pos) return null;

              const level = getZoneSecurityLevel(flows, zone);
              const isActive = activeZone === zone;
              const isConnected = activeZone ? connectedZones.has(zone) : false;
              const isDimmed = activeZone !== null && !isActive && !isConnected;

              const cat = pos.cat;
              if (!columnLabels[cat]) columnLabels[cat] = true;

              const fill =
                level === "full"
                  ? "#00995a"
                  : level === "partial"
                    ? "#F29400"
                    : "#6A889B";

              const r = isActive ? 20 : isConnected ? 17 : 15;
              const ruleCount = flows
                .filter((f) => f.source === zone || f.dest === zone)
                .reduce((s, f) => s + f.count, 0);

              return (
                <g
                  key={zone}
                  onMouseEnter={() => handleZoneHover(zone)}
                  onClick={() => handleZoneClick(zone)}
                  className="cursor-pointer"
                  opacity={isDimmed ? 0.25 : 1}
                >
                  {isActive && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r + 5}
                      fill="none"
                      stroke={fill}
                      strokeWidth={1.5}
                      strokeOpacity={0.4}
                      strokeDasharray="3 3"
                      className="animate-[spin_8s_linear_infinite]"
                      style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                    />
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={fill}
                    fillOpacity={isActive ? 1 : 0.8}
                    stroke={isActive ? "#fff" : "transparent"}
                    strokeWidth={isActive ? 2 : 0}
                    className="transition-all duration-200"
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 3}
                    textAnchor="middle"
                    className="text-[7px] font-bold fill-white pointer-events-none select-none"
                  >
                    {ruleCount || ""}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + r + 12}
                    textAnchor="middle"
                    className="text-[8px] font-medium fill-muted-foreground pointer-events-none select-none"
                  >
                    {zone.length > 14 ? zone.slice(0, 13) + "…" : zone}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Detail panel */}
        <div
          className="w-52 shrink-0 transition-opacity duration-200 overflow-y-auto"
          style={{ opacity: activeZone ? 1 : 0.4, maxHeight: Math.min(svgH, 480) }}
        >
          {activeZone ? (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground truncate">
                  {activeZone}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(() => {
                    const level = getZoneSecurityLevel(flows, activeZone);
                    return (
                      <span className="flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: FLOW_COLORS[level] }}
                        />
                        {LEVEL_LABELS[level]}
                      </span>
                    );
                  })()}
                </p>
                {intraZoneRules > 0 && (
                  <p className="text-[9px] text-muted-foreground/70">
                    + {intraZoneRules} intra-zone rule{intraZoneRules !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              {outbound.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                    Outbound ({outbound.reduce((s, f) => s + f.count, 0)})
                  </p>
                  <div className="space-y-0.5">
                    {outbound
                      .sort((a, b) => b.count - a.count)
                      .map((f) => {
                        const level = getFlowSecurityLevel(f);
                        return (
                          <div
                            key={f.dest}
                            className="flex items-center gap-1.5 text-[10px] py-0.5"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: FLOW_COLORS[level] }}
                            />
                            <span className="truncate text-foreground">{f.dest}</span>
                            <span className="ml-auto text-muted-foreground shrink-0">
                              {f.count}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {inbound.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                    Inbound ({inbound.reduce((s, f) => s + f.count, 0)})
                  </p>
                  <div className="space-y-0.5">
                    {inbound
                      .sort((a, b) => b.count - a.count)
                      .map((f) => {
                        const level = getFlowSecurityLevel(f);
                        return (
                          <div
                            key={f.source}
                            className="flex items-center gap-1.5 text-[10px] py-0.5"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: FLOW_COLORS[level] }}
                            />
                            <span className="truncate text-foreground">
                              {f.source}
                            </span>
                            <span className="ml-auto text-muted-foreground shrink-0">
                              {f.count}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {outbound.length === 0 && inbound.length === 0 && intraZoneRules === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  No firewall rules reference this zone
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
              <p className="text-[10px] text-muted-foreground">
                Hover or click a zone to see its connections
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] text-muted-foreground pt-1 border-t border-border/30">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FLOW_COLORS.full }} />
          IPS + Web Filter
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FLOW_COLORS.partial }} />
          Partial coverage
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FLOW_COLORS.none }} />
          No IPS / WF
        </span>
        <span className="ml-auto text-[8px]">
          {displayZones.length} zones · {flows.length} flows
        </span>
      </div>
    </div>
  );
}
