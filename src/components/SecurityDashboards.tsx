import { useMemo, useState } from "react";
// recharts no longer needed — all charts are custom interactive components
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import type { ParsedFile } from "@/hooks/use-report-generation";

const SEV_COLORS: Record<string, string> = {
  critical: "#EA0022",
  high: "#F29400",
  medium: "#F8E300",
  low: "#00995a",
  info: "#009CFB",
};

// ─── 1. Severity Breakdown — interactive with drill-down ─────────────────────

const SEV_ORDER: string[] = ["critical", "high", "medium", "low", "info"];

export function SeverityBreakdown({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const [activeSev, setActiveSev] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  const { data, allFindings } = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const findings: (Finding & { firewall: string })[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      for (const f of ar.findings) {
        counts[f.severity] = (counts[f.severity] || 0) + 1;
        findings.push({ ...f, firewall: label });
      }
    }
    const ordered = SEV_ORDER
      .map((sev) => ({ key: sev, name: sev.charAt(0).toUpperCase() + sev.slice(1), value: counts[sev] || 0, color: SEV_COLORS[sev] }))
      .filter((d) => d.value > 0);
    return { data: ordered, allFindings: findings };
  }, [analysisResults]);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const filteredFindings = activeSev
    ? allFindings.filter((f) => f.severity === activeSev)
    : null;

  const handleSevClick = (sev: string) => {
    setActiveSev(activeSev === sev ? null : sev);
    setExpandedFinding(null);
  };

  const multipleFirewalls = Object.keys(analysisResults).length > 1;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Finding Severity</h3>
        <span className="text-[10px] text-muted-foreground">{total} total findings</span>
      </div>

      {/* Stacked severity bar — clickable + hoverable */}
      <div className="relative h-12">
        {/* Bar segments */}
        <div className="absolute bottom-0 left-0 right-0 flex h-5 rounded-full" style={{ clipPath: "inset(0 round 9999px)" }}>
          {data.map((d) => {
            const isDimmed = activeSev !== null && activeSev !== d.key;
            return (
              <div
                key={d.key}
                className="h-full transition-opacity duration-200"
                style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color, opacity: isDimmed ? 0.25 : 1 }}
              />
            );
          })}
        </div>
        {/* Interactive overlay — no overflow clip so tooltips escape */}
        <div className="absolute bottom-0 left-0 right-0 flex h-5">
          {data.map((d, idx) => {
            const isActive = activeSev === d.key;
            const isDimmed = activeSev !== null && !isActive;
            const pct = Math.round((d.value / total) * 100);
            const isFirst = idx === 0;
            const isLast = idx === data.length - 1;
            return (
              <button
                key={d.key}
                onClick={() => handleSevClick(d.key)}
                className="relative h-full group/seg cursor-pointer"
                style={{ width: `${(d.value / total) * 100}%`, opacity: isDimmed ? 0.25 : 1 }}
              >
                {isActive && <div className="absolute inset-0 ring-2 ring-white/50 rounded-sm z-10" />}
                {/* Hover grow */}
                <div
                  className={`absolute left-0 right-0 bottom-0 opacity-0 group-hover/seg:opacity-100 transition-all duration-200 ${isFirst ? "rounded-l-full" : ""} ${isLast ? "rounded-r-full" : ""}`}
                  style={{ backgroundColor: d.color, height: "28px", filter: "brightness(1.15)", borderRadius: isFirst && isLast ? "9999px" : undefined }}
                />
                {/* Tooltip */}
                <div className="opacity-0 group-hover/seg:opacity-100 absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none transition-opacity duration-150">
                  <div className="rounded-lg border border-border bg-popover shadow-lg px-3 py-2 whitespace-nowrap">
                    <p className="text-[11px] font-bold" style={{ color: d.color }}>{d.value} {d.name}</p>
                    <p className="text-[9px] text-muted-foreground">{pct}% of all findings</p>
                  </div>
                  <div className="w-2 h-2 rotate-45 border-b border-r border-border bg-popover mx-auto -mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Severity count cards — clickable with hover */}
      <div className={`grid gap-2 ${data.length <= 3 ? "grid-cols-3" : data.length === 4 ? "grid-cols-4" : "grid-cols-5"}`}>
        {data.map((d) => {
          const isActive = activeSev === d.key;
          const isDimmed = activeSev !== null && !isActive;
          const pct = Math.round((d.value / total) * 100);
          return (
            <button
              key={d.key}
              onClick={() => handleSevClick(d.key)}
              className={`relative text-center rounded-lg border py-2.5 px-1 transition-all group/card ${
                isActive
                  ? "ring-1 bg-foreground/5 scale-105"
                  : isDimmed
                    ? "border-border bg-muted/10 opacity-40"
                    : "border-border bg-muted/20 hover:bg-muted/30 hover:scale-105 hover:shadow-md"
              }`}
              style={isActive ? { borderColor: d.color + "60", ringColor: d.color + "30" } : {}}
            >
              <span className="text-xl font-extrabold tabular-nums block" style={{ color: d.color }}>{d.value}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{d.name}</span>
              <div className="opacity-0 group-hover/card:opacity-100 absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none transition-opacity duration-150">
                <div className="rounded-md border border-border bg-popover shadow-lg px-2.5 py-1.5 whitespace-nowrap text-left">
                  <p className="text-[10px] font-bold" style={{ color: d.color }}>{d.value} {d.name.toLowerCase()} finding{d.value !== 1 ? "s" : ""}</p>
                  <p className="text-[9px] text-muted-foreground">{pct}% of total · Click to filter</p>
                </div>
                <div className="w-2 h-2 rotate-45 border-b border-r border-border bg-popover mx-auto -mt-1" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Drill-down findings list */}
      {filteredFindings && filteredFindings.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            {filteredFindings.length} {activeSev} finding{filteredFindings.length !== 1 ? "s" : ""}
          </p>
          <div className="max-h-52 overflow-y-auto space-y-1">
            {filteredFindings.map((f, i) => {
              const uid = `sev-${f.id}-${f.firewall}-${i}`;
              const isOpen = expandedFinding === uid;
              return (
                <div key={uid} className="rounded-lg border border-border bg-muted/10 overflow-hidden">
                  <button
                    onClick={() => setExpandedFinding(isOpen ? null : uid)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/20 transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: SEV_COLORS[f.severity] }} />
                    <span className="text-[11px] font-medium text-foreground flex-1 truncate">{f.title}</span>
                    {multipleFirewalls && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{f.firewall}</span>
                    )}
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{f.section}</span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-2.5 pt-2 border-t border-border/50 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{f.detail}</p>
                      {f.remediation && (
                        <p className="text-[10px] leading-relaxed">
                          <span className="font-semibold text-[#F29400]">Recommendation:</span>{" "}
                          <span className="text-foreground">{f.remediation}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 2. Security Feature Coverage — interactive cards ─────────────────────────

type FeatureKey = "wf" | "ips" | "app" | "ssl";

const FEATURE_META: Record<FeatureKey, { label: string; color: string; tooltip: string }> = {
  wf:  { label: "Web Filtering", color: "#2006F7", tooltip: "URL/category-based web filtering applied to HTTP/HTTPS WAN traffic. Low coverage means users can access malicious or policy-violating sites." },
  ips: { label: "Intrusion Prevention", color: "#5A00FF", tooltip: "IPS engine scanning WAN traffic for known exploits, malware signatures, and anomalies. Critical for perimeter defence." },
  app: { label: "Application Control", color: "#009CFB", tooltip: "Layer-7 application identification and control on WAN rules. Enables blocking of high-risk apps like Tor, BitTorrent, and remote access tools." },
  ssl: { label: "SSL/TLS Inspection", color: "#00EDFF", tooltip: "Decrypt-and-inspect (DPI) rules that allow the firewall to see inside encrypted traffic. Without this, most modern threats are invisible." },
};

export function SecurityFeatureCoverage({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const [activeFeature, setActiveFeature] = useState<FeatureKey | null>(null);

  const firewallLabels = useMemo(() => Object.keys(analysisResults), [analysisResults]);
  const isMulti = firewallLabels.length > 1;

  const features = useMemo(() => {
    let totalWan = 0;
    let totalWebFilterable = 0;
    const agg: Record<FeatureKey, number> = { wf: 0, ips: 0, app: 0, ssl: 0 };
    for (const ar of Object.values(analysisResults)) {
      const p = ar.inspectionPosture;
      totalWan += p.enabledWanRules;
      totalWebFilterable += p.webFilterableRules;
      agg.wf += p.withWebFilter;
      agg.ips += p.withIps;
      agg.app += p.withAppControl;
      agg.ssl += p.withSslInspection;
    }
    if (totalWan === 0) return null;
    return { total: totalWan, totalWebFilterable, agg };
  }, [analysisResults]);

  const perFirewall = useMemo(() => {
    return Object.entries(analysisResults).map(([label, ar]) => {
      const p = ar.inspectionPosture;
      return {
        label,
        total: p.enabledWanRules,
        wfTotal: p.webFilterableRules,
        wf: p.withWebFilter,
        ips: p.withIps,
        app: p.withAppControl,
        ssl: p.withSslInspection,
      };
    });
  }, [analysisResults]);

  if (!features) return null;

  const featureKeys: FeatureKey[] = ["wf", "ips", "app", "ssl"];

  const featureDenominator = (key: FeatureKey) =>
    key === "wf" ? features.totalWebFilterable : features.total;

  const overallPcts = featureKeys.map((k) => {
    const denom = featureDenominator(k);
    return denom > 0 ? features.agg[k] / denom : 0;
  });
  const overallPct = Math.round((overallPcts.reduce((a, b) => a + b, 0) / featureKeys.length) * 100);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Feature Coverage</h3>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${overallPct >= 75 ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]" : overallPct >= 40 ? "bg-[#F29400]/10 text-[#F29400]" : "bg-[#EA0022]/10 text-[#EA0022]"}`}>
            {overallPct}% avg
          </span>
          <span className="text-[10px] text-muted-foreground">{features.total} WAN rules</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {featureKeys.map((key) => {
          const meta = FEATURE_META[key];
          const count = features.agg[key];
          const denom = featureDenominator(key);
          const pct = denom > 0 ? Math.round((count / denom) * 100) : 0;
          const isZero = pct === 0 && denom > 0;
          const isActive = activeFeature === key;
          const denomLabel = key === "wf" ? `${count}/${denom} HTTP/S` : `${count}/${denom}`;
          return (
            <div key={key} className="relative group">
              <button
                onClick={() => isMulti && setActiveFeature(isActive ? null : key)}
                className={`w-full text-left rounded-lg border p-3 transition-all ${
                  isActive
                    ? "border-border bg-muted/40 ring-1 ring-offset-1 ring-offset-card"
                    : "border-border bg-muted/20 hover:bg-muted/30"
                } ${isMulti ? "cursor-pointer" : "cursor-default"}`}
              >
                <p className="text-[10px] text-muted-foreground mb-1">{meta.label}</p>
                <p className={`text-xl font-extrabold tabular-nums ${isZero ? "text-[#EA0022]" : ""}`} style={isZero ? {} : { color: meta.color }}>
                  {denom === 0 ? "N/A" : `${pct}%`}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    {isZero ? (
                      <div className="h-full rounded-full bg-[#EA0022]/20" style={{ width: "100%" }} />
                    ) : denom === 0 ? (
                      <div className="h-full rounded-full bg-muted/30" style={{ width: "100%" }} />
                    ) : (
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: meta.color }} />
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">{denomLabel}</span>
                </div>
              </button>
              {/* Hover tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 w-56">
                <div className="bg-popover border border-border rounded-lg shadow-lg p-2.5 text-[10px] text-muted-foreground leading-relaxed">
                  {meta.tooltip}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-firewall breakdown */}
      {activeFeature && isMulti && (
        <div className="mt-3 rounded-lg border border-border bg-muted/10 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-1.5 border-b border-border bg-muted/20">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Firewall</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Coverage</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-10 text-right">Rules</span>
          </div>
          {perFirewall.map((fw) => {
            const count = fw[activeFeature];
            const fwTotal = activeFeature === "wf" ? fw.wfTotal : fw.total;
            const pct = fwTotal > 0 ? Math.round((count / fwTotal) * 100) : 0;
            const featureColor = FEATURE_META[activeFeature].color;
            return (
              <div key={fw.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-1.5 border-b last:border-b-0 border-border/50 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-foreground font-medium truncate">{fw.label}</span>
                </div>
                <div className="flex items-center gap-1.5 w-24">
                  <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${fwTotal > 0 ? Math.max(pct, 2) : 0}%`, backgroundColor: pct === 0 && fwTotal > 0 ? "#EA0022" : featureColor }} />
                  </div>
                  <span className={`text-[10px] font-bold tabular-nums ${pct === 0 && fwTotal > 0 ? "text-[#EA0022]" : ""}`} style={pct > 0 ? { color: featureColor } : undefined}>
                    {fwTotal === 0 ? "N/A" : `${pct}%`}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">{count}/{fwTotal}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 3. Zone Traffic Flow ────────────────────────────────────────────────────

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

const NON_WEB_SERVICES = /^(dns|ntp|smtp|smtps|snmp|syslog|ldap|ldaps|radius|ssh|telnet|icmp|ping|ftp|sip|imap|imaps|pop3|pop3s|bgp|ospf|rip|dhcp|tftp|kerberos|nfs|smb|cifs|ipsec|gre|l2tp|pptp|netbios)$/i;

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
  WAN:   { color: "#EA0022", match: (z) => z.includes("wan") },
  LAN:   { color: "#00995a", match: (z) => z.includes("lan") || z.includes("server") },
  DMZ:   { color: "#F29400", match: (z) => z.includes("dmz") },
  VPN:   { color: "#2006F7", match: (z) => z.includes("vpn") },
  Guest: { color: "#B529F7", match: (z) => z.includes("guest") || z.includes("wifi") },
  Other: { color: "#6A889B", match: () => true },
};

function classifyZone(z: string): ZoneCategory {
  const lz = z.toLowerCase();
  for (const [cat, cfg] of Object.entries(ZONE_CAT_CONFIG) as [ZoneCategory, typeof ZONE_CAT_CONFIG.WAN][]) {
    if (cat !== "Other" && cfg.match(lz)) return cat;
  }
  return "Other";
}

function zoneColor(z: string): string {
  return ZONE_CAT_CONFIG[classifyZone(z)].color;
}

function ProtectionDot({ covered, total, label }: { covered: number; total: number; label: string }) {
  if (total === 0) {
    return (
      <span
        title={`${label}: not applicable`}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[7px] font-bold border select-none opacity-15"
        style={{ borderColor: "currentColor", color: "currentColor" }}
      >
        –
      </span>
    );
  }
  const ratio = covered / total;
  const color = ratio >= 1 ? "#00995a" : ratio > 0 ? "#F29400" : "#EA0022";
  return (
    <span
      title={`${label}: ${covered}/${total} rules`}
      className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[7px] font-bold border select-none"
      style={{ borderColor: color, color }}
    >
      {label[0]}
    </span>
  );
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

  const { flows, zones, categoryMap } = useMemo(() => {
    const flowMap = new Map<string, ZoneFlow>();
    const zoneSet = new Set<string>();

    for (const file of files) {
      const sections = file.extractedData;
      const fwSection =
        sections["FirewallRules"] ?? sections["Firewall Rules"] ??
        sections["Firewall rules"] ?? sections["firewallRules"];
      if (!fwSection) continue;

      for (const table of fwSection.tables) {
        for (const row of table.rows) {
          const srcZone = (row["Source Zone"] ?? row["Source Zones"] ?? row["Src Zone"] ?? "").trim();
          const dstZone = (row["Destination Zone"] ?? row["Destination Zones"] ?? row["Dest Zone"] ?? row["DestZone"] ?? "").trim();
          if (!srcZone || !dstZone) continue;

          const status = (row["Status"] ?? row["status"] ?? "").toLowerCase();
          if (status === "disabled" || status === "disable") continue;

          const ruleName = row["Rule Name"] ?? row["Name"] ?? row["Rule"] ?? row["#"] ?? "Unnamed";
          const service = row["Service"] ?? row["Services"] ?? row["Services/Ports"] ?? row["service"] ?? "";

          const wf = row["Web Filter"] ?? row["Web Filter Policy"] ?? row["WebFilter"] ?? "";
          const hasWf = !!(wf && wf.toLowerCase() !== "none" && wf.toLowerCase() !== "not specified" && wf.toLowerCase() !== "-" && wf.toLowerCase() !== "n/a");
          const ips = row["IPS"] ?? row["Intrusion Prevention"] ?? "";
          const hasIps = !!(ips && ips.toLowerCase() !== "none" && ips.toLowerCase() !== "off" && ips.toLowerCase() !== "-" && ips.toLowerCase() !== "n/a" && ips.toLowerCase() !== "disabled");
          const app = row["Application Control"] ?? row["App Control"] ?? row["AppControl"] ?? row["Application Filter"] ?? "";
          const hasApp = !!(app && app.toLowerCase() !== "none" && app.toLowerCase() !== "off" && app.toLowerCase() !== "-" && app.toLowerCase() !== "n/a" && app.toLowerCase() !== "disabled");
          const needsWf = isWebTraffic(service || "Any");

          const src = srcZone.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
          const dst = dstZone.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

          for (const s of src) {
            zoneSet.add(s);
            for (const d of dst) {
              zoneSet.add(d);
              const key = `${s}→${d}`;
              const existing = flowMap.get(key);
              const detail: RuleDetail = { name: ruleName, service: service || "Any", needsWf, hasWf, hasIps, hasApp };
              if (existing) {
                existing.count++;
                if (needsWf) existing.webFilterable++;
                if (hasWf) existing.hasWebFilter++;
                if (hasIps) existing.hasIps++;
                if (hasApp) existing.hasAppControl++;
                existing.rules.push(detail);
              } else {
                flowMap.set(key, {
                  source: s, dest: d, count: 1,
                  webFilterable: needsWf ? 1 : 0,
                  hasWebFilter: hasWf ? 1 : 0, hasIps: hasIps ? 1 : 0, hasAppControl: hasApp ? 1 : 0,
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

  if (flows.length === 0) return null;

  const filteredFlows = activeCategory
    ? flows.filter((f) => {
        const zones = categoryMap.get(activeCategory) ?? [];
        return zones.includes(f.source) || zones.includes(f.dest);
      })
    : flows;

  const insights = useMemo(() => {
    const msgs: { text: string; type: "warn" | "good" | "info" }[] = [];
    const wanFlows = flows.filter((f) => classifyZone(f.source) === "WAN" || classifyZone(f.dest) === "WAN");
    const wanNeedsWf = wanFlows.filter((f) => f.webFilterable > 0);
    const wanNoWf = wanNeedsWf.filter((f) => f.hasWebFilter < f.webFilterable);
    const wanNoIps = wanFlows.filter((f) => f.hasIps === 0);
    const internalOnly = flows.filter((f) => classifyZone(f.source) !== "WAN" && classifyZone(f.dest) !== "WAN");

    if (wanNoWf.length > 0) msgs.push({ text: `${wanNoWf.length} WAN flow${wanNoWf.length > 1 ? "s" : ""} missing web filtering`, type: "warn" });
    if (wanNoIps.length > 0) msgs.push({ text: `${wanNoIps.length} WAN flow${wanNoIps.length > 1 ? "s" : ""} without IPS`, type: "warn" });
    if (wanNoWf.length === 0 && wanNeedsWf.length > 0) msgs.push({ text: "All WAN web traffic has web filtering", type: "good" });
    if (wanNoIps.length === 0 && wanFlows.length > 0) msgs.push({ text: "All WAN flows have IPS", type: "good" });
    if (internalOnly.length > 0) msgs.push({ text: `${internalOnly.length} internal-only flow${internalOnly.length > 1 ? "s" : ""} (no WAN exposure)`, type: "info" });
    return msgs.slice(0, 3);
  }, [flows]);

  const categories = (["WAN", "LAN", "DMZ", "VPN", "Guest", "Other"] as ZoneCategory[]).filter((c) => categoryMap.has(c));

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Zone Traffic Flow</h3>
        <span className="text-[10px] text-muted-foreground">{zones.length} zones · {flows.length} flows</span>
      </div>

      {/* Zone category strip */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const zoneList = categoryMap.get(cat) ?? [];
          const ruleCount = flows
            .filter((f) => zoneList.includes(f.source) || zoneList.includes(f.dest))
            .reduce((s, f) => s + f.count, 0);
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? null : cat)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                isActive
                  ? "border-foreground/30 bg-foreground/5 ring-1 ring-foreground/10"
                  : "border-border hover:border-foreground/20"
              }`}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ZONE_CAT_CONFIG[cat].color }} />
              <span className="text-[10px] font-semibold text-foreground">{cat}</span>
              <span className="text-[9px] text-muted-foreground">{zoneList.length}z · {ruleCount}r</span>
            </button>
          );
        })}
      </div>

      {/* Flow table */}
      <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-2.5 py-1.5 text-muted-foreground font-semibold uppercase tracking-wider">Source</th>
              <th className="px-1 py-1.5 text-muted-foreground" />
              <th className="text-left px-2.5 py-1.5 text-muted-foreground font-semibold uppercase tracking-wider">Destination</th>
              <th className="text-center px-2 py-1.5 text-muted-foreground font-semibold uppercase tracking-wider">Rules</th>
              <th className="text-center px-2 py-1.5 text-muted-foreground font-semibold uppercase tracking-wider" title="Web Filter / IPS / App Control">Protection</th>
              <th className="text-right px-2.5 py-1.5 text-muted-foreground font-semibold uppercase tracking-wider">Coverage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredFlows.slice(0, 20).map((f) => {
              const key = `${f.source}→${f.dest}`;
              const isExpanded = expandedFlow === key;
              const touchesWan = classifyZone(f.source) === "WAN" || classifyZone(f.dest) === "WAN";
              const wfPct = f.webFilterable > 0 ? f.hasWebFilter / f.webFilterable : 1;
              const ipsPct = f.count > 0 ? f.hasIps / f.count : 1;
              const appPct = f.count > 0 ? f.hasAppControl / f.count : 1;
              const coveragePct = Math.round(((wfPct + ipsPct + appPct) / 3) * 100);
              const isUnprotectedWan = touchesWan && coveragePct < 50;

              return (
                <tr
                  key={key}
                  className="group/row cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedFlow(isExpanded ? null : key)}
                >
                  <td className="px-2.5 py-2 align-top" colSpan={6}>
                    <div className={`flex items-center gap-2 ${isUnprotectedWan ? "border-l-2 border-[#EA0022]/60 pl-2 -ml-1" : ""}`}>
                      <span className="font-semibold truncate max-w-[100px]" style={{ color: zoneColor(f.source) }} title={f.source}>
                        {f.source}
                      </span>
                      <span className="text-muted-foreground/50">→</span>
                      <span className="font-semibold truncate max-w-[100px]" style={{ color: zoneColor(f.dest) }} title={f.dest}>
                        {f.dest}
                      </span>
                      <span className="ml-auto flex items-center gap-3 shrink-0">
                        <span className="font-bold tabular-nums text-foreground">{f.count}</span>
                        <span className="flex items-center gap-0.5">
                          <ProtectionDot covered={f.hasWebFilter} total={f.webFilterable} label="WF" />
                          <ProtectionDot covered={f.hasIps} total={f.count} label="IPS" />
                          <ProtectionDot covered={f.hasAppControl} total={f.count} label="App" />
                        </span>
                        <span className={`font-bold tabular-nums w-8 text-right ${
                          coveragePct >= 75 ? "text-[#00995a]" : coveragePct >= 40 ? "text-[#F29400]" : "text-[#EA0022]"
                        }`}>
                          {coveragePct}%
                        </span>
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 ml-1 space-y-0.5">
                        {f.rules.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 py-1 px-2 rounded bg-muted/20 text-[9px]">
                            <span className="font-medium text-foreground truncate max-w-[140px]" title={r.name}>{r.name}</span>
                            <span className="text-muted-foreground truncate max-w-[100px]" title={r.service}>{r.service}</span>
                            <span className="ml-auto flex items-center gap-1.5 shrink-0 text-[8px]">
                              {r.needsWf ? (
                                r.hasWf
                                  ? <span className="px-1 rounded bg-[#00995a]/15 text-[#00995a] font-bold">WF</span>
                                  : <span className="px-1 rounded bg-[#EA0022]/10 text-[#EA0022] font-bold">WF</span>
                              ) : (
                                <span className="px-1 rounded bg-muted/40 text-muted-foreground/50" title="Non-web service — web filter not applicable">WF n/a</span>
                              )}
                              {r.hasIps && <span className="px-1 rounded bg-[#00995a]/15 text-[#00995a] font-bold">IPS</span>}
                              {!r.hasIps && <span className="px-1 rounded bg-[#EA0022]/10 text-[#EA0022] font-bold">IPS</span>}
                              {r.hasApp && <span className="px-1 rounded bg-[#00995a]/15 text-[#00995a] font-bold">APP</span>}
                              {!r.hasApp && <span className="px-1 rounded bg-[#EA0022]/10 text-[#EA0022] font-bold">APP</span>}
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
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {insights.map((ins, i) => (
            <span
              key={i}
              className={`text-[9px] font-medium px-2 py-1 rounded-md border ${
                ins.type === "warn"
                  ? "border-[#F29400]/20 bg-[#F29400]/5 text-[#F29400]"
                  : ins.type === "good"
                    ? "border-[#00995a]/20 bg-[#00995a]/5 text-[#00995a] dark:text-[#00F2B3]"
                    : "border-border bg-muted/30 text-muted-foreground"
              }`}
            >
              {ins.type === "warn" ? "⚠ " : ins.type === "good" ? "✓ " : ""}{ins.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 4. Top Findings ─────────────────────────────────────────────────────────

export function TopFindings({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const findings = useMemo(() => {
    const all: (Finding & { firewall: string })[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      for (const f of ar.findings) all.push({ ...f, firewall: label });
    }
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return all.sort((a, b) => (order[a.severity] ?? 5) - (order[b.severity] ?? 5));
  }, [analysisResults]);

  if (findings.length === 0) return null;

  const shown = showAll ? findings : findings.slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Top Findings</h3>
        <span className="text-[10px] text-muted-foreground">{findings.length} total</span>
      </div>
      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {shown.map((f, i) => {
          const uid = `${f.id}-${f.firewall}-${i}`;
          const isExpanded = expandedId === uid;
          return (
            <div key={uid} className="rounded-lg border border-border bg-muted/10 overflow-hidden transition-colors hover:bg-muted/20">
              <button
                onClick={() => setExpandedId(isExpanded ? null : uid)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
              >
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold" style={{
                  backgroundColor: SEV_COLORS[f.severity] + "18",
                  color: SEV_COLORS[f.severity],
                }}>
                  {f.severity.toUpperCase()}
                </span>
                <span className="text-xs font-medium text-foreground flex-1 truncate">{f.title}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{f.section}</span>
              </button>
              {isExpanded && (
                <div className="px-3 pb-2.5 border-t border-border/50 pt-2 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{f.detail}</p>
                  {f.remediation && (
                    <p className="text-[10px] text-foreground"><strong>Recommendation:</strong> {f.remediation}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(analysisResults).length > 1 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF]">{f.firewall}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {findings.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-[10px] font-medium text-[#2006F7] dark:text-[#00EDFF] hover:underline"
        >
          {showAll ? "Show less" : `Show all ${findings.length}`}
        </button>
      )}
    </div>
  );
}

// ─── 5. Configuration Health — interactive stat cards ─────────────────────────

export function RuleHealthOverview({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const firewallLabels = useMemo(() => Object.keys(analysisResults), [analysisResults]);
  const isMulti = firewallLabels.length > 1;

  const stats = useMemo(() => {
    let totalRules = 0, disabledRules = 0, wanRules = 0, natRules = 0;
    let hosts = 0, interfaces = 0;
    for (const ar of Object.values(analysisResults)) {
      totalRules += ar.stats.totalRules;
      natRules += ar.stats.totalNatRules;
      hosts += ar.stats.totalHosts;
      interfaces += ar.stats.interfaces;
      disabledRules += ar.inspectionPosture.totalDisabledRules;
      wanRules += ar.inspectionPosture.totalWanRules;
    }
    return { totalRules, disabledRules, wanRules, natRules, hosts, interfaces };
  }, [analysisResults]);

  const perFirewall = useMemo(() => {
    return Object.entries(analysisResults).map(([label, ar]) => ({
      label,
      totalRules: ar.stats.totalRules,
      wanRules: ar.inspectionPosture.totalWanRules,
      disabledRules: ar.inspectionPosture.totalDisabledRules,
      natRules: ar.stats.totalNatRules,
      hosts: ar.stats.totalHosts,
      interfaces: ar.stats.interfaces,
    }));
  }, [analysisResults]);

  type CardKey = "totalRules" | "wanRules" | "disabledRules" | "natRules" | "hosts" | "interfaces";

  const cards: { key: CardKey; label: string; value: number; color: string; tooltip: string }[] = [
    { key: "totalRules", label: "Total Rules", value: stats.totalRules, color: "#2006F7", tooltip: "Total firewall rules across all configs" },
    { key: "wanRules", label: "WAN Rules", value: stats.wanRules, color: "#EA0022", tooltip: "Rules with WAN source/destination zones — the internet-facing attack surface" },
    { key: "disabledRules", label: "Disabled", value: stats.disabledRules, color: stats.disabledRules > 0 ? "#F29400" : "#00995a", tooltip: stats.disabledRules > 0 ? "Disabled rules add no security value and may indicate abandoned policy" : "No disabled rules — clean configuration" },
    { key: "natRules", label: "NAT Rules", value: stats.natRules, color: "#5A00FF", tooltip: "Network Address Translation rules — port forwarding and masquerading" },
    { key: "hosts", label: "Hosts", value: stats.hosts, color: "#009CFB", tooltip: "IP hosts/networks defined in the firewall configuration" },
    { key: "interfaces", label: "Interfaces", value: stats.interfaces, color: "#00995a", tooltip: "Physical and virtual network interfaces configured" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Configuration Health</h3>
      <div className="grid grid-cols-6 gap-1.5">
        {cards.map((c) => {
          const isActive = activeCard === c.key;
          return (
            <div key={c.key} className="relative group">
              <button
                onClick={() => isMulti && setActiveCard(isActive ? null : c.key)}
                className={`w-full rounded-lg border px-2 py-2.5 text-center transition-all ${
                  isActive
                    ? "border-border bg-muted/40 ring-1 ring-offset-1 ring-offset-card"
                    : "border-border bg-muted/20 hover:bg-muted/30"
                } ${isMulti ? "cursor-pointer" : "cursor-default"}`}
                style={isActive ? { ringColor: c.color + "60" } : undefined}
              >
                <span className="text-lg font-extrabold tabular-nums block" style={{ color: c.color }}>{c.value}</span>
                <span className="text-[7px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">{c.label}</span>
              </button>
              {/* Hover tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 w-48">
                <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-[10px] text-muted-foreground leading-relaxed">
                  {c.tooltip}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-firewall breakdown when card is clicked */}
      {activeCard && isMulti && (
        <div className="mt-3 rounded-lg border border-border bg-muted/10 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/20">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Firewall</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {cards.find((c) => c.key === activeCard)?.label}
            </span>
          </div>
          {perFirewall.map((fw) => {
            const val = fw[activeCard];
            const maxVal = Math.max(...perFirewall.map((f) => f[activeCard]), 1);
            const pct = (val / maxVal) * 100;
            const cardColor = cards.find((c) => c.key === activeCard)?.color ?? "#2006F7";
            return (
              <div key={fw.label} className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-1.5 border-b last:border-b-0 border-border/50 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-foreground font-medium truncate">{fw.label}</span>
                  <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cardColor }} />
                  </div>
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: cardColor }}>{val}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 6. Findings by Section — interactive with drill-down ─────────────────────

export function FindingsBySection({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const allFindings = useMemo(() => {
    const items: (Finding & { firewall: string })[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      for (const f of ar.findings) items.push({ ...f, firewall: label });
    }
    return items;
  }, [analysisResults]);

  const data = useMemo(() => {
    const sectionCounts: Record<string, Record<string, number>> = {};
    for (const f of allFindings) {
      if (!sectionCounts[f.section]) sectionCounts[f.section] = {};
      sectionCounts[f.section][f.severity] = (sectionCounts[f.section][f.severity] || 0) + 1;
    }
    return Object.entries(sectionCounts)
      .map(([section, sevs]) => ({
        section,
        displaySection: section.length > 22 ? section.slice(0, 20) + "…" : section,
        critical: sevs.critical || 0,
        high: sevs.high || 0,
        medium: sevs.medium || 0,
        low: sevs.low || 0,
        info: sevs.info || 0,
        total: Object.values(sevs).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [allFindings]);

  const drillFindings = useMemo(() => {
    if (!activeSection) return [];
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return allFindings
      .filter((f) => f.section === activeSection)
      .sort((a, b) => (order[a.severity] ?? 5) - (order[b.severity] ?? 5));
  }, [allFindings, activeSection]);

  if (data.length === 0) return null;

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Findings by Section</h3>
        <span className="text-[10px] text-muted-foreground">{allFindings.length} total findings</span>
      </div>

      {/* Custom interactive bar chart */}
      <div className="space-y-1.5">
        {data.map((d) => {
          const isActive = activeSection === d.section;
          const isFaded = activeSection !== null && !isActive;
          const sevs: { key: string; count: number; color: string }[] = [
            { key: "critical", count: d.critical, color: "#EA0022" },
            { key: "high", count: d.high, color: "#F29400" },
            { key: "medium", count: d.medium, color: "#F8E300" },
            { key: "low", count: d.low, color: "#00995a" },
            { key: "info", count: d.info, color: "#009CFB" },
          ].filter((s) => s.count > 0);

          return (
            <button
              key={d.section}
              onClick={() => setActiveSection(isActive ? null : d.section)}
              className={`w-full flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-all ${
                isActive ? "bg-muted/30 ring-1 ring-border" : "hover:bg-muted/15"
              } ${isFaded ? "opacity-40" : ""}`}
            >
              <span className="text-[10px] text-muted-foreground font-medium w-[110px] shrink-0 truncate text-right">{d.displaySection}</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 flex h-4 rounded overflow-hidden bg-muted/20">
                  {sevs.map((s) => (
                    <div
                      key={s.key}
                      className="h-full transition-all duration-300 relative group/seg"
                      style={{ width: `${(s.count / maxTotal) * 100}%`, backgroundColor: s.color }}
                    >
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 opacity-0 group-hover/seg:opacity-100 pointer-events-none transition-opacity z-30">
                        <div className="bg-popover border border-border rounded px-1.5 py-0.5 text-[9px] text-foreground whitespace-nowrap shadow-lg">
                          {s.count} {s.key}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <span className="text-[10px] font-bold text-foreground tabular-nums w-6 text-right">{d.total}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Severity legend */}
      <div className="flex items-center justify-center gap-3 mt-3 pt-2 border-t border-border/50">
        {[
          { label: "Critical", color: "#EA0022" },
          { label: "High", color: "#F29400" },
          { label: "Medium", color: "#F8E300" },
          { label: "Low", color: "#00995a" },
          { label: "Info", color: "#009CFB" },
        ].map((s) => (
          <span key={s.label} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      {/* Drill-down findings list */}
      {activeSection && drillFindings.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-muted/10 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border bg-muted/20 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-foreground">{activeSection}</span>
            <button onClick={() => setActiveSection(null)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
            {drillFindings.map((f, i) => (
              <div key={`${f.id}-${i}`} className="px-3 py-2 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded" style={{ backgroundColor: SEV_COLORS[f.severity] + "18", color: SEV_COLORS[f.severity] }}>
                    {f.severity}
                  </span>
                  <span className="text-[10px] font-medium text-foreground flex-1 truncate">{f.title}</span>
                  {Object.keys(analysisResults).length > 1 && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{f.firewall}</span>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground line-clamp-2 leading-relaxed">{f.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Removed: CategoryScoreBars (duplicates RiskScoreDashboard data) ─────────
export function CategoryScoreBars() { return null; }
