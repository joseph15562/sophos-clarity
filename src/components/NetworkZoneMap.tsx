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
  pattern: RegExp,
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
  if (levels.some((l) => l === "full") || levels.some((l) => l === "partial")) return "partial";
  return "none";
}

const FLOW_COLORS: Record<SecurityLevel, string> = {
  full: "#00F2B3",
  partial: "#F29400",
  none: "#EA0022",
};

const LEVEL_BG: Record<SecurityLevel, string> = {
  full: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 border-[#008F69]/35 dark:border-[#00F2B3]/30",
  partial: "bg-[#F29400]/10 border-[#F29400]/30",
  none: "bg-[#EA0022]/10 border-[#EA0022]/30",
};

const LEVEL_LABELS: Record<SecurityLevel, string> = {
  full: "Secured",
  partial: "Partial",
  none: "Unprotected",
};

const CAT_LABELS: Record<ZoneCategory, string> = {
  internal: "Internal",
  perimeter: "Perimeter",
  external: "External",
};

const CAT_ICONS: Record<ZoneCategory, string> = {
  internal: "🏢",
  perimeter: "🛡",
  external: "🌐",
};

function categorizeZone(name: string): ZoneCategory {
  const z = name.toLowerCase();
  if (z === "wan" || /^wan[_-]|[_-]wan$/.test(z)) return "external";
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
  if (z.includes("red")) return 13;
  if (z === "lan") return 20;
  if (z.includes("lan")) return 21;
  if (z.includes("server")) return 22;
  if (z.includes("local")) return 23;
  return 25;
}

export function NetworkZoneMap({ files }: Props) {
  const [activeZone, setActiveZone] = useState<string | null>(null);

  const handleClick = useCallback((zone: string) => {
    setActiveZone((prev) => (prev === zone ? null : zone));
  }, []);

  const { flows, grouped } = useMemo(() => {
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

            const wf = row["Web Filter"] ?? row["Web Filter Policy"] ?? row["WebFilter"] ?? "";
            const hasWf = !!(wf && !/none|not specified|-|n\/a/i.test(wf));
            const ips =
              row["IPS"] ?? row["Intrusion Prevention"] ?? row["IntrusionPrevention"] ?? "";
            const hasIps = !!(ips && !/none|off|-|n\/a|disabled/i.test(ips));
            const service = row["Service"] ?? row["Services"] ?? "Any";
            const needsWf = isWebTraffic(service);

            const srcList = srcZone
              .split(/[,;]/)
              .map((s) => s.trim())
              .filter(Boolean);
            const dstList = dstZone
              .split(/[,;]/)
              .map((s) => s.trim())
              .filter(Boolean);

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

    const zoneList = [...zoneSet].sort((a, b) => zoneSortKey(a) - zoneSortKey(b));

    const grouped: Record<ZoneCategory, string[]> = {
      internal: [],
      perimeter: [],
      external: [],
    };
    for (const z of zoneList) {
      grouped[categorizeZone(z)].push(z);
    }

    return { flows: [...flowMap.values()], grouped };
  }, [files]);

  const allZones = [...grouped.internal, ...grouped.perimeter, ...grouped.external];

  if (allZones.length === 0 && flows.length === 0) {
    return (
      <div
        className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 shadow-card backdrop-blur-sm"
        style={{
          background:
            "linear-gradient(145deg, rgba(56,136,255,0.05), rgba(181,41,247,0.03), transparent)",
        }}
        data-tour="zone-map"
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(56,136,255,0.18), rgba(181,41,247,0.1), transparent)",
          }}
        />
        <h3 className="text-base font-display font-bold tracking-tight text-foreground">
          Network Zone Map
        </h3>
        <p className="mt-3 text-sm text-foreground/45">No zone data available</p>
      </div>
    );
  }

  const activeFlows = activeZone
    ? flows.filter((f) => (f.source === activeZone || f.dest === activeZone) && f.source !== f.dest)
    : [];
  const outbound = activeFlows.filter((f) => f.source === activeZone);
  const inbound = activeFlows.filter((f) => f.dest === activeZone);
  const connectedSet = new Set(activeFlows.flatMap((f) => [f.source, f.dest]));

  const categories = (["internal", "perimeter", "external"] as ZoneCategory[]).filter(
    (cat) => grouped[cat].length > 0,
  );

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 space-y-5 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(56,136,255,0.05), rgba(181,41,247,0.03), transparent)",
      }}
      data-tour="zone-map"
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(56,136,255,0.18), rgba(181,41,247,0.1), transparent)",
        }}
      />
      <div className="flex items-center justify-between">
        <h3 className="text-base font-display font-bold tracking-tight text-foreground">
          Network Zone Map
        </h3>
        <span className="text-[11px] text-foreground/45 font-medium">
          {allZones.length} zones · {flows.length} flows
        </span>
      </div>

      {/* Zone grid */}
      <div
        className={`grid gap-4 ${
          categories.length === 3
            ? "grid-cols-3"
            : categories.length === 2
              ? "grid-cols-2"
              : "grid-cols-1"
        }`}
      >
        {categories.map((cat) => (
          <div key={cat} className="space-y-2">
            <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-wider flex items-center gap-2">
              <span>{CAT_ICONS[cat]}</span>
              {CAT_LABELS[cat]}
              <span className="text-muted-foreground/70 font-normal normal-case">
                ({grouped[cat].length})
              </span>
            </p>
            <div className="space-y-1">
              {grouped[cat].map((zone) => {
                const level = getZoneSecurityLevel(flows, zone);
                const ruleCount = flows
                  .filter((f) => (f.source === zone || f.dest === zone) && f.source !== f.dest)
                  .reduce((s, f) => s + f.count, 0);
                const isActive = activeZone === zone;
                const isConnected = activeZone ? connectedSet.has(zone) : false;
                const isDimmed = activeZone !== null && !isActive && !isConnected;

                return (
                  <button
                    key={zone}
                    onClick={() => handleClick(zone)}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all duration-200 backdrop-blur-sm hover:scale-[1.02] ${
                      isActive
                        ? `${LEVEL_BG[level]} ring-1 ring-offset-2 ring-offset-transparent`
                        : isDimmed
                          ? "opacity-25"
                          : ""
                    }`}
                    style={
                      isActive
                        ? {
                            borderColor: `${FLOW_COLORS[level]}40`,
                            boxShadow: `0 0 16px ${FLOW_COLORS[level]}15`,
                          }
                        : isDimmed
                          ? { border: "1px solid rgba(255,255,255,0.04)" }
                          : {
                              border: "1px solid rgba(255,255,255,0.08)",
                              background:
                                "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                            }
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: FLOW_COLORS[level],
                          boxShadow: `0 0 6px ${FLOW_COLORS[level]}50`,
                        }}
                      />
                      <span className="text-sm font-bold text-foreground truncate">{zone}</span>
                      <span className="ml-auto text-[10px] text-foreground/40 tabular-nums shrink-0 font-medium">
                        {ruleCount > 0 ? `${ruleCount} rule${ruleCount !== 1 ? "s" : ""}` : "—"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Connection detail panel */}
      {activeZone && (
        <div
          className="rounded-xl p-4 space-y-4 backdrop-blur-sm"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: FLOW_COLORS[getZoneSecurityLevel(flows, activeZone)],
                }}
              />
              <span className="text-xs font-semibold text-foreground">{activeZone}</span>
              <span className="text-[10px] text-muted-foreground">
                {LEVEL_LABELS[getZoneSecurityLevel(flows, activeZone)]}
              </span>
            </div>
            <button
              onClick={() => setActiveZone(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Close
            </button>
          </div>

          {outbound.length === 0 && inbound.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">
              No cross-zone firewall rules reference this zone
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {outbound.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                    Outbound → {outbound.reduce((s, f) => s + f.count, 0)} rules
                  </p>
                  <div className="space-y-0.5">
                    {outbound
                      .sort((a, b) => b.count - a.count)
                      .map((f) => {
                        const lvl = getFlowSecurityLevel(f);
                        return (
                          <div key={f.dest} className="flex items-center gap-1.5 text-[10px]">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: FLOW_COLORS[lvl] }}
                            />
                            <span className="truncate text-foreground">{f.dest}</span>
                            <span className="ml-auto text-muted-foreground tabular-nums shrink-0">
                              {f.count}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              {inbound.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                    ← Inbound {inbound.reduce((s, f) => s + f.count, 0)} rules
                  </p>
                  <div className="space-y-0.5">
                    {inbound
                      .sort((a, b) => b.count - a.count)
                      .map((f) => {
                        const lvl = getFlowSecurityLevel(f);
                        return (
                          <div key={f.source} className="flex items-center gap-1.5 text-[10px]">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: FLOW_COLORS[lvl] }}
                            />
                            <span className="truncate text-foreground">{f.source}</span>
                            <span className="ml-auto text-muted-foreground tabular-nums shrink-0">
                              {f.count}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 text-[10px] text-foreground/45 font-medium pt-3 border-t border-slate-900/[0.10] dark:border-white/[0.06]">
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: FLOW_COLORS.full,
              boxShadow: `0 0 6px ${FLOW_COLORS.full}40`,
            }}
          />
          IPS + Web Filter
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: FLOW_COLORS.partial,
              boxShadow: `0 0 6px ${FLOW_COLORS.partial}40`,
            }}
          />
          Partial coverage
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: FLOW_COLORS.none,
              boxShadow: `0 0 6px ${FLOW_COLORS.none}40`,
            }}
          />
          No IPS / WF
        </span>
      </div>
    </div>
  );
}
