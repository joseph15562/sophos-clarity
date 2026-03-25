import { useMemo, useState } from "react";
import type { ParsedFile } from "@/hooks/use-report-generation";
import { BRAND, SEVERITY_COLORS } from "@/lib/design-tokens";

interface RuleDetail {
  name: string;
  service: string;
  needsWf: boolean;
  hasWf: boolean;
  hasIps: boolean;
  hasApp: boolean;
}

interface ZoneFlow {
  source: string;
  dest: string;
  count: number;
  webFilterable: number;
  hasWebFilter: number;
  hasIps: number;
  hasAppControl: number;
  rules: RuleDetail[];
}

const NON_WEB_SERVICES =
  /^(dns|ntp|smtp|smtps|snmp|syslog|ldap|ldaps|radius|ssh|telnet|icmp|ping|ftp|sip|imap|imaps|pop3|pop3s|bgp|ospf|rip|dhcp|tftp|kerberos|nfs|smb|cifs|ipsec|gre|l2tp|pptp|netbios)$/i;

function isWebTraffic(service: string): boolean {
  const svc = service.toLowerCase().trim();
  if (!svc || svc === "any") return true;
  if (NON_WEB_SERVICES.test(svc)) return false;
  if (svc.includes("http") || svc.includes("web")) return true;
  if (/\b(80|443|8080|8443)\b/.test(svc)) return true;
  return false;
}

type ZoneCategory = "WAN" | "LAN" | "DMZ" | "VPN" | "Guest" | "Other";

const ZONE_CAT_CONFIG: Record<ZoneCategory, { color: string; match: (z: string) => boolean }> = {
  WAN: { color: SEVERITY_COLORS.critical, match: (z) => z.includes("wan") },
  LAN: { color: SEVERITY_COLORS.low, match: (z) => z.includes("lan") || z.includes("server") },
  DMZ: { color: SEVERITY_COLORS.high, match: (z) => z.includes("dmz") },
  VPN: { color: BRAND.blue, match: (z) => z.includes("vpn") },
  Guest: { color: "#B529F7", match: (z) => z.includes("guest") || z.includes("wifi") },
  Other: { color: "#6A889B", match: () => true },
};

function classifyZone(z: string): ZoneCategory {
  const lz = z.toLowerCase();
  for (const [cat, cfg] of Object.entries(ZONE_CAT_CONFIG) as [
    ZoneCategory,
    typeof ZONE_CAT_CONFIG.WAN,
  ][]) {
    if (cat !== "Other" && cfg.match(lz)) return cat;
  }
  return "Other";
}

function zoneColor(z: string): string {
  return ZONE_CAT_CONFIG[classifyZone(z)].color;
}

function ProtectionDot({
  covered,
  total,
  label,
}: {
  covered: number;
  total: number;
  label: string;
}) {
  if (total === 0) {
    return (
      <span
        title={`${label}: not applicable`}
        className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[8px] font-bold border select-none opacity-15"
        style={{ borderColor: "currentColor", color: "currentColor" }}
      >
        –
      </span>
    );
  }
  const ratio = covered / total;
  const color =
    ratio >= 1 ? SEVERITY_COLORS.low : ratio > 0 ? SEVERITY_COLORS.high : SEVERITY_COLORS.critical;
  return (
    <span
      title={`${label}: ${covered}/${total} rules`}
      className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[8px] font-black select-none"
      style={{
        borderColor: color,
        color,
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 6px ${color}30`,
        background: `${color}10`,
      }}
    >
      {label[0]}
    </span>
  );
}

function flowHasProblems(f: ZoneFlow): boolean {
  const missingWf = f.webFilterable > 0 && f.hasWebFilter < f.webFilterable;
  const missingIps = f.count > 0 && f.hasIps === 0;
  return missingWf || missingIps;
}

function flowRisk(f: ZoneFlow): number {
  const isWanSrc = classifyZone(f.source) === "WAN";
  const isWanDst = classifyZone(f.dest) === "WAN";
  const touchesWan = isWanSrc || isWanDst;
  const wfCoverage = f.webFilterable > 0 ? f.hasWebFilter / f.webFilterable : 1;
  const ipsCoverage = f.count > 0 ? f.hasIps / f.count : 1;
  const appCoverage = f.count > 0 ? f.hasAppControl / f.count : 1;
  const coverageRatio = (wfCoverage + ipsCoverage + appCoverage) / 3;
  let risk = 0;
  if (touchesWan) risk += 100;
  risk += Math.round((1 - coverageRatio) * 50);
  risk += f.count;
  return risk;
}

export function ZoneTrafficFlow({ files }: { files: ParsedFile[] }) {
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ZoneCategory | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);

  const { flows, zones, categoryMap } = useMemo(() => {
    const flowMap = new Map<string, ZoneFlow>();
    const zoneSet = new Set<string>();

    for (const file of files) {
      const sections = file.extractedData;
      const fwSection =
        sections["FirewallRules"] ??
        sections["Firewall Rules"] ??
        sections["Firewall rules"] ??
        sections["firewallRules"];
      if (!fwSection) continue;

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

          const ruleName = row["Rule Name"] ?? row["Name"] ?? row["Rule"] ?? row["#"] ?? "Unnamed";
          const service =
            row["Service"] ?? row["Services"] ?? row["Services/Ports"] ?? row["service"] ?? "";

          const wf = row["Web Filter"] ?? row["Web Filter Policy"] ?? row["WebFilter"] ?? "";
          const hasWf = !!(
            wf &&
            wf.toLowerCase() !== "none" &&
            wf.toLowerCase() !== "not specified" &&
            wf.toLowerCase() !== "-" &&
            wf.toLowerCase() !== "n/a"
          );
          const ips = row["IPS"] ?? row["Intrusion Prevention"] ?? "";
          const hasIps = !!(
            ips &&
            ips.toLowerCase() !== "none" &&
            ips.toLowerCase() !== "off" &&
            ips.toLowerCase() !== "-" &&
            ips.toLowerCase() !== "n/a" &&
            ips.toLowerCase() !== "disabled"
          );
          const app =
            row["Application Control"] ??
            row["App Control"] ??
            row["AppControl"] ??
            row["Application Filter"] ??
            "";
          const hasApp = !!(
            app &&
            app.toLowerCase() !== "none" &&
            app.toLowerCase() !== "off" &&
            app.toLowerCase() !== "-" &&
            app.toLowerCase() !== "n/a" &&
            app.toLowerCase() !== "disabled"
          );
          const needsWf = isWebTraffic(service || "Any");

          const src = srcZone
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean);
          const dst = dstZone
            .split(/[,;]/)
            .map((s) => s.trim())
            .filter(Boolean);

          for (const s of src) {
            zoneSet.add(s);
            for (const d of dst) {
              zoneSet.add(d);
              const key = `${s}→${d}`;
              const existing = flowMap.get(key);
              const detail: RuleDetail = {
                name: ruleName,
                service: service || "Any",
                needsWf,
                hasWf,
                hasIps,
                hasApp,
              };
              if (existing) {
                existing.count++;
                if (needsWf) existing.webFilterable++;
                if (hasWf) existing.hasWebFilter++;
                if (hasIps) existing.hasIps++;
                if (hasApp) existing.hasAppControl++;
                existing.rules.push(detail);
              } else {
                flowMap.set(key, {
                  source: s,
                  dest: d,
                  count: 1,
                  webFilterable: needsWf ? 1 : 0,
                  hasWebFilter: hasWf ? 1 : 0,
                  hasIps: hasIps ? 1 : 0,
                  hasAppControl: hasApp ? 1 : 0,
                  rules: [detail],
                });
              }
            }
          }
        }
      }
    }

    const catMap = new Map<ZoneCategory, string[]>();
    for (const z of zoneSet) {
      const cat = classifyZone(z);
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(z);
    }

    const allFlows = [...flowMap.values()].sort((a, b) => flowRisk(b) - flowRisk(a));

    return {
      flows: allFlows,
      zones: [...zoneSet],
      categoryMap: catMap,
    };
  }, [files]);

  const filteredFlows = useMemo(() => {
    let result = activeCategory
      ? flows.filter((f) => {
          const zones = categoryMap.get(activeCategory) ?? [];
          return zones.includes(f.source) || zones.includes(f.dest);
        })
      : flows;
    if (problemsOnly) result = result.filter(flowHasProblems);
    return result;
  }, [flows, activeCategory, categoryMap, problemsOnly]);

  const insights = useMemo(() => {
    const msgs: { text: string; type: "warn" | "good" | "info" }[] = [];
    const wanFlows = flows.filter(
      (f) => classifyZone(f.source) === "WAN" || classifyZone(f.dest) === "WAN",
    );
    const wanNeedsWf = wanFlows.filter((f) => f.webFilterable > 0);
    const wanNoWf = wanNeedsWf.filter((f) => f.hasWebFilter < f.webFilterable);
    const wanNoIps = wanFlows.filter((f) => f.hasIps === 0);
    const internalOnly = flows.filter(
      (f) => classifyZone(f.source) !== "WAN" && classifyZone(f.dest) !== "WAN",
    );

    if (wanNoWf.length > 0)
      msgs.push({
        text: `${wanNoWf.length} WAN flow${wanNoWf.length > 1 ? "s" : ""} missing web filtering`,
        type: "warn",
      });
    if (wanNoIps.length > 0)
      msgs.push({
        text: `${wanNoIps.length} WAN flow${wanNoIps.length > 1 ? "s" : ""} without IPS`,
        type: "warn",
      });
    if (wanNoWf.length === 0 && wanNeedsWf.length > 0)
      msgs.push({ text: "All WAN web traffic has web filtering", type: "good" });
    if (wanNoIps.length === 0 && wanFlows.length > 0)
      msgs.push({ text: "All WAN flows have IPS", type: "good" });
    if (internalOnly.length > 0)
      msgs.push({
        text: `${internalOnly.length} internal-only flow${internalOnly.length > 1 ? "s" : ""} (no WAN exposure)`,
        type: "info",
      });
    return msgs.slice(0, 3);
  }, [flows]);

  if (flows.length === 0) return null;

  const categories = (["WAN", "LAN", "DMZ", "VPN", "Guest", "Other"] as ZoneCategory[]).filter(
    (c) => categoryMap.has(c),
  );

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 space-y-5 shadow-card transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(56,136,255,0.04), rgba(181,41,247,0.02), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(56,136,255,0.15), rgba(181,41,247,0.08), transparent)",
        }}
      />
      <div className="flex items-center justify-between">
        <h3 className="text-base font-display font-bold tracking-tight text-foreground">
          Zone Traffic Flow
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProblemsOnly((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-bold rounded-lg transition-all duration-200 cursor-pointer"
            style={
              problemsOnly
                ? {
                    background:
                      "linear-gradient(145deg, rgba(242,148,0,0.18), rgba(242,148,0,0.08))",
                    border: "1px solid rgba(242,148,0,0.35)",
                    color: "#F29400",
                    boxShadow:
                      "0 0 12px rgba(242,148,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
                  }
                : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.5)",
                  }
            }
          >
            Problems only
          </button>
          <span className="text-[11px] text-muted-foreground/70">
            {zones.length} zones · {flows.length} flows
          </span>
        </div>
      </div>

      {/* Zone category strip */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const zoneList = categoryMap.get(cat) ?? [];
          const ruleCount = flows
            .filter((f) => zoneList.includes(f.source) || zoneList.includes(f.dest))
            .reduce((s, f) => s + f.count, 0);
          const isActive = activeCategory === cat;
          const catColor = ZONE_CAT_CONFIG[cat].color;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? null : cat)}
              className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-left transition-all duration-200 cursor-pointer hover:scale-[1.04]"
              style={{
                border: isActive ? `1px solid ${catColor}40` : "1px solid rgba(255,255,255,0.07)",
                background: isActive
                  ? `linear-gradient(145deg, ${catColor}18, ${catColor}08)`
                  : "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                boxShadow: isActive
                  ? `0 0 14px ${catColor}18, inset 0 1px 0 rgba(255,255,255,0.06)`
                  : "inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 6px rgba(0,0,0,0.1)",
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: catColor, boxShadow: `0 0 6px ${catColor}40` }}
              />
              <span className="text-[12px] font-bold text-foreground">{cat}</span>
              <span className="text-[10px] text-foreground/40 font-medium">
                {zoneList.length}z · {ruleCount}r
              </span>
            </button>
          );
        })}
      </div>

      {/* Flow table */}
      <div
        className="max-h-[28rem] overflow-y-auto overflow-x-auto rounded-xl"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.015)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {filteredFlows.length === 0 && problemsOnly ? (
          <div className="flex items-center justify-center py-12 px-4">
            <span
              className="inline-flex items-center gap-2 text-[11px] font-bold rounded-xl px-4 py-2.5"
              style={{
                color: "#00F2B3",
                background: "linear-gradient(145deg, rgba(0,242,179,0.1), rgba(0,242,179,0.04))",
                border: "1px solid rgba(0,242,179,0.2)",
                boxShadow: "0 0 16px rgba(0,242,179,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              No problems found — all flows have web filtering and IPS where applicable
            </span>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <th className="text-left px-4 py-3 text-foreground/40 font-bold uppercase tracking-wider text-[10px]">
                  Source
                </th>
                <th className="px-1 py-3 text-foreground/40" />
                <th className="text-left px-4 py-3 text-foreground/40 font-bold uppercase tracking-wider text-[10px]">
                  Destination
                </th>
                <th className="text-center px-3 py-3 text-foreground/40 font-bold uppercase tracking-wider text-[10px]">
                  Rules
                </th>
                <th
                  className="text-center px-3 py-3 text-foreground/40 font-bold uppercase tracking-wider text-[10px]"
                  title="Web Filter / IPS / App Control"
                >
                  Protection
                </th>
                <th className="text-right px-4 py-3 text-foreground/40 font-bold uppercase tracking-wider text-[10px]">
                  Coverage
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredFlows.slice(0, 20).map((f) => {
                const key = `${f.source}→${f.dest}`;
                const isExpanded = expandedFlow === key;
                const touchesWan =
                  classifyZone(f.source) === "WAN" || classifyZone(f.dest) === "WAN";
                const wfPct = f.webFilterable > 0 ? f.hasWebFilter / f.webFilterable : 1;
                const ipsPct = f.count > 0 ? f.hasIps / f.count : 1;
                const appPct = f.count > 0 ? f.hasAppControl / f.count : 1;
                const coveragePct = Math.round(((wfPct + ipsPct + appPct) / 3) * 100);
                const isUnprotectedWan = touchesWan && coveragePct < 50;
                const coverageColor =
                  coveragePct >= 75 ? "#00F2B3" : coveragePct >= 40 ? "#F29400" : "#EA0022";

                return (
                  <tr
                    key={key}
                    className="cursor-pointer transition-all duration-150"
                    onClick={() => setExpandedFlow(isExpanded ? null : key)}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: isExpanded ? "rgba(255,255,255,0.03)" : undefined,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = isExpanded
                        ? "rgba(255,255,255,0.03)"
                        : "";
                    }}
                  >
                    <td className="px-4 py-3.5 align-top" colSpan={6}>
                      <div
                        className={`flex items-center gap-3 ${isUnprotectedWan ? "border-l-2 border-[#EA0022]/60 pl-3 -ml-1" : ""}`}
                      >
                        <span
                          className="text-[13px] font-bold truncate max-w-[120px]"
                          style={{
                            color: zoneColor(f.source),
                            filter: `drop-shadow(0 0 4px ${zoneColor(f.source)}30)`,
                          }}
                          title={f.source}
                        >
                          {f.source}
                        </span>
                        <span className="text-foreground/30 font-light text-sm">&rarr;</span>
                        <span
                          className="text-[13px] font-bold truncate max-w-[120px]"
                          style={{
                            color: zoneColor(f.dest),
                            filter: `drop-shadow(0 0 4px ${zoneColor(f.dest)}30)`,
                          }}
                          title={f.dest}
                        >
                          {f.dest}
                        </span>
                        <span className="ml-auto flex items-center gap-4 shrink-0">
                          <span className="text-sm font-black tabular-nums text-foreground">
                            {f.count}
                          </span>
                          <span className="flex items-center gap-1">
                            <ProtectionDot
                              covered={f.hasWebFilter}
                              total={f.webFilterable}
                              label="WF"
                            />
                            <ProtectionDot covered={f.hasIps} total={f.count} label="IPS" />
                            <ProtectionDot covered={f.hasAppControl} total={f.count} label="App" />
                          </span>
                          <span
                            className="text-sm font-black tabular-nums w-12 text-right"
                            style={{
                              color: coverageColor,
                              filter: `drop-shadow(0 0 4px ${coverageColor}30)`,
                            }}
                          >
                            {coveragePct}%
                          </span>
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 ml-1 space-y-1.5">
                          {f.rules.map((r, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 py-2 px-3 rounded-lg text-[11px]"
                              style={{
                                background:
                                  "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                                border: "1px solid rgba(255,255,255,0.05)",
                              }}
                            >
                              <span
                                className="font-semibold text-foreground/80 truncate max-w-[160px]"
                                title={r.name}
                              >
                                {r.name}
                              </span>
                              <span
                                className="text-foreground/35 truncate max-w-[120px]"
                                title={r.service}
                              >
                                {r.service}
                              </span>
                              <span className="ml-auto flex items-center gap-2 shrink-0 text-[9px]">
                                {r.needsWf ? (
                                  r.hasWf ? (
                                    <span
                                      className="px-2 py-0.5 rounded-md font-black"
                                      style={{
                                        background: "rgba(0,242,179,0.12)",
                                        color: "#00F2B3",
                                      }}
                                    >
                                      WF
                                    </span>
                                  ) : (
                                    <span
                                      className="px-2 py-0.5 rounded-md font-black"
                                      style={{
                                        background: "rgba(234,0,34,0.12)",
                                        color: "#EA0022",
                                      }}
                                    >
                                      WF
                                    </span>
                                  )
                                ) : (
                                  <span
                                    className="px-2 py-0.5 rounded-md text-foreground/25 font-medium"
                                    style={{ background: "rgba(255,255,255,0.03)" }}
                                    title="Non-web service — web filter not applicable"
                                  >
                                    WF n/a
                                  </span>
                                )}
                                <span
                                  className="px-2 py-0.5 rounded-md font-black"
                                  style={{
                                    background: r.hasIps
                                      ? "rgba(0,242,179,0.12)"
                                      : "rgba(234,0,34,0.12)",
                                    color: r.hasIps ? "#00F2B3" : "#EA0022",
                                  }}
                                >
                                  IPS
                                </span>
                                <span
                                  className="px-2 py-0.5 rounded-md font-black"
                                  style={{
                                    background: r.hasApp
                                      ? "rgba(0,242,179,0.12)"
                                      : "rgba(234,0,34,0.12)",
                                    color: r.hasApp ? "#00F2B3" : "#EA0022",
                                  }}
                                >
                                  APP
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {insights.map((ins, i) => {
            const insColor =
              ins.type === "warn"
                ? "#F29400"
                : ins.type === "good"
                  ? "#00F2B3"
                  : "rgba(255,255,255,0.3)";
            return (
              <span
                key={i}
                className="text-[11px] font-bold px-3 py-2 rounded-lg transition-all duration-200"
                style={{
                  background:
                    ins.type === "info"
                      ? "rgba(255,255,255,0.04)"
                      : `linear-gradient(145deg, ${insColor}14, ${insColor}06)`,
                  border: `1px solid ${insColor}25`,
                  color: insColor,
                  boxShadow: ins.type !== "info" ? `0 0 10px ${insColor}10` : undefined,
                }}
              >
                {ins.text}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
