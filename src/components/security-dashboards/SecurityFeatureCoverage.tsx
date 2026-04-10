import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { BRAND, DASHBOARD_HOVER_TOOLTIP_CLASS, SEVERITY_COLORS } from "@/lib/design-tokens";

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
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 shadow-card transition-all duration-200 hover:shadow-elevated"
      style={{ backgroundImage: "linear-gradient(145deg, rgba(32,6,247,0.04), transparent)" }}
      data-tour="inspection-posture"
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(90deg, transparent, rgba(32,6,247,0.12), transparent)",
        }}
      />
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-display font-bold tracking-tight text-foreground">
          Feature Coverage
        </h3>
        <div className="flex items-center gap-2.5">
          {(() => {
            const badgeColor =
              overallPct >= 75 ? "#00F2B3" : overallPct >= 40 ? "#F29400" : "#EA0022";
            return (
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg border"
                style={{
                  backgroundColor: `${badgeColor}12`,
                  color: badgeColor,
                  borderColor: `${badgeColor}25`,
                }}
              >
                {overallPct}% avg
              </span>
            );
          })()}
          <span className="text-[11px] text-muted-foreground/60 font-medium">
            {features.total} WAN rules
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 overflow-visible" style={{ padding: "4px" }}>
        {featureKeys.map((key) => {
          const meta = FEATURE_META[key];
          const count = features.agg[key];
          const denom = featureDenominator(key);
          const pct = denom > 0 ? Math.round((count / denom) * 100) : 0;
          const isZero = pct === 0 && denom > 0;
          const isActive = activeFeature === key;
          const denomLabel = key === "wf" ? `${count}/${denom} HTTP/S` : `${count}/${denom}`;
          const cardColor = isZero ? "#EA0022" : meta.color;
          return (
            <div key={key} className="relative group overflow-visible">
              <button
                onClick={() => isMulti && setActiveFeature(isActive ? null : key)}
                className={`relative w-full text-left rounded-2xl border p-4 transition-all duration-200 backdrop-blur-sm overflow-hidden ${
                  isActive
                    ? "scale-[1.04] shadow-elevated"
                    : "hover:scale-[1.04] hover:shadow-elevated hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
                } ${isMulti ? "cursor-pointer" : "cursor-default"}`}
                style={{
                  borderColor: isActive ? `${cardColor}40` : "rgba(255,255,255,0.07)",
                  backgroundImage: isActive
                    ? `linear-gradient(145deg, ${cardColor}22, ${cardColor}0c)`
                    : `linear-gradient(145deg, ${cardColor}12, ${cardColor}06)`,
                  boxShadow: isActive
                    ? `0 0 20px ${cardColor}20, inset 0 1px 0 rgba(255,255,255,0.08)`
                    : `inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15)`,
                }}
              >
                {/* Colour reflection glow */}
                <div
                  className="absolute -top-4 -right-4 h-14 w-14 rounded-full blur-[18px] pointer-events-none transition-opacity duration-200 group-hover:opacity-50"
                  style={{ backgroundColor: cardColor, opacity: 0.25 }}
                />
                {/* Top shimmer */}
                <div
                  className="absolute inset-x-0 top-0 h-px pointer-events-none"
                  style={{
                    backgroundImage: `linear-gradient(90deg, transparent, ${cardColor}30, transparent)`,
                  }}
                />
                {/* Bottom edge */}
                <div
                  className="absolute inset-x-0 bottom-0 h-px pointer-events-none"
                  style={{
                    backgroundImage: `linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)`,
                  }}
                />
                <p className="relative text-[11px] font-display font-semibold text-foreground/60 mb-1.5">
                  {meta.label}
                </p>
                <p
                  className="relative text-3xl font-display font-black tabular-nums tracking-tight"
                  style={{ color: cardColor, filter: `drop-shadow(0 0 6px ${cardColor}40)` }}
                >
                  {denom === 0 ? "N/A" : `${pct}%`}
                </p>
                <div className="relative flex items-center gap-2.5 mt-2.5">
                  <div
                    className="flex-1 h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                  >
                    {isZero ? (
                      <div
                        className="h-full rounded-full bg-[#EA0022]/25"
                        style={{ width: "100%" }}
                      />
                    ) : denom === 0 ? (
                      <div
                        className="h-full rounded-full"
                        style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.04)" }}
                      />
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
              {/* Glass tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 w-60">
                <div className={`${DASHBOARD_HOVER_TOOLTIP_CLASS} p-3 text-[11px] leading-relaxed`}>
                  {meta.tooltip}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeFeature && isMulti && (
        <div
          className="mt-4 rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] overflow-hidden"
          style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <div
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 border-b border-slate-900/[0.10] dark:border-white/[0.06]"
            style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
          >
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
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-slate-900/[0.08] dark:border-white/[0.04] hover:bg-slate-950/[0.04] dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[11px] font-display font-medium text-foreground truncate">
                    {fw.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 w-28">
                  <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                  >
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
