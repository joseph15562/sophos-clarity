import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import type { AnalysisResult, InspectionPosture, Finding } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import type { ParsedFile } from "@/hooks/use-report-generation";

// ─── Colour palette (Sophos brand) ───────────────────────────────────────────

const SEV_COLORS: Record<string, string> = {
  critical: "#EA0022",
  high: "#F29400",
  medium: "#F8E300",
  low: "#00995a",
  info: "#009CFB",
};

const FEATURE_META: { key: string; label: string; color: string }[] = [
  { key: "webFilter", label: "Web Filtering", color: "#2006F7" },
  { key: "ips", label: "IPS", color: "#5A00FF" },
  { key: "appControl", label: "App Control", color: "#009CFB" },
  { key: "sslInspection", label: "SSL Inspection", color: "#00EDFF" },
  { key: "logging", label: "Logging", color: "#00995a" },
];

// ─── 1. Severity Breakdown — donut chart ─────────────────────────────────────

interface SeverityBreakdownProps {
  analysisResults: Record<string, AnalysisResult>;
}

export function SeverityBreakdown({ analysisResults }: SeverityBreakdownProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const ar of Object.values(analysisResults)) {
      for (const f of ar.findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([sev, count]) => ({ name: sev.charAt(0).toUpperCase() + sev.slice(1), value: count, color: SEV_COLORS[sev] }));
  }, [analysisResults]);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
        <span className="h-5 w-5 rounded bg-[#EA0022]/10 flex items-center justify-center text-[10px]">!</span>
        Finding Severity Breakdown
      </h3>
      <div className="flex items-center gap-6">
        <div className="w-40 h-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%" cy="50%"
                innerRadius={35} outerRadius={60}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                formatter={(value: number, name: string) => [`${value} finding${value !== 1 ? "s" : ""}`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: d.color }}>{d.value}</span>
              <span className="text-[10px] text-muted-foreground w-10 text-right">{Math.round((d.value / total) * 100)}%</span>
            </div>
          ))}
          <div className="pt-1 border-t border-border flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total</span>
            <span className="text-sm font-bold text-foreground">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 2. Security Feature Coverage — horizontal bars ──────────────────────────

interface SecurityFeatureCoverageProps {
  analysisResults: Record<string, AnalysisResult>;
}

export function SecurityFeatureCoverage({ analysisResults }: SecurityFeatureCoverageProps) {
  const features = useMemo(() => {
    let totalRules = 0;
    const agg = { webFilter: 0, ips: 0, appControl: 0, sslInspection: 0, logging: 0 };

    for (const ar of Object.values(analysisResults)) {
      const p = ar.inspectionPosture;
      const base = Math.max(p.webFilterableRules, p.totalWanRules, 1);
      totalRules += base;
      agg.webFilter += p.withWebFilter;
      agg.ips += p.withIps;
      agg.appControl += p.withAppControl;
      agg.sslInspection += p.withSslInspection;

      const loggingFindings = ar.findings.filter((f) => f.title.toLowerCase().includes("logging")).length;
      const rulesWithLogging = Math.max(0, base - loggingFindings);
      agg.logging += rulesWithLogging;
    }

    if (totalRules === 0) return [];

    return FEATURE_META.map((fm) => ({
      ...fm,
      count: agg[fm.key as keyof typeof agg],
      total: totalRules,
      pct: Math.round((agg[fm.key as keyof typeof agg] / totalRules) * 100),
    }));
  }, [analysisResults]);

  if (features.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
        <span className="h-5 w-5 rounded bg-[#2006F7]/10 flex items-center justify-center">
          <img src="/icons/sophos-security.svg" alt="" className="h-3 w-3 sophos-icon" />
        </span>
        Security Feature Coverage
        <span className="text-[10px] text-muted-foreground font-normal ml-1">across WAN rules</span>
      </h3>
      <div className="space-y-3">
        {features.map((f) => (
          <div key={f.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-foreground font-medium">{f.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tabular-nums" style={{ color: f.color }}>{f.pct}%</span>
                <span className="text-[10px] text-muted-foreground">({f.count}/{f.total})</span>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${f.pct}%`, backgroundColor: f.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 3. Zone Traffic Flow — visual zone map ──────────────────────────────────

interface ZoneTrafficFlowProps {
  files: ParsedFile[];
}

interface ZoneFlow {
  source: string;
  dest: string;
  count: number;
  hasWebFilter: number;
  hasIps: number;
}

export function ZoneTrafficFlow({ files }: ZoneTrafficFlowProps) {
  const { flows, zones } = useMemo(() => {
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
          const srcZone = (
            row["Source Zone"] ?? row["Source Zones"] ?? row["Src Zone"] ?? ""
          ).trim();
          const dstZone = (
            row["Destination Zone"] ?? row["Destination Zones"] ?? row["Dest Zone"] ?? row["DestZone"] ?? ""
          ).trim();
          if (!srcZone || !dstZone) continue;

          const status = (row["Status"] ?? row["status"] ?? "").toLowerCase();
          if (status === "disabled" || status === "disable") continue;

          const src = srcZone.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
          const dst = dstZone.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

          const wf = row["Web Filter"] ?? row["Web Filter Policy"] ?? row["WebFilter"] ?? "";
          const hasWf = wf && wf.toLowerCase() !== "none" && wf.toLowerCase() !== "not specified";
          const ips = row["IPS"] ?? row["Intrusion Prevention"] ?? "";
          const hasIps = ips && ips.toLowerCase() !== "none" && ips.toLowerCase() !== "off";

          for (const s of src) {
            zoneSet.add(s);
            for (const d of dst) {
              zoneSet.add(d);
              const key = `${s}→${d}`;
              const existing = flowMap.get(key);
              if (existing) {
                existing.count++;
                if (hasWf) existing.hasWebFilter++;
                if (hasIps) existing.hasIps++;
              } else {
                flowMap.set(key, { source: s, dest: d, count: 1, hasWebFilter: hasWf ? 1 : 0, hasIps: hasIps ? 1 : 0 });
              }
            }
          }
        }
      }
    }

    return {
      flows: [...flowMap.values()].sort((a, b) => b.count - a.count),
      zones: [...zoneSet].sort(),
    };
  }, [files]);

  if (flows.length === 0) return null;

  const maxCount = Math.max(...flows.map((f) => f.count), 1);

  const ZONE_COLORS: Record<string, string> = {
    wan: "#EA0022", WAN: "#EA0022",
    lan: "#00995a", LAN: "#00995a",
    dmz: "#F29400", DMZ: "#F29400",
    vpn: "#2006F7", VPN: "#2006F7",
    wifi: "#5A00FF", WiFi: "#5A00FF",
  };

  const zoneColor = (z: string) => {
    for (const [k, c] of Object.entries(ZONE_COLORS)) {
      if (z.toLowerCase().includes(k.toLowerCase())) return c;
    }
    return "#6A889B";
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
        <span className="h-5 w-5 rounded bg-[#5A00FF]/10 flex items-center justify-center text-[10px]">
          <img src="/icons/sophos-chart.svg" alt="" className="h-3 w-3 sophos-icon" />
        </span>
        Zone Traffic Flow
        <span className="text-[10px] text-muted-foreground font-normal ml-1">{zones.length} zones · {flows.length} flows</span>
      </h3>

      {/* Zone pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {zones.map((z) => (
          <span
            key={z}
            className="text-[10px] font-bold px-2 py-1 rounded-full text-white"
            style={{ backgroundColor: zoneColor(z) }}
          >
            {z}
          </span>
        ))}
      </div>

      {/* Flow table */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {flows.slice(0, 15).map((f) => {
          const width = Math.max(8, (f.count / maxCount) * 100);
          const coverage = f.count > 0 ? Math.round(((f.hasWebFilter + f.hasIps) / (f.count * 2)) * 100) : 0;
          return (
            <div key={`${f.source}→${f.dest}`} className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold w-16 text-right truncate" style={{ color: zoneColor(f.source) }}>
                {f.source}
              </span>
              <svg className="w-4 h-4 shrink-0 text-muted-foreground" viewBox="0 0 16 16">
                <path d="M2 8h10M10 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[10px] font-mono font-bold w-16 truncate" style={{ color: zoneColor(f.dest) }}>
                {f.dest}
              </span>
              <div className="flex-1 h-3 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${width}%`,
                    backgroundColor: coverage >= 75 ? "#00995a" : coverage >= 40 ? "#F29400" : "#EA0022",
                    opacity: 0.7,
                  }}
                />
              </div>
              <span className="text-[10px] font-bold tabular-nums text-foreground w-6 text-right">{f.count}</span>
              <div className="flex items-center gap-0.5 w-10">
                {f.hasWebFilter > 0 && <span className="text-[8px] px-1 py-0.5 rounded bg-[#2006F7]/10 text-[#2006F7] font-bold">WF</span>}
                {f.hasIps > 0 && <span className="text-[8px] px-1 py-0.5 rounded bg-[#5A00FF]/10 text-[#5A00FF] font-bold">IPS</span>}
              </div>
            </div>
          );
        })}
        {flows.length > 15 && (
          <p className="text-[9px] text-muted-foreground pt-1">+{flows.length - 15} more flows</p>
        )}
      </div>
    </div>
  );
}

// ─── 4. Category Score Bars — animated horizontal bar chart ───────────────────

interface CategoryScoreBarsProps {
  analysisResults: Record<string, AnalysisResult>;
}

export function CategoryScoreBars({ analysisResults }: CategoryScoreBarsProps) {
  const barData = useMemo(() => {
    const entries = Object.entries(analysisResults);
    if (entries.length === 0) return [];

    const scores = entries.map(([, ar]) => computeRiskScore(ar));
    const categoryLabels = scores[0].categories.map((c) => c.label);

    return categoryLabels.map((label) => {
      const pcts = scores.map((s) => s.categories.find((c) => c.label === label)?.pct ?? 0);
      const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      const min = Math.min(...pcts);
      const max = Math.max(...pcts);
      return { label, avg, min, max, spread: entries.length > 1 };
    });
  }, [analysisResults]);

  if (barData.length === 0) return null;

  const barColor = (pct: number) =>
    pct >= 80 ? "#00995a" : pct >= 60 ? "#F8E300" : pct >= 40 ? "#F29400" : "#EA0022";

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
        <span className="h-5 w-5 rounded bg-[#00995a]/10 flex items-center justify-center">
          <img src="/icons/sophos-chart.svg" alt="" className="h-3 w-3 sophos-icon" />
        </span>
        Category Score Breakdown
      </h3>
      <div className="space-y-3">
        {barData.map((d) => (
          <div key={d.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-foreground font-medium">{d.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tabular-nums" style={{ color: barColor(d.avg) }}>{d.avg}%</span>
                {d.spread && d.min !== d.max && (
                  <span className="text-[9px] text-muted-foreground">({d.min}–{d.max})</span>
                )}
              </div>
            </div>
            <div className="h-4 rounded-full bg-muted/40 overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${d.avg}%`, backgroundColor: barColor(d.avg), opacity: 0.85 }}
              />
              {d.avg >= 80 && (
                <span className="absolute right-1.5 top-0 h-full flex items-center text-[8px] font-bold text-white/80">PASS</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 5. Top Findings Table — most critical findings at a glance ──────────────

interface TopFindingsProps {
  analysisResults: Record<string, AnalysisResult>;
}

export function TopFindings({ analysisResults }: TopFindingsProps) {
  const [showAll, setShowAll] = useState(false);

  const findings = useMemo(() => {
    const all: (Finding & { firewall: string })[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      for (const f of ar.findings) all.push({ ...f, firewall: label });
    }
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return all.sort((a, b) => (order[a.severity] ?? 5) - (order[b.severity] ?? 5));
  }, [analysisResults]);

  if (findings.length === 0) return null;

  const shown = showAll ? findings : findings.slice(0, 8);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
        <span className="h-5 w-5 rounded bg-[#EA0022]/10 flex items-center justify-center text-[10px] font-bold text-[#EA0022]">!</span>
        Top Findings
        <span className="text-[10px] text-muted-foreground font-normal ml-1">{findings.length} total</span>
      </h3>
      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {shown.map((f, i) => (
          <div key={`${f.id}-${f.firewall}-${i}`} className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <span
              className="mt-0.5 shrink-0 w-2 h-2 rounded-full"
              style={{ backgroundColor: SEV_COLORS[f.severity] ?? "#6A889B" }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground truncate">{f.title}</span>
                <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{
                  backgroundColor: SEV_COLORS[f.severity] + "18",
                  color: SEV_COLORS[f.severity],
                }}>
                  {f.severity.toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{f.detail}</p>
            </div>
            {Object.keys(analysisResults).length > 1 && (
              <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0 mt-0.5">{f.firewall}</span>
            )}
          </div>
        ))}
      </div>
      {findings.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-[10px] font-medium text-[#2006F7] dark:text-[#00EDFF] hover:underline"
        >
          {showAll ? "Show less" : `Show all ${findings.length} findings`}
        </button>
      )}
    </div>
  );
}

// ─── 6. Rule Health Overview — quick stats grid ──────────────────────────────

interface RuleHealthProps {
  analysisResults: Record<string, AnalysisResult>;
}

export function RuleHealthOverview({ analysisResults }: RuleHealthProps) {
  const stats = useMemo(() => {
    let totalRules = 0, disabledRules = 0, wanRules = 0, natRules = 0;
    let hosts = 0, interfaces = 0;
    let withWf = 0, withIps = 0, withAppCtrl = 0;

    for (const ar of Object.values(analysisResults)) {
      totalRules += ar.stats.totalRules;
      natRules += ar.stats.totalNatRules;
      hosts += ar.stats.totalHosts;
      interfaces += ar.stats.interfaces;
      disabledRules += ar.inspectionPosture.totalDisabledRules;
      wanRules += ar.inspectionPosture.totalWanRules;
      withWf += ar.inspectionPosture.withWebFilter;
      withIps += ar.inspectionPosture.withIps;
      withAppCtrl += ar.inspectionPosture.withAppControl;
    }

    return { totalRules, disabledRules, wanRules, natRules, hosts, interfaces, withWf, withIps, withAppCtrl };
  }, [analysisResults]);

  const cards = [
    { label: "Total Rules", value: stats.totalRules, color: "#2006F7" },
    { label: "WAN Rules", value: stats.wanRules, color: "#EA0022" },
    { label: "Disabled", value: stats.disabledRules, color: stats.disabledRules > 0 ? "#F29400" : "#00995a" },
    { label: "NAT Rules", value: stats.natRules, color: "#5A00FF" },
    { label: "Hosts", value: stats.hosts, color: "#009CFB" },
    { label: "Interfaces", value: stats.interfaces, color: "#00995a" },
  ];

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
        <span className="h-5 w-5 rounded bg-[#009CFB]/10 flex items-center justify-center">
          <img src="/icons/sophos-document.svg" alt="" className="h-3 w-3 sophos-icon" />
        </span>
        Configuration Health
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card px-3 py-2.5 text-center">
            <span className="text-xl font-extrabold tabular-nums block" style={{ color: c.color }}>{c.value}</span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Mini bar: feature adoption across WAN rules */}
      {stats.wanRules > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Web Filter", count: stats.withWf, color: "#2006F7" },
            { label: "IPS", count: stats.withIps, color: "#5A00FF" },
            { label: "App Control", count: stats.withAppCtrl, color: "#009CFB" },
          ].map((f) => {
            const pct = Math.round((f.count / stats.wanRules) * 100);
            return (
              <div key={f.label} className="rounded border border-border bg-card px-2 py-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-muted-foreground font-semibold">{f.label}</span>
                  <span className="text-[10px] font-bold" style={{ color: f.color }}>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/40">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: f.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 7. Findings by Section — bar chart ──────────────────────────────────────

interface FindingsBySectionProps {
  analysisResults: Record<string, AnalysisResult>;
}

export function FindingsBySection({ analysisResults }: FindingsBySectionProps) {
  const data = useMemo(() => {
    const sectionCounts: Record<string, Record<string, number>> = {};
    for (const ar of Object.values(analysisResults)) {
      for (const f of ar.findings) {
        if (!sectionCounts[f.section]) sectionCounts[f.section] = {};
        sectionCounts[f.section][f.severity] = (sectionCounts[f.section][f.severity] || 0) + 1;
      }
    }
    return Object.entries(sectionCounts)
      .map(([section, sevs]) => ({
        section: section.length > 20 ? section.slice(0, 18) + "…" : section,
        critical: sevs.critical || 0,
        high: sevs.high || 0,
        medium: sevs.medium || 0,
        low: sevs.low || 0,
        total: Object.values(sevs).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [analysisResults]);

  if (data.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
        <span className="h-5 w-5 rounded bg-[#F29400]/10 flex items-center justify-center">
          <img src="/icons/sophos-alert.svg" alt="" className="h-3 w-3 sophos-icon" />
        </span>
        Findings by Section
      </h3>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              type="category" dataKey="section" width={100}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
            />
            <Bar dataKey="critical" stackId="a" fill="#EA0022" radius={[0, 0, 0, 0]} />
            <Bar dataKey="high" stackId="a" fill="#F29400" />
            <Bar dataKey="medium" stackId="a" fill="#F8E300" />
            <Bar dataKey="low" stackId="a" fill="#00995a" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
