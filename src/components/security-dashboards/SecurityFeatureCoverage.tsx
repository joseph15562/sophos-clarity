import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";

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
    <div className="rounded-xl border border-border bg-card p-5" data-tour="inspection-posture">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Feature Coverage</h3>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${overallPct >= 75 ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]" : overallPct >= 40 ? "bg-[#F29400]/10 text-[#F29400]" : "bg-[#EA0022]/10 text-[#EA0022]"}`}>
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
