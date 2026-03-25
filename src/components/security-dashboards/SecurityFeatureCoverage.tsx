import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { BRAND, SEVERITY_COLORS } from "@/lib/design-tokens";

type FeatureKey = "wf" | "ips" | "app" | "ssl";

const FEATURE_META: Record<FeatureKey, { label: string; color: string; tooltip: string }> = {
  wf: {
    label: "Web Filtering",
    color: BRAND.blue,
    tooltip:
      "URL/category-based web filtering applied to HTTP/HTTPS WAN traffic. Low coverage means users can access malicious or policy-violating sites.",
  },
  ips: {
    label: "Intrusion Prevention",
    color: "#5A00FF",
    tooltip:
      "IPS engine scanning WAN traffic for known exploits, malware signatures, and anomalies. Critical for perimeter defence.",
  },
  app: {
    label: "Application Control",
    color: SEVERITY_COLORS.info,
    tooltip:
      "Layer-7 application identification and control on WAN rules. Enables blocking of high-risk apps like Tor, BitTorrent, and remote access tools.",
  },
  ssl: {
    label: "SSL/TLS Inspection",
    color: BRAND.cyan,
    tooltip:
      "Decrypt-and-inspect (DPI) rules that allow the firewall to see inside encrypted traffic. Without this, most modern threats are invisible.",
  },
};

export function SecurityFeatureCoverage({
  analysisResults,
}: {
  analysisResults: Record<string, AnalysisResult>;
}) {
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
  const overallPct = Math.round(
    (overallPcts.reduce((a, b) => a + b, 0) / featureKeys.length) * 100,
  );

  return (
    <div
      className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 shadow-card"
      data-tour="inspection-posture"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-display font-bold tracking-tight text-foreground">
          Feature Coverage
        </h3>
        <div className="flex items-center gap-2.5">
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${overallPct >= 75 ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3] border-[#00F2B3]/20" : overallPct >= 40 ? "bg-[#F29400]/10 text-[#F29400] border-[#F29400]/20" : "bg-[#EA0022]/10 text-[#EA0022] border-[#EA0022]/20"}`}
          >
            {overallPct}% avg
          </span>
          <span className="text-[11px] text-muted-foreground/60 font-medium">
            {features.total} WAN rules
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  isActive
                    ? "border-border/50 bg-muted/40 ring-1 ring-offset-2 ring-offset-card shadow-sm"
                    : "border-border/40 bg-muted/15 hover:bg-muted/25 hover:border-border/60"
                } ${isMulti ? "cursor-pointer" : "cursor-default"}`}
              >
                <p className="text-[11px] font-display font-medium text-muted-foreground/70 mb-1.5">
                  {meta.label}
                </p>
                <p
                  className={`text-2xl font-display font-bold tabular-nums tracking-tight ${isZero ? "text-[#EA0022]" : ""}`}
                  style={isZero ? {} : { color: meta.color }}
                >
                  {denom === 0 ? "N/A" : `${pct}%`}
                </p>
                <div className="flex items-center gap-2.5 mt-2.5">
                  <div className="flex-1 h-2 rounded-full bg-muted/40 dark:bg-muted/20 overflow-hidden">
                    {isZero ? (
                      <div
                        className="h-full rounded-full bg-[#EA0022]/25"
                        style={{ width: "100%" }}
                      />
                    ) : denom === 0 ? (
                      <div className="h-full rounded-full bg-muted/30" style={{ width: "100%" }} />
                    ) : (
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: meta.color }}
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 font-medium tabular-nums shrink-0">
                    {denomLabel}
                  </span>
                </div>
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 w-60">
                <div className="bg-popover border border-border/60 rounded-xl shadow-elevated p-3 text-[11px] text-muted-foreground leading-relaxed">
                  {meta.tooltip}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-firewall breakdown */}
      {activeFeature && isMulti && (
        <div className="mt-4 rounded-xl border border-border/40 bg-muted/5 dark:bg-muted/5 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 border-b border-border/40 bg-muted/15 dark:bg-muted/10">
            <span className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.12em]">
              Firewall
            </span>
            <span className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.12em]">
              Coverage
            </span>
            <span className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.12em] w-12 text-right">
              Rules
            </span>
          </div>
          {perFirewall.map((fw) => {
            const count = fw[activeFeature];
            const fwTotal = activeFeature === "wf" ? fw.wfTotal : fw.total;
            const pct = fwTotal > 0 ? Math.round((count / fwTotal) * 100) : 0;
            const featureColor = FEATURE_META[activeFeature].color;
            return (
              <div
                key={fw.label}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-border/30 hover:bg-muted/15 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[11px] font-display font-medium text-foreground truncate">
                    {fw.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 w-28">
                  <div className="flex-1 h-1.5 rounded-full bg-muted/30 dark:bg-muted/20 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${fwTotal > 0 ? Math.max(pct, 2) : 0}%`,
                        backgroundColor:
                          pct === 0 && fwTotal > 0 ? SEVERITY_COLORS.critical : featureColor,
                      }}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-display font-bold tabular-nums ${pct === 0 && fwTotal > 0 ? "text-[#EA0022]" : ""}`}
                    style={pct > 0 ? { color: featureColor } : undefined}
                  >
                    {fwTotal === 0 ? "N/A" : `${pct}%`}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground/60 font-medium tabular-nums w-12 text-right">
                  {count}/{fwTotal}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
