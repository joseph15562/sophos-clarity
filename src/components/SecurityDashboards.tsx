import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import type { ParsedFile } from "@/hooks/use-report-generation";

const SEV_COLORS: Record<string, string> = {
  critical: "#EA0022",
  high: "#F29400",
  medium: "#F8E300",
  low: "#00995a",
  info: "#009CFB",
};

// ─── 1. Severity Breakdown — donut + legend ──────────────────────────────────

export function SeverityBreakdown({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
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
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Finding Severity</h3>
        <span className="text-[10px] text-muted-foreground">{total} total findings</span>
      </div>

      {/* Stacked severity bar */}
      <div className="flex h-4 rounded-full overflow-hidden mb-4">
        {data.map((d) => (
          <div
            key={d.name}
            className="transition-all duration-500"
            style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color }}
            title={`${d.name}: ${d.value}`}
          />
        ))}
      </div>

      {/* Severity counts */}
      <div className="grid grid-cols-5 gap-2">
        {data.map((d) => (
          <div key={d.name} className="text-center rounded-lg border border-border bg-muted/20 py-2.5 px-1">
            <span className="text-xl font-extrabold tabular-nums block" style={{ color: d.color }}>{d.value}</span>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 2. Security Feature Coverage — clear bars with 0% states ────────────────

export function SecurityFeatureCoverage({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const features = useMemo(() => {
    let totalWan = 0;
    const agg = { wf: 0, ips: 0, app: 0, ssl: 0 };

    for (const ar of Object.values(analysisResults)) {
      const p = ar.inspectionPosture;
      totalWan += p.totalWanRules;
      agg.wf += p.withWebFilter;
      agg.ips += p.withIps;
      agg.app += p.withAppControl;
      agg.ssl += p.withSslInspection;
    }

    if (totalWan === 0) return null;

    return {
      total: totalWan,
      items: [
        { label: "Web Filtering", count: agg.wf, color: "#2006F7" },
        { label: "Intrusion Prevention", count: agg.ips, color: "#5A00FF" },
        { label: "Application Control", count: agg.app, color: "#009CFB" },
        { label: "SSL/TLS Inspection", count: agg.ssl, color: "#00EDFF" },
      ],
    };
  }, [analysisResults]);

  if (!features) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Feature Coverage</h3>
        <span className="text-[10px] text-muted-foreground">{features.total} WAN rules</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {features.items.map((f) => {
          const pct = Math.round((f.count / features.total) * 100);
          const isZero = pct === 0;
          return (
            <div key={f.label} className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-[10px] text-muted-foreground mb-1">{f.label}</p>
              <p className={`text-xl font-extrabold tabular-nums ${isZero ? "text-[#EA0022]" : ""}`} style={isZero ? {} : { color: f.color }}>
                {pct}%
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  {isZero ? (
                    <div className="h-full rounded-full bg-[#EA0022]/20" style={{ width: "100%" }} />
                  ) : (
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: f.color }} />
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">{f.count}/{features.total}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 3. Zone Traffic Flow ────────────────────────────────────────────────────

interface ZoneFlow {
  source: string;
  dest: string;
  count: number;
  hasWebFilter: number;
  hasIps: number;
}

export function ZoneTrafficFlow({ files }: { files: ParsedFile[] }) {
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
          const srcZone = (row["Source Zone"] ?? row["Source Zones"] ?? row["Src Zone"] ?? "").trim();
          const dstZone = (row["Destination Zone"] ?? row["Destination Zones"] ?? row["Dest Zone"] ?? row["DestZone"] ?? "").trim();
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

  const zoneColor = (z: string) => {
    const lz = z.toLowerCase();
    if (lz.includes("wan")) return "#EA0022";
    if (lz.includes("lan")) return "#00995a";
    if (lz.includes("dmz")) return "#F29400";
    if (lz.includes("vpn")) return "#2006F7";
    if (lz.includes("wifi")) return "#5A00FF";
    return "#6A889B";
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Zone Traffic Flow</h3>
        <span className="text-[10px] text-muted-foreground">{zones.length} zones · {flows.length} flows</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {zones.map((z) => (
          <span key={z} className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: zoneColor(z) }}>
            {z}
          </span>
        ))}
      </div>

      <div className="space-y-1 max-h-56 overflow-y-auto">
        {flows.slice(0, 12).map((f) => {
          const width = Math.max(8, (f.count / maxCount) * 100);
          const coverage = f.count > 0 ? Math.round(((f.hasWebFilter + f.hasIps) / (f.count * 2)) * 100) : 0;
          return (
            <div key={`${f.source}→${f.dest}`} className="flex items-center gap-1.5 py-0.5">
              <span className="text-[10px] font-mono font-bold w-14 text-right truncate" style={{ color: zoneColor(f.source) }}>
                {f.source}
              </span>
              <span className="text-[9px] text-muted-foreground">→</span>
              <span className="text-[10px] font-mono font-bold w-14 truncate" style={{ color: zoneColor(f.dest) }}>
                {f.dest}
              </span>
              <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${width}%`,
                    backgroundColor: coverage >= 75 ? "#00995a" : coverage >= 40 ? "#F29400" : "#EA0022",
                    opacity: 0.65,
                  }}
                />
              </div>
              <span className="text-[10px] font-bold tabular-nums text-foreground w-5 text-right">{f.count}</span>
              {f.hasWebFilter > 0 && <span className="text-[7px] px-1 rounded bg-[#2006F7]/15 text-[#2006F7] font-bold">WF</span>}
              {f.hasIps > 0 && <span className="text-[7px] px-1 rounded bg-[#5A00FF]/15 text-[#5A00FF] font-bold">IPS</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 4. Top Findings ─────────────────────────────────────────────────────────

export function TopFindings({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
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

  const shown = showAll ? findings : findings.slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Top Findings</h3>
        <span className="text-[10px] text-muted-foreground">{findings.length} total</span>
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {shown.map((f, i) => (
          <div key={`${f.id}-${f.firewall}-${i}`} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 bg-muted/10 hover:bg-muted/20 transition-colors">
            <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: SEV_COLORS[f.severity] ?? "#6A889B" }} />
            <span className="text-xs font-medium text-foreground flex-1 truncate">{f.title}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0" style={{
              backgroundColor: SEV_COLORS[f.severity] + "18",
              color: SEV_COLORS[f.severity],
            }}>
              {f.severity.toUpperCase()}
            </span>
          </div>
        ))}
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

// ─── 5. Configuration Health — stat cards ────────────────────────────────────

export function RuleHealthOverview({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
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

  const cards = [
    { label: "Total Rules", value: stats.totalRules, color: "#2006F7" },
    { label: "WAN Rules", value: stats.wanRules, color: "#EA0022" },
    { label: "Disabled", value: stats.disabledRules, color: stats.disabledRules > 0 ? "#F29400" : "#00995a" },
    { label: "NAT Rules", value: stats.natRules, color: "#5A00FF" },
    { label: "Hosts", value: stats.hosts, color: "#009CFB" },
    { label: "Interfaces", value: stats.interfaces, color: "#00995a" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Configuration Health</h3>
      <div className="grid grid-cols-6 gap-1.5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-muted/20 px-2 py-2.5 text-center">
            <span className="text-lg font-extrabold tabular-nums block" style={{ color: c.color }}>{c.value}</span>
            <span className="text-[7px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 6. Findings by Section — horizontal bar chart ───────────────────────────

export function FindingsBySection({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
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
        section: section.length > 22 ? section.slice(0, 20) + "…" : section,
        critical: sevs.critical || 0,
        high: sevs.high || 0,
        medium: sevs.medium || 0,
        low: sevs.low || 0,
        total: Object.values(sevs).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [analysisResults]);

  if (data.length === 0) return null;

  const chartHeight = Math.max(140, data.length * 32 + 20);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Findings by Section</h3>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category" dataKey="section" width={110}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false} tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
            />
            <Bar dataKey="critical" stackId="a" fill="#EA0022" />
            <Bar dataKey="high" stackId="a" fill="#F29400" />
            <Bar dataKey="medium" stackId="a" fill="#F8E300" />
            <Bar dataKey="low" stackId="a" fill="#00995a" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Removed: CategoryScoreBars (duplicates RiskScoreDashboard data) ─────────
export function CategoryScoreBars() { return null; }
